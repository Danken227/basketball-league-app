import client from '@client/client';
import { useEffect, useRef, useState } from 'react';
import GeniusEmbed from '../components/genius/GeniusEmbed';
import GeniusWidget from '../components/genius/GeniusWidget';
import { geniusCacheKey, type GeniusEmbedOptions } from '../components/genius/geniusCache';
import { geniusJuniorCompetitions, geniusResultsWidgets, isGeniusDomain, snapshotEditions } from '../components/genius/geniusConfig';
import { isPlayoffPhase } from '../components/genius/geniusGroups';
import { SNAPSHOT_DIR, snapshotFile, snapshotKey, widgetSnapshotKey, type SnapshotManifest } from '../components/genius/geniusSnapshot';
import { pbpStatsPage, readPlayByPlay } from '../components/genius/matchSummaryData';

// Zbieranie migawki danych Genius do wersji demonstracyjnej (tylko serwer deweloperski, adres /__snapshot na dev.dalk.pl).
// Przechodzi przez strony Genius dwóch ostatnich edycji, po dwie naraz (z przerwami, żeby nie obciążać Genius),
// i zapisuje ich treść — już po naszych poprawkach — do clients/<klient>/public/snapshot (zapis robi wtyczka w vite.config.ts).
// Kolejne strony (drużyny, zawodnicy, rozegrane mecze) wynikają z treści list. Zapisane wcześniej strony
// są pomijane, więc przerwane zbieranie można wznowić.

type Derive = 'groups' | 'teams' | 'players' | 'leaders' | 'schedule';

interface EmbedItem {
  type: 'embed';
  options: GeniusEmbedOptions & { nativeStyle?: boolean };
  cid?: number;
  derive?: Derive;
  // Zamiast treści strony zapisujemy pod tym adresem tylko dane policzone z niej (JSON) — zapis akcji meczów
  // poprzedniej edycji: wyniki kwart i rekordy do zakładki Summary bez ok. 600 KB strony na mecz.
  statsPage?: string;
}

interface WidgetItem {
  type: 'widget';
  widgetId: string;
}

type Item = EmbedItem | WidgetItem;

const PAUSE_MS = 1500;
const SETTLE_MS = 2500;
const TIMEOUT_MS = 90000;
// Po pustej (niepoprawnej) odpowiedzi czekamy chwilę na poprawną, a potem ponawiamy stronę później (do ATTEMPTS razy).
const INVALID_MS = 10000;
const ATTEMPTS = 3;
// Ile stron Genius wczytujemy naraz.
const CONCURRENCY = 2;
const LEADERS_PER_CATEGORY = 5;
// Wszystkie zakładki meczów bieżącej edycji; z poprzedniej tylko podsumowanie i box score (play by play waży
// ok. 600 KB na mecz, a cała migawka musi się zmieścić w limicie wdrożenia Vercela) oraz dane policzone z play by
// play (statsPage).
const MATCH_SECTIONS = ['summary', 'boxscore', 'playbyplay', 'shotchart', 'analysis'];
const OLDER_MATCH_SECTIONS = ['summary', 'boxscore'];

const keyOf = (item: Item) =>
  item.type === 'widget'
    ? widgetSnapshotKey(item.widgetId)
    : snapshotKey(geniusCacheKey(item.statsPage ? { page: item.statsPage } : item.options));
const embed = (options: EmbedItem['options'], cid?: number, derive?: Derive): EmbedItem => ({ type: 'embed', options, cid, derive });

const seniorCids = snapshotEditions.flatMap((edition) => Object.values(edition.competitions));
const juniorCids = snapshotEditions.flatMap((edition) => Object.values(geniusJuniorCompetitions[edition.id] ?? {}));
const currentCids = [...Object.values(snapshotEditions[0].competitions), ...Object.values(geniusJuniorCompetitions[snapshotEditions[0].id] ?? {})];
// Strony wszystkich zawodników tylko w Ekstralidze, 1. i 2. Lidze (3. Liga ma ich najwięcej — tam tylko czołówka liderów).
const playerPagesCids = snapshotEditions.flatMap((edition) => [edition.competitions.eks, edition.competitions['1'], edition.competitions['2']]);

// Listy rozgrywek (wszystkie ligi i kategorie juniorów) — z nich wynikają kolejne strony.
function initialQueue(): Item[] {
  const items: Item[] = Object.values(geniusResultsWidgets).map((widgetId) => ({ type: 'widget', widgetId }) as WidgetItem);
  for (const cid of [...seniorCids, ...juniorCids]) {
    const senior = seniorCids.includes(cid);
    items.push(
      embed({ page: `/competition/${cid}/standings` }, cid, 'groups'),
      embed({ page: `/competition/${cid}/schedule` }, cid, 'schedule'),
      // Terminarz w tle paska meczów (godziny i hale).
      embed({ page: `/competition/${cid}/schedule`, showSubMenus: false, showMatchFilter: false }),
      embed({ page: `/competition/${cid}/teams` }, cid, senior ? 'teams' : undefined),
      // Lista drużyn w tle (GeniusIndexLoader) — z niej strona drużyny wie, w których edycjach drużyna grała.
      embed({ page: `/competition/${cid}/teams`, showSubMenus: false }),
      embed({ page: `/competition/${cid}/players`, showSubMenus: false }, cid, playerPagesCids.includes(cid) ? 'players' : undefined),
      embed({ page: `/competition/${cid}/statistics/player`, showSubMenus: false }),
      embed({ page: `/competition/${cid}/statistics/team`, showSubMenus: false }),
      embed({ page: `/competition/${cid}/leaders`, showSubMenus: false }, cid, senior ? 'leaders' : undefined),
    );
  }
  items.push(embed({ page: '/players?all=1', showSubMenus: false }));
  return items;
}

function deriveItems(derive: Derive, cid: number, html: string): Item[] {
  const root = document.createElement('div');
  root.innerHTML = html;
  const ids = (selector: string, pattern: RegExp) => [
    ...new Set([...root.querySelectorAll(selector)].map((a) => a.getAttribute('href')?.match(pattern)?.[1]).filter((id): id is string => Boolean(id))),
  ];

  if (derive === 'groups') {
    const groups = [...root.querySelectorAll('.selection-scroll a.menuoption')].map((a) => a.textContent?.trim() ?? '').filter(Boolean);
    const phase = (name: string) => name.replace(/ /g, '+');
    return groups.length > 1
      ? [
          ...groups.map((name) => embed({ page: `/competition/${cid}/standings?phaseName=${phase(name)}&` })),
          // Terminarz fazy play-off — z niego drabinka bierze wyniki (playoffGames.ts).
          ...groups.filter(isPlayoffPhase).map((name) => embed({ page: `/competition/${cid}/schedule?phaseName=${phase(name)}&` })),
        ]
      : [];
  }
  if (derive === 'teams') {
    // Wszystkie zakładki drużyny; terminarz daje też godziny i hale najbliższych meczów w podsumowaniu.
    return ids('a[href]', /^\/druzyny\/(\d+)/).flatMap((id) =>
      ['home', 'roster', 'schedule', 'statistics'].map((section) => embed({ page: `/competition/${cid}/team/${id}/${section}`, showTitle: true })),
    );
  }
  // Statystyki i mecze (z nich zakładka „Rekordy”) każdego zawodnika ligi seniorów (w każdej lidze, w której jest na
  // liście — także dwie drużyny).
  if (derive === 'players') {
    return ids('a[href]', /^\/zawodnicy\/(\d+)/).flatMap((id) => [
      embed({ page: `/competition/${cid}/person/${id}/statistics`, showTitle: true, showSubMenus: false }),
      embed({ page: `/competition/${cid}/person/${id}/gamelog`, showTitle: true, showSubMenus: false }),
    ]);
  }
  if (derive === 'leaders') {
    const blocks = ['sPointsAverage', 'sReboundsTotalAverage', 'sAssistsAverage'].map((id) => root.querySelector(`#BLOCK_LEADER_BASKETBALL_${id}`));
    const players = [...new Set(blocks.flatMap((block) => (block ? ids(`#${block.id} a[href^="/zawodnicy/"]`, /^\/zawodnicy\/(\d+)/).slice(0, LEADERS_PER_CATEGORY) : [])))];
    return players.flatMap((id) => [
      embed({ page: `/competition/${cid}/person/${id}/statistics`, showTitle: true, showSubMenus: false }),
      embed({ page: `/competition/${cid}/person/${id}/gamelog`, showTitle: true, showSubMenus: false }),
    ]);
  }
  // Wszystkie rozegrane mecze rozgrywek (seniorów i juniorów).
  const played = [...new Set([...root.querySelectorAll('.match-wrap.STATUS_COMPLETE[id^="extfix_"]')].map((wrap) => wrap.id.replace('extfix_', '')))];
  const current = currentCids.includes(cid);
  const sections = current ? MATCH_SECTIONS : OLDER_MATCH_SECTIONS;
  return played.flatMap((id) => [
    ...sections.map((section) => embed({ page: `/competition/${cid}/match/${id}/${section}`, nativeStyle: true })),
    ...(current
      ? []
      : [{ ...embed({ page: `/competition/${cid}/match/${id}/playbyplay`, nativeStyle: true }), statsPage: pbpStatsPage(id, String(cid)) }]),
  ]);
}

async function save(key: string, content: string) {
  const response = await fetch('/__snapshot/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file: snapshotFile(key), key, content }),
  });
  if (!response.ok) throw new Error(await response.text());
}

// Treść gotowa do zapisu: bez zapamiętanej kopii, komunikatów i skryptów.
function contentOf(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.genius-cached, .genius-status, script').forEach((element) => element.remove());
  return clone.innerHTML;
}

interface Progress {
  done: number;
  skipped: number;
  failed: string[];
  total: number;
  current?: string;
  finished: boolean;
}

declare global {
  interface Window {
    __snapshotProgress?: Progress;
  }
}

// Jedna wczytywana strona: czeka na treść (z limitem czasu) i oddaje ją przez onDone (bez treści = błąd).
function CrawlSlot({ item, onDone }: { item: Item; onDone: (content?: string) => void }) {
  const settleTimer = useRef<number>(undefined);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const finish = (content?: string) => {
    if (done.current) return;
    done.current = true;
    window.clearTimeout(settleTimer.current);
    onDoneRef.current(content);
  };

  // Limit czasu na jedną stronę (Genius bywa przeciążony) — po nim pomijamy ją i idziemy dalej.
  useEffect(() => {
    const timer = window.setTimeout(() => finish(), TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settleTimer.current);
    };
  }, []);

  // Widget paska meczów: zapisujemy karty meczów (li.spls_lsmatch), gdy ich liczba przestanie się zmieniać.
  useEffect(() => {
    if (item.type !== 'widget') return;
    let last = -1;
    let stable = 0;
    const timer = window.setInterval(() => {
      const doc = document.querySelector<HTMLIFrameElement>(`#spw_${item.widgetId} iframe`)?.contentDocument;
      const cards = doc ? [...doc.querySelectorAll('li.spls_lsmatch')] : [];
      stable = cards.length > 0 && cards.length === last ? stable + 1 : 0;
      last = cards.length;
      if (stable >= 4) {
        window.clearInterval(timer);
        finish(`<ul>${cards.map((card) => card.outerHTML).join('')}</ul>`);
      }
    }, 750);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (item.type === 'widget') return <GeniusWidget widgetId={item.widgetId} />;

  // Strona Genius: czekamy na świeżą treść właściwych rozgrywek, a zapisujemy, gdy przestanie się zmieniać
  // (skrypty Genius i nasze poprawki — sortowanie, stronicowanie, loga — dopracowują ją jeszcze chwilę).
  const onContent = (placeholder: HTMLElement) => {
    // Treść zapytania leży w elemencie genius-target (GeniusEmbed) — zapisujemy ją bez niego.
    const root = placeholder.querySelector<HTMLElement>(':scope > .genius-target') ?? placeholder;
    const expected = item.options.page.match(/^\/competition\/(\d+)\//)?.[1];
    const fresh = [...root.children].find((child) => child.classList.contains('hs-embed'));
    if (!fresh) return;
    window.clearTimeout(settleTimer.current);
    // Przeciążony Genius potrafi oddać pustą stronę bez klasy rozgrywek (np. lista zawodników bez nikogo) —
    // takiej nie zapisujemy: jeśli w ciągu kilku sekund nie przyjdzie poprawna, strona wraca do kolejki.
    if (expected && !fresh.classList.contains(`_comp_${expected}`)) {
      settleTimer.current = window.setTimeout(() => finish(), INVALID_MS);
      return;
    }
    settleTimer.current = window.setTimeout(() => {
      if (!item.statsPage) return finish(contentOf(root));
      // Zapis akcji: tylko policzone dane ("null", gdy zapis jest niepełny — wtedy też go nie pobieramy ponownie).
      finish(JSON.stringify(readPlayByPlay(root) ?? null));
    }, SETTLE_MS);
  };
  return <GeniusEmbed {...item.options} onContent={onContent} />;
}

function SnapshotCrawler() {
  const queue = useRef<Item[]>([]);
  const attempts = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());
  const saved = useRef(new Set<string>());
  // Wczytywane strony (po jednej na miejsce); busy — miejsce pracuje albo właśnie szuka następnej strony.
  const [slots, setSlots] = useState<(Item | undefined)[]>(() => Array(CONCURRENCY).fill(undefined));
  const busy = useRef<boolean[]>(Array(CONCURRENCY).fill(false));
  const [progress, setProgress] = useState<Progress>({ done: 0, skipped: 0, failed: [], total: 0, finished: false });

  useEffect(() => {
    const current = slots.filter((item): item is Item => Boolean(item)).map(keyOf);
    window.__snapshotProgress = { ...progress, current: current.join(' · ') || undefined };
  }, [progress, slots]);

  const setSlot = (slot: number, item?: Item) => setSlots((all) => all.map((current, i) => (i === slot ? item : current)));

  const enqueue = (items: Item[]) => {
    for (const item of items) {
      const key = keyOf(item);
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      queue.current.push(item);
    }
    setProgress((p) => ({ ...p, total: seen.current.size }));
  };

  // Wolne miejsca biorą kolejne strony z kolejki; zapisane wcześniej pomijamy (ale z zapisanych list nadal
  // wyprowadzamy kolejne strony). Koniec, gdy kolejka jest pusta i żadne miejsce nie pracuje.
  const fill = async () => {
    for (let slot = 0; slot < CONCURRENCY; slot++) {
      if (busy.current[slot]) continue;
      busy.current[slot] = true;
      let item: Item | undefined;
      while ((item = queue.current.shift())) {
        const key = keyOf(item);
        if (!saved.current.has(snapshotFile(key))) break;
        if (item.type === 'embed' && item.derive && item.cid) {
          const html = await fetch(`${SNAPSHOT_DIR}/${snapshotFile(key)}`).then((r) => r.text());
          enqueue(deriveItems(item.derive, item.cid, html));
        }
        setProgress((p) => ({ ...p, skipped: p.skipped + 1 }));
      }
      if (item) setSlot(slot, item);
      else busy.current[slot] = false;
    }
    if (busy.current.every((b) => !b) && queue.current.length === 0) setProgress((p) => ({ ...p, finished: true }));
  };

  const finish = async (slot: number, item: Item, content?: string) => {
    setSlot(slot, undefined);
    const key = keyOf(item);
    if (content) {
      try {
        await save(key, content);
        saved.current.add(snapshotFile(key));
        if (item.type === 'embed' && item.derive && item.cid) enqueue(deriveItems(item.derive, item.cid, content));
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch (error) {
        setProgress((p) => ({ ...p, failed: [...p.failed, `${key} (${String(error)})`] }));
      }
    } else if ((attempts.current.get(key) ?? 1) < ATTEMPTS) {
      attempts.current.set(key, (attempts.current.get(key) ?? 1) + 1);
      queue.current.push(item);
    } else {
      setProgress((p) => ({ ...p, failed: [...p.failed, key] }));
    }
    window.setTimeout(() => {
      busy.current[slot] = false;
      fill();
    }, PAUSE_MS);
  };

  // Start: lista zapisanych już plików (wznowienie), potem kolejka list rozgrywek.
  useEffect(() => {
    if (!isGeniusDomain()) return;
    let active = true;
    fetch(`${SNAPSHOT_DIR}/index.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<SnapshotManifest>) : undefined))
      .catch(() => undefined)
      .then((manifest) => {
        if (!active) return;
        Object.keys(manifest?.files ?? {}).forEach((file) => saved.current.add(file));
        enqueue(initialQueue());
        fill();
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isGeniusDomain()) {
    return <p className="mx-auto max-w-3xl p-8 text-sm">Migawkę zbiera się na domenie ligi (np. http://{client.site.devHost}:5180/__snapshot).</p>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-black">Migawka danych Genius</h1>
      <p className="mt-2 text-sm text-slate-600">
        Zapisane: {progress.done} · pominięte (już były): {progress.skipped} · błędy: {progress.failed.length} · wszystkich w kolejce: {progress.total}
        {progress.finished ? ' · gotowe' : ''}
      </p>
      {slots.map((item, slot) => item && <p key={slot} className="mt-1 truncate text-xs text-slate-500">Teraz: {keyOf(item)}</p>)}
      {progress.failed.length > 0 && (
        <ul className="mt-3 max-h-40 overflow-auto text-xs text-red-600">
          {progress.failed.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      )}
      {/* Bieżące strony Genius (widoczne, w szerokości strony, żeby tabele miały pełny układ). */}
      {slots.map(
        (item, slot) =>
          item && (
            <div key={`${slot}|${keyOf(item)}`} className="mt-6">
              <CrawlSlot item={item} onDone={(content) => finish(slot, item, content)} />
            </div>
          ),
      )}
    </div>
  );
}

export default SnapshotCrawler;
