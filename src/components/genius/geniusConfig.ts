// Osadzanie oficjalnych statystyk z Genius Sports (FIBA LiveStats) — ten sam mechanizm co na dalk.pl.
// Skrypt pobiera gotowy HTML z serwera Genius dla organizacji DALK i wstawia go we wskazany element.

import type { LeagueId } from '../../data/league';

export const GENIUS_ORGANIZATION = 'DALK';
export const GENIUS_EMBED_URL = `https://hosted.wh.geniussports.com/embed/?${GENIUS_ORGANIZATION}`;
export const GENIUS_WIDGET_URL = 'https://widget.wh.geniussports.com/widget/';

// Genius wyświetla dane tylko na domenach zarejestrowanych dla organizacji. Serwer sprawdza domenę strony
// (Referer) i dla niezarejestrowanej zwraca stronę "invalidreferrer" — samo dopasowanie subdomeny tu nie wystarcza.
// Ta lista służy tylko do wyboru źródła danych i komunikatu zamiast pustego miejsca poza domeną ligi.
const allowedDomains = ['dalk.pl', 'sportlivepolska.pl'];

export const isGeniusDomain = (hostname = window.location.hostname) =>
  allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

// Źródło danych strony: na domenie ligi elementy Genius, poza nią nasze dane testowe.
// Można to wymusić zmienną VITE_DATA_SOURCE=genius|mock (np. podgląd danych testowych na dev.dalk.pl).
export type DataSource = 'genius' | 'mock';
const forcedSource = import.meta.env.VITE_DATA_SOURCE;
export const dataSource: DataSource = forcedSource === 'genius' || forcedSource === 'mock' ? forcedSource : isGeniusDomain() ? 'genius' : 'mock';

// Edycje DALK w Genius (od najnowszej) i numery rozgrywek poszczególnych lig.
// Liga ma edycję jesienną (np. 2025/26) i wiosenną (np. 2026), każdą z osobnymi rozgrywkami.
export interface GeniusEdition {
  id: string;
  name: string;
  competitions: Partial<Record<LeagueId, number>>;
}

export const geniusEditions: GeniusEdition[] = [
  { id: '2026-27', name: '2026/27', competitions: { eks: 49970, '1': 49974, '2': 50006, '3': 50016 } },
  { id: '2026', name: '2026', competitions: { eks: 48294, '1': 48292, '2': 48291, '3': 48293 } },
  { id: '2025-26', name: '2025/26', competitions: { eks: 42328, '1': 42459, '2': 42460, '3': 42461 } },
  { id: '2025', name: '2025', competitions: { eks: 40641, '1': 40640, '2': 40642, '3': 40666 } },
  { id: '2024-25', name: '2024/25', competitions: { eks: 39633, '1': 39634, '2': 39635, '3': 39636 } },
  { id: '2024', name: '2024', competitions: { eks: 38002, '1': 38003, '2': 38004, '3': 38007 } },
  { id: '2023-24', name: '2023/24', competitions: { eks: 36963, '1': 36964, '2': 36965, '3': 36966 } },
];

export const currentGeniusEdition = geniusEditions[0];
export const geniusEditionById = new Map(geniusEditions.map((edition) => [edition.id, edition]));

export const competitionId = (editionId: string, leagueId: LeagueId) => geniusEditionById.get(editionId)?.competitions[leagueId];

// Odwrotnie: z numeru rozgrywek do edycji i ligi (potrzebne przy przekładaniu linków Genius na nasze filtry).
export function findCompetition(id: number) {
  for (const edition of geniusEditions) {
    for (const [leagueId, cid] of Object.entries(edition.competitions)) {
      if (cid === id) return { editionId: edition.id, leagueId: leagueId as LeagueId };
    }
  }
  return undefined;
}

// Rozgrywki juniorskie (pojawiają się w pasku meczów). Numery z listy rozgrywek DALK w Genius.
export const geniusJuniorCompetitions: Record<string, Record<string, number>> = {
  '2026-27': { U13: 49971, U15: 49972, U17: 49975, U19: 49982 },
};

// Numer rozgrywek z ich nazwy w Genius, np. "2. Liga 2026/27" albo "DALK Junior U15 2026/27".
export function competitionIdByName(name: string): number | undefined {
  const senior = name.match(/^(Ekstraliga|[123]\. Liga) (.+)$/i);
  if (senior) {
    const leagueId: LeagueId = /^ekstraliga$/i.test(senior[1]) ? 'eks' : (senior[1][0] as LeagueId);
    return geniusEditions.find((e) => e.name === senior[2])?.competitions[leagueId];
  }
  const junior = name.match(/Junior (U\d+) (.+)$/i);
  if (junior) {
    const edition = geniusEditions.find((e) => e.name === junior[2]);
    return edition && geniusJuniorCompetitions[edition.id]?.[junior[1].toUpperCase()];
  }
  return undefined;
}

// Widget paska meczów skonfigurowany w panelu Genius (ten sam co na dalk.pl, obejmuje wszystkie ligi).
// Filtr ligi robi nasz pasek (GeniusMatchBar) na podstawie nazwy rozgrywek w kartach.
export const geniusResultsWidgets: Partial<Record<LeagueId | 'all', string>> = {
  all: 'L65TRHI9J4MAGUYV9HYOQO094QLVMS',
};

// Bloki strony liderów odpowiadające kategoriom naszego Top 10.
export const geniusLeaderBlocks = {
  points: 'BLOCK_LEADER_BASKETBALL_sPointsAverage',
  rebounds: 'BLOCK_LEADER_BASKETBALL_sReboundsTotalAverage',
  assists: 'BLOCK_LEADER_BASKETBALL_sAssistsAverage',
} as const;

// Sekcje strony Statystyki (dane wybranych rozgrywek).
export const geniusStatsSections = [
  { slug: 'zawodnicy', label: 'Statystyki zawodników', path: 'statistics/player' },
  { slug: 'druzyny', label: 'Statystyki drużyn', path: 'statistics/team' },
  { slug: 'liderzy', label: 'Liderzy', path: 'leaders' },
] as const;

const leagueQuery = (cid: string) => {
  const found = findCompetition(Number(cid));
  return found ? `?edycja=${found.editionId}&liga=${found.leagueId}` : '';
};

// Linki w treści Genius wskazują strony Genius (np. /competition/49970/team/91563/roster).
// Przekładamy je na nasze adresy, żeby otwierały się w oprawie strony ligi.
export function mapGeniusPath(rawPath: string): string {
  const path = rawPath.replace(/\?+$/, '');

  const entity = path.match(/^\/(?:competition\/(\d+)\/)?(team|person)\/(\d+)(?:\/([a-z]+))?/);
  if (entity) {
    const [, cid, kind, id, section] = entity;
    const params = new URLSearchParams();
    if (cid) params.set('rozgrywki', cid);
    if (section) params.set('sekcja', section);
    const query = params.toString();
    return `/${kind === 'team' ? 'druzyny' : 'zawodnicy'}/${id}${query ? `?${query}` : ''}`;
  }

  const listPage = path.match(/^\/competition\/(\d+)\/(standings|schedule|teams|players|leaders|statistics\/player|statistics\/team)(?:\?(.*))?$/);
  if (listPage) {
    const [, cid, page, query] = listPage;
    // Faza rozgrywek (np. grupa w tabeli: ?phaseName=Grupa A) trafia do naszego parametru "faza".
    const phase = new URLSearchParams(query ?? '').get('phaseName');
    const route = {
      standings: '/tabele',
      schedule: '/terminarz',
      teams: '/druzyny',
      players: '/zawodnicy',
      leaders: '/statystyki/liderzy',
      'statistics/player': '/statystyki/zawodnicy',
      'statistics/team': '/statystyki/druzyny',
    }[page]!;
    const base = route + leagueQuery(cid);
    return phase ? `${base}${base.includes('?') ? '&' : '?'}faza=${encodeURIComponent(phase)}` : base;
  }

  // Pozostałe strony (np. relacja meczu, hala) pokazujemy w ogólnej stronie osadzenia.
  return `/genius?WHurl=${encodeURIComponent(path)}`;
}

declare global {
  interface Window {
    [key: `spilWHH${string}`]: Record<string, unknown> | undefined;
    [key: `spw_${string}`]: Record<string, unknown> | undefined;
  }
}
