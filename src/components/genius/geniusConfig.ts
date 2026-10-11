// Oficjalne statystyki z Genius Sports (FIBA LiveStats). Gotowy HTML z serwera Genius dla organizacji ligi pobieramy
// wprost (geniusFetch) i wstawiamy we wskazany element (GeniusEmbed). Identyfikatory ligi (organizacja, domeny,
// edycje i rozgrywki, widget) są w konfiguracji klienta (clients/<klient>/client.ts).

import client from '@client/client';
import type { GeniusEdition } from '../../clientConfig';
import { leagues, type LeagueId } from '../../data/league';

export type { GeniusEdition };

export const GENIUS_ORGANIZATION = client.genius.organization;
export const GENIUS_WIDGET_URL = 'https://widget.wh.geniussports.com/widget/';

// Genius wyświetla dane tylko na domenach zarejestrowanych dla organizacji. Serwer sprawdza domenę strony
// (Referer) i dla niezarejestrowanej zwraca stronę "invalidreferrer" — samo dopasowanie subdomeny tu nie wystarcza.
// Ta lista służy tylko do wyboru źródła danych i komunikatu zamiast pustego miejsca poza domeną ligi.
const allowedDomains = client.genius.allowedDomains;

export const isGeniusDomain = (hostname = window.location.hostname) =>
  allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

// Źródło danych strony: na domenie ligi elementy Genius na żywo, poza nią nasze dane testowe (wymyślone drużyny).
// Zmienna VITE_DATA_SOURCE=genius|snapshot|mock wymusza źródło; "snapshot" to migawka danych Genius (zapisane treści
// bieżącej edycji, geniusSnapshot.ts) — wersja demonstracyjna budowana z clients/<klient>/public/snapshot, którego nie ma w repozytorium.
export type DataSource = 'genius' | 'snapshot' | 'mock';
const forcedSource = import.meta.env.VITE_DATA_SOURCE;
export const dataSource: DataSource =
  forcedSource === 'genius' || forcedSource === 'snapshot' || forcedSource === 'mock' ? forcedSource : isGeniusDomain() ? 'genius' : 'mock';
export const geniusSnapshot = dataSource === 'snapshot';

// Pełne polskie tłumaczenie treści Genius (geniusI18n): VITE_GENIUS_TRANSLATION=pl (np. w .env.local).
// Domyślnie treść zostaje po angielsku, z polskimi tylko nazwami tabel statystyk i datami meczów drużyny.
export const geniusTranslation = import.meta.env.VITE_GENIUS_TRANSLATION === 'pl';

// Edycje ligi w Genius (od najnowszej) i numery rozgrywek poszczególnych lig.
const allEditions: GeniusEdition[] = client.genius.editions;

// Migawka obejmuje tylko bieżącą edycję, więc w niej filtry nie proponują innych.
export const geniusEditions = geniusSnapshot ? allEditions.slice(0, 1) : allEditions;

export const currentGeniusEdition = geniusEditions[0];
export const geniusEditionById = new Map(geniusEditions.map((edition) => [edition.id, edition]));

// Poziom rozgrywek w filtrach stron Genius: ligi seniorów i każda kategoria juniorów osobno (parametr ?liga=U17).
export type GeniusLeagueId = LeagueId | JuniorCategory;

const isJunior = (leagueId: string): leagueId is JuniorCategory => (juniorCategories as readonly string[]).includes(leagueId);

export const competitionId = (editionId: string, leagueId: GeniusLeagueId) =>
  isJunior(leagueId) ? geniusJuniorCompetitions[editionId]?.[leagueId] : geniusEditionById.get(editionId)?.competitions[leagueId];

// Odwrotnie: z numeru rozgrywek do edycji i ligi (potrzebne przy przekładaniu linków Genius na nasze filtry).
// Rozgrywki edycji: ligi seniorów i kategorie juniorów (numery Genius).
export function editionCompetitionIds(editionId: string): number[] {
  const edition = geniusEditionById.get(editionId);
  return edition ? Object.values({ ...edition.competitions, ...geniusJuniorCompetitions[editionId] }).filter((cid) => cid !== undefined) : [];
}

export function findCompetition(id: number): { editionId: string; leagueId: GeniusLeagueId } | undefined {
  for (const edition of geniusEditions) {
    const all = { ...edition.competitions, ...geniusJuniorCompetitions[edition.id] };
    for (const [leagueId, cid] of Object.entries(all)) {
      if (cid === id) return { editionId: edition.id, leagueId: leagueId as GeniusLeagueId };
    }
  }
  return undefined;
}

// Rozgrywki juniorskie, osobno dla każdej kategorii wiekowej (pasek meczów, tabela i Top 10 strony głównej).
// Kolejność na listach wyboru: od najstarszych.
export const juniorCategories = ['U19', 'U17', 'U15', 'U13'] as const;
export type JuniorCategory = (typeof juniorCategories)[number];

// Lista poziomów do filtra "Poziom rozgrywek" (najpierw ligi, potem juniorzy od najstarszych).
export const geniusLeagueOptions: { value: GeniusLeagueId; label: string }[] = [
  ...leagues.map((league) => ({ value: league.id as GeniusLeagueId, label: league.name })),
  ...juniorCategories.map((category) => ({ value: category as GeniusLeagueId, label: `Junior ${category}` })),
];

export const isGeniusLeagueId = (value: string): value is GeniusLeagueId => geniusLeagueOptions.some((option) => option.value === value);
export const geniusLeagueName = (leagueId: GeniusLeagueId) => geniusLeagueOptions.find((option) => option.value === leagueId)?.label ?? leagueId;

export const geniusJuniorCompetitions: Record<string, Partial<Record<JuniorCategory, number>>> = client.genius.juniorCompetitions;

// Numer rozgrywek z ich nazwy w Genius, np. "2. Liga 2026/27" albo "<organizacja> Junior U15 2026/27".
export function competitionIdByName(name: string): number | undefined {
  const senior = name.match(/^(Ekstraliga|[123]\. Liga) (.+)$/i);
  if (senior) {
    const leagueId: LeagueId = /^ekstraliga$/i.test(senior[1]) ? 'eks' : (senior[1][0] as LeagueId);
    return geniusEditions.find((e) => e.name === senior[2])?.competitions[leagueId];
  }
  const junior = name.match(/Junior (U\d+) (.+)$/i);
  if (junior) {
    const edition = geniusEditions.find((e) => e.name === junior[2]);
    return edition && geniusJuniorCompetitions[edition.id]?.[junior[1].toUpperCase() as JuniorCategory];
  }
  return undefined;
}

// Widget paska meczów skonfigurowany w panelu Genius (konfiguracja klienta).
// Filtr ligi robi nasz pasek (GeniusMatchBar) na podstawie nazwy rozgrywek w kartach.
export const geniusResultsWidgets: Partial<Record<LeagueId | 'all', string>> = client.genius.resultsWidgets;

// Sekcje strony Statystyki (dane wybranych rozgrywek).
export const geniusStatsSections = [
  { slug: 'zawodnicy', label: 'Statystyki zawodników', path: 'statistics/player' },
  { slug: 'druzyny', label: 'Statystyki drużyn', path: 'statistics/team' },
  { slug: 'liderzy', label: 'Liderzy', path: 'leaders' },
  // Rekordy (najwyższe zdobycze w meczu) liczymy sami ze statystyk meczów — Genius nie ma takiej strony.
  { slug: 'rekordy', label: 'Rekordy', path: '' },
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

  // Mecz (podsumowanie, box score, play by play, shot chart…) → nasza strona meczu.
  const match = path.match(/^\/competition\/(\d+)\/match\/(\d+)(?:\/([a-z]+))?/);
  if (match) {
    const [, cid, matchId, section] = match;
    return `/mecze/${matchId}?rozgrywki=${cid}${section ? `&sekcja=${section}` : ''}`;
  }

  // Pozostałe strony (np. hala) pokazujemy w ogólnej stronie osadzenia.
  return `/genius?WHurl=${encodeURIComponent(path)}`;
}

declare global {
  interface Window {
    [key: `spilWHH${string}`]: Record<string, unknown> | undefined;
    [key: `spw_${string}`]: Record<string, unknown> | undefined;
    // jQuery, którego wymagają skrypty Genius, i ich znacznik "jQuery już się wczytuje".
    jQuery?: unknown;
    _loadingjq?: number;
  }
}
