import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { geniusCacheKey } from './geniusCache';
import { GENIUS_ORGANIZATION, geniusSnapshot } from './geniusConfig';
import { loadSnapshot } from './geniusSnapshot';

// Rekordy rozgrywek: najwyższe zdobycze zawodników w jednym meczu (punkty, zbiórki, asysty). Genius nie ma takiej
// strony, więc liczymy je ze statystyk meczów (box score) wszystkich rozegranych meczów z terminarza. Treści nie
// osadzamy, tylko pobieramy wprost z serwera Genius (to samo zapytanie, które wysyła skrypt osadzenia, bez
// wczytywania skryptu przy każdym meczu) — kilka meczów naraz. Wyniki zapamiętujemy w przeglądarce na dobę,
// więc kolejne wejście pobiera tylko nowe mecze.

interface PlayerLine {
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  pts: number;
  reb: number;
  ast: number;
}

interface MatchLines {
  savedAt: number;
  date: string;
  lines: PlayerLine[];
}

const STORAGE_PREFIX = 'genius-records-v1:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PARALLEL = 6;
const TOP = 5;

// Treść strony Genius jako element (poza dokumentem). Serwer odpowiada JSON-em z gotowym HTML-em w polu "html";
// w wersji demonstracyjnej bierzemy treść z migawki (undefined, gdy strony w niej nie ma).
async function fetchGeniusPage(page: string): Promise<HTMLElement | undefined> {
  const html = geniusSnapshot
    ? await loadSnapshot(geniusCacheKey({ page }))
    : await fetch(
        `https://hosted.dcd.shared.geniussports.com/embednf/${GENIUS_ORGANIZATION}/en${page}?&iurl=${encodeURIComponent(`${window.location.origin}/genius`)}&_ht=1&_mf=1`,
      )
        .then((response) => (response.ok ? (response.json() as Promise<{ html?: string }>) : undefined))
        .then((data) => data?.html);
  return html ? new DOMParser().parseFromString(html, 'text/html').body : undefined;
}

function loadStored(cid: number): Record<string, MatchLines> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + cid) ?? '{}') as Record<string, MatchLines>;
    return Object.fromEntries(Object.entries(stored).filter(([, match]) => Date.now() - match.savedAt < MAX_AGE_MS));
  } catch {
    return {};
  }
}

function store(cid: number, matches: Record<string, MatchLines>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + cid, JSON.stringify(matches));
  } catch {
    // Brak miejsca — rekordy zostają tylko na czas wizyty.
  }
}

// Rozegrane mecze z terminarza Genius (id "extfix_<numer>" przy meczach ze statusem STATUS_COMPLETE).
function readPlayedMatches(root: HTMLElement) {
  return [...root.querySelectorAll('.match-wrap.STATUS_COMPLETE[id^="extfix_"]')].map((wrap) => wrap.id.replace('extfix_', ''));
}

const columnIndex = (headers: HTMLTableCellElement[], label: string) =>
  headers.findIndex((th) => (th.dataset.geniusLabel ?? th.textContent ?? '').trim().toUpperCase() === label);

// Linie zawodników z box score meczu: tabela każdej drużyny poprzedzona nagłówkiem z jej nazwą (sumy są w stopce).
function readBoxScore(root: HTMLElement): MatchLines | undefined {
  const box = root.querySelector('.boxscore');
  if (!box) return undefined;
  const teams = [...box.querySelectorAll('h4')].map((h) => h.textContent?.trim() ?? '').slice(0, 2);
  const tables = [...box.querySelectorAll('table')].filter((table) => table.querySelector('td.playerName'));
  if (tables.length < 2 || teams.length < 2) return undefined;
  const lines = tables.slice(0, 2).flatMap((table, side) => {
    const headers = [...(table.tHead?.rows[0]?.cells ?? [])];
    const [pts, reb, ast] = ['PTS', 'REB', 'AST'].map((label) => columnIndex(headers, label));
    if (pts < 0 || reb < 0 || ast < 0) return [];
    return [...table.tBodies].flatMap((body) =>
      [...body.rows].flatMap((row) => {
        // Link Genius (".../person/123") albo — w migawce — już przepisany na nasz adres ("/zawodnicy/123").
        const link = row.querySelector<HTMLAnchorElement>('td.playerName a');
        const playerId = link?.getAttribute('href')?.match(/(?:\/person\/|^\/zawodnicy\/)(\d+)/)?.[1];
        if (!link || !playerId) return [];
        const value = (index: number) => Number(row.cells[index]?.textContent?.trim()) || 0;
        return [{ playerId, player: link.textContent?.replace(/\s+/g, ' ').trim() ?? '', team: teams[side], opponent: teams[1 - side], pts: value(pts), reb: value(reb), ast: value(ast) }];
      }),
    );
  });
  const date = root.querySelector('.match-header .match-time span')?.textContent?.trim() ?? '';
  return lines.length > 0 ? { savedAt: Date.now(), date, lines } : undefined;
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
// Data meczu z nagłówka Genius ("Oct 4, 2026, 8:30 PM" albo po tłumaczeniu "04.10.2026, 20:30").
function formatDate(text: string) {
  const pl = text.match(/^(\d{2}\.\d{2}\.\d{4})/);
  if (pl) return pl[1];
  const date = new Date(text.replace(/,(?=\s*\d{1,2}:)/, ''));
  return Number.isNaN(date.getTime()) ? text : dateFormat.format(date);
}

const categories = [
  { key: 'pts', label: 'Punkty', unit: 'PKT' },
  { key: 'reb', label: 'Zbiórki', unit: 'ZB' },
  { key: 'ast', label: 'Asysty', unit: 'AS' },
] as const;

interface RecordRow extends PlayerLine {
  matchId: string;
  date: string;
}

function RecordsTable({ cid, title, unit, rows, field }: { cid: number; title: string; unit: string; rows: RecordRow[]; field: 'pts' | 'reb' | 'ast' }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Brak danych.</p>
      ) : (
        <ol>
          {rows.map((row, index) => (
            <li key={`${row.matchId}-${row.playerId}`} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0">
              <span className="w-5 shrink-0 text-sm text-slate-400">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <Link to={`/zawodnicy/${row.playerId}?rozgrywki=${cid}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-orange-600">
                  {row.player}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {row.team} ·{' '}
                  <Link to={`/mecze/${row.matchId}?rozgrywki=${cid}&sekcja=boxscore`} className="hover:text-orange-600 hover:underline">
                    vs {row.opponent}
                  </Link>
                  {row.date && `, ${formatDate(row.date)}`}
                </p>
              </div>
              <span className={`shrink-0 text-right text-lg font-black tabular-nums ${index === 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                {row[field]}
                <span className="ml-1 text-[10px] font-semibold text-slate-400">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function GeniusRecords({ cid }: { cid: number }) {
  const [matchIds, setMatchIds] = useState<string[]>();
  const [matches, setMatches] = useState<Record<string, MatchLines>>(() => loadStored(cid));
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Terminarz (lista rozegranych meczów), potem box score meczów spoza pamięci — po PARALLEL naraz.
  useEffect(() => {
    let active = true;
    (async () => {
      const schedule = await fetchGeniusPage(`/competition/${cid}/schedule`).catch(() => undefined);
      if (!active) return;
      const ids = schedule ? readPlayedMatches(schedule) : [];
      setMatchIds(ids);
      const queue = ids.filter((id) => !loadStored(cid)[id]);
      const worker = async () => {
        for (let id = queue.shift(); id && active; id = queue.shift()) {
          const root = await fetchGeniusPage(`/competition/${cid}/match/${id}/boxscore`).catch(() => undefined);
          const found = root && readBoxScore(root);
          if (!active) return;
          if (!found) {
            setFailed((prev) => [...prev, id]);
            continue;
          }
          setMatches((prev) => {
            const next = { ...prev, [id]: found };
            store(cid, next);
            return next;
          });
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [cid]);

  const records = useMemo(() => {
    const rows: RecordRow[] = Object.entries(matches).flatMap(([matchId, match]) => match.lines.map((line) => ({ ...line, matchId, date: match.date })));
    return Object.fromEntries(categories.map(({ key }) => [key, [...rows].sort((a, b) => b[key] - a[key]).filter((row) => row[key] > 0).slice(0, TOP)])) as Record<
      'pts' | 'reb' | 'ast',
      RecordRow[]
    >;
  }, [matches]);

  const loaded = (matchIds ?? []).filter((id) => matches[id]).length;

  return (
    <div className="mt-5">
      <p className="mb-3 text-xs text-slate-500">
        Najwyższe zdobycze w jednym meczu, liczone ze statystyk rozegranych meczów (zapamiętywane w przeglądarce na dobę).
        {matchIds === undefined
          ? ' Wczytywanie terminarza…'
          : loading
            ? ` Wczytywanie meczów: ${loaded} z ${matchIds.length}…`
            : ` Mecze: ${loaded} z ${matchIds.length}${failed.length ? ` (${failed.length} niedostępnych)` : ''}.`}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {categories.map(({ key, label, unit }) => (
          <RecordsTable key={key} cid={cid} title={label} unit={unit} rows={records[key]} field={key} />
        ))}
      </div>
    </div>
  );
}

export default GeniusRecords;
