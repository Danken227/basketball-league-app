import { useEffect, useRef, useState } from 'react';
import GeniusEmbed from '../components/genius/GeniusEmbed';
import GeniusWidget from '../components/genius/GeniusWidget';
import { geniusCacheKey, type GeniusEmbedOptions } from '../components/genius/geniusCache';
import { currentGeniusEdition, geniusJuniorCompetitions, geniusResultsWidgets, isGeniusDomain } from '../components/genius/geniusConfig';
import { SNAPSHOT_DIR, snapshotFile, snapshotKey, widgetSnapshotKey, type SnapshotManifest } from '../components/genius/geniusSnapshot';

// Zbieranie migawki danych Genius do wersji demonstracyjnej (tylko serwer deweloperski, adres /__snapshot na dev.dalk.pl).
// Przechodzi po kolei przez strony Genius bieżącej edycji, po jednej naraz (z przerwami, żeby nie obciążać Genius),
// i zapisuje ich treść — już po naszych poprawkach — do public/snapshot (zapis robi wtyczka w vite.config.ts).
// Kolejne strony (drużyny, zawodnicy z czołówek, ostatnie mecze) wynikają z treści list. Zapisane wcześniej strony
// są pomijane, więc przerwane zbieranie można wznowić.

type Derive = 'groups' | 'teams' | 'players' | 'leaders' | 'schedule';

interface EmbedItem {
  type: 'embed';
  options: GeniusEmbedOptions & { nativeStyle?: boolean };
  cid?: number;
  derive?: Derive;
}

interface WidgetItem {
  type: 'widget';
  widgetId: string;
}

type Item = EmbedItem | WidgetItem;

const PAUSE_MS = 1500;
const SETTLE_MS = 2500;
const TIMEOUT_MS = 90000;
const MATCHES_PER_LEAGUE = 4;
const LEADERS_PER_CATEGORY = 5;
const MATCH_SECTIONS = ['summary', 'boxscore', 'playbyplay', 'shotchart', 'analysis'];

const keyOf = (item: Item) => (item.type === 'widget' ? widgetSnapshotKey(item.widgetId) : snapshotKey(geniusCacheKey(item.options)));
const embed = (options: EmbedItem['options'], cid?: number, derive?: Derive): EmbedItem => ({ type: 'embed', options, cid, derive });

const seniorCids = Object.values(currentGeniusEdition.competitions);
const juniorCids = Object.values(geniusJuniorCompetitions[currentGeniusEdition.id] ?? {});
// Strony wszystkich zawodników tylko w Ekstralidze, 1. i 2. Lidze (3. Liga ma ich najwięcej — tam tylko czołówka liderów).
const playerPagesCids = [currentGeniusEdition.competitions.eks, currentGeniusEdition.competitions['1'], currentGeniusEdition.competitions['2']];

// Listy rozgrywek (wszystkie ligi i kategorie juniorów) — z nich wynikają kolejne strony.
function initialQueue(): Item[] {
  const items: Item[] = Object.values(geniusResultsWidgets).map((widgetId) => ({ type: 'widget', widgetId }) as WidgetItem);
  for (const cid of [...seniorCids, ...juniorCids]) {
    const senior = seniorCids.includes(cid);
    items.push(
      embed({ page: `/competition/${cid}/standings` }, cid, 'groups'),
      embed({ page: `/competition/${cid}/schedule` }, cid, senior ? 'schedule' : undefined),
      // Terminarz w tle paska meczów (godziny i hale).
      embed({ page: `/competition/${cid}/schedule`, showSubMenus: false, showMatchFilter: false }),
      embed({ page: `/competition/${cid}/teams` }, cid, senior ? 'teams' : undefined),
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
    return groups.length > 1 ? groups.map((name) => embed({ page: `/competition/${cid}/standings?phaseName=${name.replace(/ /g, '+')}&` })) : [];
  }
  if (derive === 'teams') {
    return ids('a[href]', /^\/druzyny\/(\d+)/).flatMap((id) => [
      embed({ page: `/competition/${cid}/team/${id}/home`, showTitle: true }),
      embed({ page: `/competition/${cid}/team/${id}/roster`, showTitle: true }),
    ]);
  }
  // Statystyki każdego zawodnika ligi seniorów (w każdej lidze, w której jest na liście — także dwie drużyny).
  if (derive === 'players') {
    return ids('a[href]', /^\/zawodnicy\/(\d+)/).map((id) =>
      embed({ page: `/competition/${cid}/person/${id}/statistics`, showTitle: true, showSubMenus: false }),
    );
  }
  if (derive === 'leaders') {
    const blocks = ['sPointsAverage', 'sReboundsTotalAverage', 'sAssistsAverage'].map((id) => root.querySelector(`#BLOCK_LEADER_BASKETBALL_${id}`));
    const players = [...new Set(blocks.flatMap((block) => (block ? ids(`#${block.id} a[href^="/zawodnicy/"]`, /^\/zawodnicy\/(\d+)/).slice(0, LEADERS_PER_CATEGORY) : [])))];
    return players.flatMap((id) => [
      embed({ page: `/competition/${cid}/person/${id}/statistics`, showTitle: true, showSubMenus: false }),
      embed({ page: `/competition/${cid}/person/${id}/gamelog`, showTitle: true, showSubMenus: false }),
    ]);
  }
  // Ostatnie rozegrane mecze ligi: wszystkie zakładki strony meczu.
  const played = [...root.querySelectorAll('.match-wrap.STATUS_COMPLETE[id^="extfix_"]')].map((wrap) => wrap.id.replace('extfix_', ''));
  return played
    .slice(-MATCHES_PER_LEAGUE)
    .flatMap((id) => MATCH_SECTIONS.map((section) => embed({ page: `/competition/${cid}/match/${id}/${section}`, nativeStyle: true })));
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

function SnapshotCrawler() {
  const queue = useRef<Item[]>([]);
  const seen = useRef(new Set<string>());
  const saved = useRef(new Set<string>());
  const [current, setCurrent] = useState<Item>();
  const [progress, setProgress] = useState<Progress>({ done: 0, skipped: 0, failed: [], total: 0, finished: false });
  const settleTimer = useRef<number>(undefined);

  useEffect(() => {
    window.__snapshotProgress = { ...progress, current: current && keyOf(current) };
  }, [progress, current]);

  const enqueue = (items: Item[]) => {
    for (const item of items) {
      const key = keyOf(item);
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      queue.current.push(item);
    }
    setProgress((p) => ({ ...p, total: seen.current.size }));
  };

  // Następna strona z kolejki; zapisane wcześniej pomijamy (ale z zapisanych list nadal wyprowadzamy kolejne strony).
  const next = async () => {
    while (queue.current.length > 0) {
      const item = queue.current.shift()!;
      const key = keyOf(item);
      if (!saved.current.has(snapshotFile(key))) {
        setCurrent(item);
        return;
      }
      if (item.type === 'embed' && item.derive && item.cid) {
        const html = await fetch(`${SNAPSHOT_DIR}/${snapshotFile(key)}`).then((r) => r.text());
        enqueue(deriveItems(item.derive, item.cid, html));
      }
      setProgress((p) => ({ ...p, skipped: p.skipped + 1 }));
    }
    setCurrent(undefined);
    setProgress((p) => ({ ...p, finished: true }));
  };

  const finish = async (item: Item, content?: string) => {
    window.clearTimeout(settleTimer.current);
    setCurrent(undefined);
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
    } else {
      setProgress((p) => ({ ...p, failed: [...p.failed, key] }));
    }
    window.setTimeout(next, PAUSE_MS);
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
        next();
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limit czasu na jedną stronę (Genius bywa przeciążony) — po nim pomijamy ją i idziemy dalej.
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => finish(current), TIMEOUT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Widget paska meczów: zapisujemy karty meczów (li.spls_lsmatch), gdy ich liczba przestanie się zmieniać.
  useEffect(() => {
    if (current?.type !== 'widget') return;
    let last = -1;
    let stable = 0;
    const timer = window.setInterval(() => {
      const doc = document.querySelector<HTMLIFrameElement>(`#spw_${current.widgetId} iframe`)?.contentDocument;
      const cards = doc ? [...doc.querySelectorAll('li.spls_lsmatch')] : [];
      stable = cards.length > 0 && cards.length === last ? stable + 1 : 0;
      last = cards.length;
      if (stable >= 4) {
        window.clearInterval(timer);
        finish(current, `<ul>${cards.map((card) => card.outerHTML).join('')}</ul>`);
      }
    }, 750);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Strona Genius: czekamy na świeżą treść właściwych rozgrywek, a zapisujemy, gdy przestanie się zmieniać
  // (skrypty Genius i nasze poprawki — sortowanie, stronicowanie, loga — dopracowują ją jeszcze chwilę).
  const onContent = (item: EmbedItem) => (root: HTMLElement) => {
    const expected = item.options.page.match(/^\/competition\/(\d+)\//)?.[1];
    const fresh = [...root.children].find((child) => child.classList.contains('hs-embed'));
    if (!fresh || (expected && fresh.className.includes('_comp_') && !fresh.classList.contains(`_comp_${expected}`))) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => finish(item, contentOf(root)), SETTLE_MS);
  };

  if (!isGeniusDomain()) {
    return <p className="mx-auto max-w-3xl p-8 text-sm">Migawkę zbiera się na domenie ligi (np. http://dev.dalk.pl:5180/__snapshot).</p>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-black">Migawka danych Genius</h1>
      <p className="mt-2 text-sm text-slate-600">
        Zapisane: {progress.done} · pominięte (już były): {progress.skipped} · błędy: {progress.failed.length} · wszystkich w kolejce: {progress.total}
        {progress.finished ? ' · gotowe' : ''}
      </p>
      {current && <p className="mt-1 truncate text-xs text-slate-500">Teraz: {keyOf(current)}</p>}
      {progress.failed.length > 0 && (
        <ul className="mt-3 max-h-40 overflow-auto text-xs text-red-600">
          {progress.failed.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      )}
      {/* Bieżąca strona Genius (widoczna, w szerokości strony, żeby tabele miały pełny układ). */}
      <div className="mt-6">
        {current?.type === 'widget' && <GeniusWidget key={keyOf(current)} widgetId={current.widgetId} />}
        {current?.type === 'embed' && <GeniusEmbed key={keyOf(current)} {...current.options} onContent={onContent(current)} />}
      </div>
    </div>
  );
}

export default SnapshotCrawler;
