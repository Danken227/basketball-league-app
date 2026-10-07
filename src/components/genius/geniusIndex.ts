// Indeks rozgrywek: w których rozgrywkach (edycja × liga) występuje dana drużyna albo zawodnik.
// Genius nie ma zestawienia "w jakich edycjach grała drużyna / zawodnik", więc budujemy je z list drużyn
// i zawodników poszczególnych rozgrywek (GeniusIndexLoader, po jednym zapytaniu naraz) i trzymamy
// w localStorage przez dobę, żeby nie obciążać serwera Genius przy każdym wejściu.
// Osobno zapisujemy, czy zawodnik faktycznie zagrał w rozgrywkach (być w składzie to nie to samo co zagrać mecz).

import type { LeagueId } from '../../data/league';
import { geniusEditions } from './geniusConfig';

export type IndexKind = 'teams' | 'players';

interface StoredIndex {
  savedAt: number;
  // Klucz "<rodzaj>:<numer rozgrywek>" → numery drużyn albo zawodników z listy tych rozgrywek.
  lists: Record<string, string[]>;
  // Klucz "<zawodnik>:<numer rozgrywek>" → czy zawodnik ma w tych rozgrywkach jakiekolwiek występy.
  played: Record<string, boolean>;
  // Klucz "<zawodnik>:<numer rozgrywek>" → drużyny zawodnika w tych rozgrywkach (z jego statystyk).
  teams?: Record<string, PersonTeam[]>;
  // Numer drużyny → nazwa (z list drużyn). Strona drużyny bez logo nie ma w nagłówku Genius nazwy
  // (bierzemy ją zwykle z opisu logo), więc wtedy podpowiada ją indeks.
  teamNames?: Record<string, string>;
}

export interface PersonTeam {
  name: string;
  href?: string;
}

// Wersja w nazwie: zmiana odrzuca indeksy zapisane wcześniej (v1 mógł zawierać skutki awarii Genius — puste listy
// i fałszywe "nie grał").
const STORAGE_KEY = 'genius-index-v2';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function load(): StoredIndex {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredIndex | null;
    if (stored && Date.now() - stored.savedAt < MAX_AGE_MS) {
      // Trwale trzymamy tylko "grał" (patrz savePlayed) — starsze zapisy "nie grał" odrzucamy.
      stored.played = Object.fromEntries(Object.entries(stored.played).filter(([, played]) => played));
      return stored;
    }
  } catch {
    // Uszkodzony albo niedostępny localStorage — zaczynamy od pustego indeksu.
  }
  return { savedAt: Date.now(), lists: {}, played: {} };
}

const index = load();
let version = 0;
const listeners = new Set<() => void>();
// Rozgrywki, których listy nie udało się wczytać w tej wizycie (pomijamy je, żeby indeks nie stanął).
const failed = new Set<string>();

function changed() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
  } catch {
    // Brak miejsca — indeks zostaje w pamięci strony.
  }
  version++;
  listeners.forEach((listener) => listener());
}

export const subscribeIndex = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const indexVersion = () => version;

// Wszystkie rozgrywki lig seniorskich ze wszystkich edycji, od najnowszej.
export const indexedCompetitions = geniusEditions.flatMap((edition) =>
  (Object.entries(edition.competitions) as [LeagueId, number][]).map(([leagueId, cid]) => ({ cid, editionId: edition.id, leagueId })),
);

export const competitionInfo = (cid: number) => indexedCompetitions.find((c) => c.cid === cid);

export function saveList(kind: IndexKind, cid: number, ids: string[]) {
  // Pusta lista to prawie zawsze pusta odpowiedź Genius (np. przy awarii) — nie zapamiętujemy jej na dobę;
  // GeniusIndexLoader po limicie czasu pominie te rozgrywki tylko w bieżącej wizycie.
  if (ids.length === 0) return;
  index.lists[`${kind}:${cid}`] = ids;
  changed();
}

export function markFailed(kind: IndexKind, cid: number) {
  failed.add(`${kind}:${cid}`);
  version++;
  listeners.forEach((listener) => listener());
}

// Rozgrywki, których lista jeszcze nie jest w indeksie (w kolejności od najnowszej edycji).
export const pendingCompetitions = (kind: IndexKind) =>
  indexedCompetitions.filter(({ cid }) => !(`${kind}:${cid}` in index.lists) && !failed.has(`${kind}:${cid}`)).map(({ cid }) => cid);

// Rozgrywki, na których listach jest dana drużyna albo zawodnik.
export const competitionsWith = (kind: IndexKind, id: string) =>
  indexedCompetitions.filter(({ cid }) => index.lists[`${kind}:${cid}`]?.includes(id)).map(({ cid }) => cid);

// "Grał" zapamiętujemy na dobę, a "nie grał" tylko do odświeżenia strony: przy awarii Genius potrafi zwracać
// "No results" nawet dla zawodników z występami i taki błąd nie może zostać w indeksie na cały dzień.
const notPlayed = new Set<string>();

export function savePlayed(personId: string, cid: number, played: boolean) {
  const key = `${personId}:${cid}`;
  if (!played) {
    if (notPlayed.has(key) || index.played[key] === true) return;
    notPlayed.add(key);
    version++;
    listeners.forEach((listener) => listener());
    return;
  }
  notPlayed.delete(key);
  if (index.played[key] === true) return;
  index.played[key] = true;
  changed();
}

export const playedIn = (personId: string, cid: number): boolean | undefined => {
  const key = `${personId}:${cid}`;
  return index.played[key] ?? (notPlayed.has(key) ? false : undefined);
};

export function savePersonTeams(personId: string, cid: number, teams: PersonTeam[]) {
  const key = `${personId}:${cid}`;
  index.teams ??= {};
  if (JSON.stringify(index.teams[key]) === JSON.stringify(teams)) return;
  index.teams[key] = teams;
  changed();
}

export const personTeams = (personId: string, cid: number): PersonTeam[] | undefined => index.teams?.[`${personId}:${cid}`];

// Drużyny z linków w treści Genius (/druzyny/<numer>) — tylko linki z nazwą (bez samych logo).
export function readTeamLinks(root: ParentNode): [string, string][] {
  return [...root.querySelectorAll('a[href]')].flatMap((link) => {
    const id = link.getAttribute('href')!.match(/^\/druzyny\/(\d+)/)?.[1];
    const name = link.textContent?.trim();
    return id && name ? [[id, name] as [string, string]] : [];
  });
}

export function saveTeamNames(entries: [string, string][]) {
  index.teamNames ??= {};
  const names = index.teamNames;
  const fresh = entries.filter(([id, name]) => names[id] !== name);
  if (fresh.length === 0) return;
  fresh.forEach(([id, name]) => (names[id] = name));
  changed();
}

export const teamName = (id: string): string | undefined => index.teamNames?.[id];
