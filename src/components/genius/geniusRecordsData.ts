// Rekordy rozgrywek: najwyższe zdobycze zawodników w jednym meczu (punkty, zbiórki, asysty). Genius nie ma takiej
// strony, więc liczymy je ze statystyk meczów (box score) wszystkich rozegranych meczów z terminarza. Treści nie
// osadzamy, tylko pobieramy wprost z serwera Genius (to samo zapytanie, które wysyła skrypt osadzenia) — kilka
// meczów naraz. Liczy je administrator w panelu i zapisuje w bazie; strona rekordów (GeniusRecords) czyta tylko
// zapisane.
import { adminRequest } from '../../data/siteContent';
import { fetchGeniusPage } from './geniusFetch';

export interface PlayerLine {
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  pts: number;
  reb: number;
  ast: number;
  // Zawodnik wszedł na boisko (minuty > 0) — wiersz bywa też dla zawodnika ze składu, który nie zagrał.
  played?: boolean;
}

export interface MatchLines {
  savedAt: number;
  date: string;
  lines: PlayerLine[];
}

export interface RecordRow extends PlayerLine {
  matchId: string;
  date: string;
}

export type RecordField = 'pts' | 'reb' | 'ast';

export const recordCategories = [
  { key: 'pts', label: 'Punkty', unit: 'PKT' },
  { key: 'reb', label: 'Zbiórki', unit: 'ZB' },
  { key: 'ast', label: 'Asysty', unit: 'AS' },
] as const;

// Rekordy zapisane w bazie przez administratora (po 10 w kategorii; strona pokazuje 5).
export interface StoredRecords {
  cid: number;
  computedAt: string;
  matchCount: number;
  failedCount: number;
  top: Record<RecordField, RecordRow[]>;
}

export const STORED_TOP = 10;
const PARALLEL = 6;

// Rozegrane mecze z terminarza Genius (id "extfix_<numer>" przy meczach ze statusem STATUS_COMPLETE).
export function readPlayedMatches(root: HTMLElement) {
  return [...root.querySelectorAll('.match-wrap.STATUS_COMPLETE[id^="extfix_"]')].map((wrap) => wrap.id.replace('extfix_', ''));
}

const columnIndex = (headers: HTMLTableCellElement[], label: string) =>
  headers.findIndex((th) => (th.dataset.geniusLabel ?? th.textContent ?? '').trim().toUpperCase() === label);

// Linie zawodników z box score meczu: tabela każdej drużyny poprzedzona nagłówkiem z jej nazwą (sumy są w stopce).
export function readBoxScore(root: HTMLElement): MatchLines | undefined {
  const box = root.querySelector('.boxscore');
  if (!box) return undefined;
  const teams = [...box.querySelectorAll('h4')].map((h) => h.textContent?.trim() ?? '').slice(0, 2);
  const tables = [...box.querySelectorAll('table')].filter((table) => table.querySelector('td.playerName'));
  if (tables.length < 2 || teams.length < 2) return undefined;
  const lines = tables.slice(0, 2).flatMap((table, side) => {
    const headers = [...(table.tHead?.rows[0]?.cells ?? [])];
    const [pts, reb, ast, mins] = ['PTS', 'REB', 'AST', 'MINS'].map((label) => columnIndex(headers, label));
    if (pts < 0 || reb < 0 || ast < 0) return [];
    return [...table.tBodies].flatMap((body) =>
      [...body.rows].flatMap((row) => {
        // Link Genius (".../person/123") albo — w migawce — już przepisany na nasz adres ("/zawodnicy/123").
        const link = row.querySelector<HTMLAnchorElement>('td.playerName a');
        const playerId = link?.getAttribute('href')?.match(/(?:\/person\/|^\/zawodnicy\/)(\d+)/)?.[1];
        if (!link || !playerId) return [];
        const value = (index: number) => Number(row.cells[index]?.textContent?.trim()) || 0;
        // Minuty "32:55"; bez kolumny minut uznajemy, że zagrał.
        const minutes = mins < 0 ? undefined : (row.cells[mins]?.textContent?.trim() ?? '');
        const played = minutes === undefined || /[1-9]/.test(minutes);
        return [
          {
            playerId,
            player: link.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            team: teams[side],
            opponent: teams[1 - side],
            pts: value(pts),
            reb: value(reb),
            ast: value(ast),
            played,
          },
        ];
      }),
    );
  });
  const date = root.querySelector('.match-header .match-time span')?.textContent?.trim() ?? '';
  return lines.length > 0 ? { savedAt: Date.now(), date, lines } : undefined;
}

// Najlepsze wyniki w każdej kategorii.
export function topRecords(matches: Record<string, MatchLines>, top: number): Record<RecordField, RecordRow[]> {
  const rows: RecordRow[] = Object.entries(matches).flatMap(([matchId, match]) => match.lines.map((line) => ({ ...line, matchId, date: match.date })));
  return Object.fromEntries(
    recordCategories.map(({ key }) => [key, [...rows].sort((a, b) => b[key] - a[key]).filter((row) => row[key] > 0).slice(0, top)]),
  ) as Record<RecordField, RecordRow[]>;
}

export interface RecordsProgress {
  matchIds: string[];
  loaded: number;
  failed: number;
}

// Rozegrane mecze rozgrywek (numery) z terminarza Genius; undefined, gdy terminarz nie przyszedł (przeciążony serwer).
export async function playedMatchIds(cid: number): Promise<string[] | undefined> {
  const schedule = await fetchGeniusPage(`/competition/${cid}/schedule`).catch(() => undefined);
  return schedule?.querySelector('.hs-embed') ? readPlayedMatches(schedule) : undefined;
}

// Box score wskazanych meczów (po PARALLEL naraz); onProgress dostaje stan liczenia. Zwraca odczytane mecze
// i liczbę niedostępnych.
export async function loadBoxScores(cid: number, matchIds: string[], onProgress?: (progress: RecordsProgress) => void) {
  const matches: Record<string, MatchLines> = {};
  let failed = 0;
  const report = () => onProgress?.({ matchIds, loaded: Object.keys(matches).length, failed });
  report();
  const queue = [...matchIds];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const root = await fetchGeniusPage(`/competition/${cid}/match/${id}/boxscore`).catch(() => undefined);
      const found = root && readBoxScore(root);
      if (found) matches[id] = found;
      else failed++;
      report();
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return { matches, failed };
}

// Box score wszystkich rozegranych meczów rozgrywek.
async function loadRecordMatches(cid: number, onProgress?: (progress: RecordsProgress) => void) {
  const matchIds = await playedMatchIds(cid);
  // Bez terminarza nie wiadomo, które mecze liczyć — lepiej nic nie zapisać niż zapisać puste rekordy.
  if (!matchIds) throw new Error('Genius nie zwrócił terminarza — spróbuj przeliczyć za chwilę.');
  return { matchIds, ...(await loadBoxScores(cid, matchIds, onProgress)) };
}

// Przeliczenie w panelu administratora i zapis w bazie.
export async function recomputeRecords(cid: number, onProgress?: (progress: RecordsProgress) => void): Promise<StoredRecords> {
  const { matchIds, matches, failed } = await loadRecordMatches(cid, onProgress);
  const { records } = await adminRequest<{ records: StoredRecords }>('records-save', {
    cid,
    matchCount: matchIds.length - failed,
    failedCount: failed,
    top: topRecords(matches, STORED_TOP),
  });
  return records;
}

export const loadStoredRecords = (cid: number) =>
  adminRequest<{ records: StoredRecords | null }>('records', undefined, { cid: String(cid) }).then((data) => data.records);
