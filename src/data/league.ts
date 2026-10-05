// Deterministyczne dane testowe w układzie rozgrywek jak na dalk.pl:
// Ekstraliga (jedna tabela) oraz 1., 2. i 3. Liga podzielone na grupy, w kilku edycjach.
// Między edycjami są awanse i spadki, nowe i rozwiązane zespoły oraz transfery zawodników.
// Nazwy zespołów, zawodników i wyniki są fikcyjne.

export type LeagueId = 'eks' | '1' | '2' | '3';

export interface Season {
  id: string;
  name: string;
  start: Date;
}

export interface League {
  id: LeagueId;
  name: string;
  short: string;
  // Pusta lista oznacza jedną tabelę bez podziału na grupy.
  groups: string[];
  // Liczba miejsc premiowanych awansem i spadkiem w każdej tabeli.
  promotion: number;
  relegation: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface TeamSeason {
  seasonId: string;
  teamId: string;
  leagueId: LeagueId;
  group: string;
  strength: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number;
  height: number;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  scoring: number;
  rebounding: number;
  passing: number;
}

export interface RosterEntry {
  seasonId: string;
  teamId: string;
  playerId: string;
  number: number;
}

export interface PlayerLine {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
}

export interface Match {
  id: string;
  seasonId: string;
  leagueId: LeagueId;
  group: string;
  round: number;
  date: Date;
  venue: string;
  homeId: string;
  awayId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  overtime?: boolean;
  box?: PlayerLine[];
}

export type FormResult = 'W' | 'P';

export interface StandingRow {
  team: Team;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  tablePoints: number;
  // Bilans wszystkich meczów zespołu we wszystkich edycjach (do końca wybranej edycji).
  allWins: number;
  allLosses: number;
  // Ostatnie 10 meczów, od najstarszego do najnowszego.
  form: FormResult[];
}

export type StatCategory = 'points' | 'rebounds' | 'assists';

export interface PlayerStatRow {
  player: Player;
  team: Team;
  games: number;
  total: number;
  average: number;
}

export interface SeasonPlayer {
  player: Player;
  team: Team;
  teamSeason: TeamSeason;
  number: number;
}

export interface CareerRow {
  season: Season;
  team: Team;
  league: League;
  group: string;
  number: number;
  games: number;
  points: number;
  rebounds: number;
  assists: number;
}

// Generator pseudolosowy z ziarnem, żeby dane były takie same przy każdym uruchomieniu.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261005);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const seasons: Season[] = [
  { id: '2024-25', name: '2024/25', start: new Date(2024, 8, 7) },
  { id: '2025-26', name: '2025/26', start: new Date(2025, 8, 6) },
  { id: '2026-27', name: '2026/27', start: new Date(2026, 8, 5) },
];

export const currentSeason = seasons[seasons.length - 1];
export const seasonById = new Map(seasons.map((season) => [season.id, season]));

export const leagues: League[] = [
  { id: 'eks', name: 'Ekstraliga', short: 'EKS', groups: [], promotion: 0, relegation: 2 },
  { id: '1', name: '1. Liga', short: '1L', groups: ['A', 'B'], promotion: 1, relegation: 2 },
  { id: '2', name: '2. Liga', short: '2L', groups: ['A', 'B', 'C', 'D'], promotion: 1, relegation: 1 },
  { id: '3', name: '3. Liga', short: '3L', groups: ['A', 'B', 'C', 'D', 'E'], promotion: 1, relegation: 0 },
];

export const leagueById = new Map(leagues.map((league) => [league.id, league]));

// Zespoły bieżącej edycji per liga i grupa (klucz '' = liga bez grup). Liczebności jak w sezonie 2026/27 na dalk.pl.
const currentTeamNames: Record<LeagueId, Record<string, string[]>> = {
  eks: {
    '': [
      'Odra Hoops Wrocław', 'Kompresor Basket Team', 'Hydro-Tech Legnica', 'Bystrzyca Ballers', 'Ortomed Klinika Sportu',
      'Night Owls', 'Karkonosze Jelenia Góra', 'Strefa Rzutu', 'Mostostal Basket', 'Black Panthers',
    ],
  },
  '1': {
    A: [
      'Zielone Mamby', 'Panorama Oleśnica', 'Kobierzyce Kings', 'Fiksacja Team', 'Stare Wygi',
      'Wyspa Słodowa', 'AutoSerwis Krzyki', 'Basket Brzeg Dolny', 'Dzikie Koty',
    ],
    B: [
      'Trzebnica Titans', 'Sokoły Sobótka', 'Krzywe Obręcze', 'Psie Pole Dream Team', 'Kruki Kłodzko',
      'Fizjo-Med Basket', 'Ostatnia Kwarta', 'Brochów Bulls', 'Black Panthers II',
    ],
  },
  '2': {
    A: ['Żubry Środa Śląska', 'Biskupin Basket', 'Leniwe Lisy', 'Drewnex Team', 'Odra Hoops II', 'Smocza Jama', 'Twardy Dzwon', 'Nowy Dwór Ballers'],
    B: ['Ślęża Squad', 'Baseny Bielany', 'Lotnicy Strachowice', 'Rzuty Wolne', 'Fiksacja Team II', 'Gryfy Oława', 'Milicz Basket'],
    C: ['Wołów Warriors', 'Magazyn 44', 'Las Osobowicki', 'Karkonosze II', 'Ultra Kangury', 'PoloBud Basket', 'Rakiety Ząbkowice', 'Orbita Boys'],
    D: ['Zachodni Wiatr', 'Kowale Team', 'Strzegom Stones', 'Szybkie Żółwie', 'Mostostal II', 'Galaktyka Gądów', 'KS Długołęka', 'Pantery z Partynic'],
  },
  '3': {
    A: ['Dzikie Koty II', 'Lubin Lumberjacks', 'Polana Basket', 'Bezdomne Piłki', 'Koszmarni Kumple', 'Sępy Siechnice', 'Żelazne Kolana', 'Opór Powietrza'],
    B: ['Studio Kadr', 'Jelcz Jets', 'Kozanów Crew', 'Trzecia Połowa', 'Zmęczeni Ojcowie', 'Bobry Bierutów', 'Spóźnieni o Sekundę', 'Strefa Rzutu II'],
    C: ['Wilki Wiszni Małej', 'Gaj Basket', 'Na Desce', 'Polar Bears Polkowice', 'Lwy Lwówek', 'Mydlany Rzut', 'Zgorzelec Hoops'],
    D: ['Oporów Owls', 'Kotwica Głogów', 'Ludzie z Pasją', 'Sołtysowice Squad', 'Wrocławskie Wydry', 'Kangury Kąty', 'Rozgrywający', 'Pompki Team'],
    E: ['Kamieńczyk Kings', 'Zakręt Basket', 'Ostatni Gwizdek', 'Bażanty Bolesławiec', 'Czarna Owca', 'Gips & Basket', 'Nysa Nightriders'],
  },
};

// Zespoły, które grały we wcześniejszych edycjach, ale już się nie zgłosiły.
const formerTeamNames = [
  'Stalowe Kosze', 'Akademia Rzutu', 'Wiewiórki Wilczyce', 'Retro Ballers', 'Dziesiątka Team', 'Zorza Basket',
  'Szaraki Strzelin', 'Flota Brzeg', 'Wichura Wołów', 'Kosz i Spółka',
];

const teamColors = ['#f97316', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#0d9488'];

const firstNames = [
  'Jakub', 'Kacper', 'Mateusz', 'Michał', 'Piotr', 'Tomasz', 'Bartosz', 'Krzysztof', 'Paweł', 'Adam',
  'Łukasz', 'Marcin', 'Filip', 'Szymon', 'Wojciech', 'Dawid', 'Kamil', 'Maciej', 'Grzegorz', 'Rafał',
  'Igor', 'Oskar', 'Hubert', 'Dominik', 'Patryk', 'Jan', 'Antoni', 'Wiktor', 'Artur', 'Sebastian',
  'Damian', 'Konrad', 'Przemysław', 'Daniel', 'Arkadiusz', 'Robert', 'Mikołaj', 'Norbert',
] as const;

const lastNames = [
  'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski', 'Zieliński',
  'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk',
  'Piotrowski', 'Grabowski', 'Nowakowski', 'Pawłowski', 'Michalski', 'Adamczyk', 'Dudek', 'Zając',
  'Wieczorek', 'Jabłoński', 'Król', 'Majewski', 'Olszewski', 'Jaworski', 'Malinowski', 'Stępień',
  'Górski', 'Witkowski', 'Walczak', 'Sikora', 'Baran', 'Rutkowski', 'Michalak', 'Szewczyk', 'Ostrowski', 'Tomaszewski',
  'Bielecki', 'Czarnecki', 'Fijałkowski', 'Gajewski', 'Hołownia', 'Ignaczak', 'Łuczak', 'Nowicki', 'Pietrzak', 'Sowa',
] as const;

const positions: Player['position'][] = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PG'];
export const positionNames: Record<Player['position'], string> = {
  PG: 'Rozgrywający', SG: 'Rzucający obrońca', SF: 'Niski skrzydłowy', PF: 'Silny skrzydłowy', C: 'Środkowy',
};

const heightRange: Record<Player['position'], [number, number]> = {
  PG: [172, 188], SG: [178, 194], SF: [184, 200], PF: [190, 205], C: [195, 212],
};

const venues = ['Hala SP 12', 'Hala Sportowa Północ', 'Hala MOSiR Zachód', 'Hala Akademicka'];

// Liga wyżej to średnio mocniejsze zespoły.
const leagueLevel: Record<LeagueId, number> = { eks: 6, '1': 3, '2': 0, '3': -3 };

// --- Zespoły i ich miejsce w lidze w kolejnych edycjach ---

export const teams: Team[] = [];
const newTeam = (name: string): Team => {
  const team = { id: `t${teams.length + 1}`, name, color: teamColors[(teams.length * 3) % teamColors.length] };
  teams.push(team);
  return team;
};

const placements = new Map<string, TeamSeason[]>();

placements.set(
  currentSeason.id,
  leagues.flatMap((league) =>
    Object.entries(currentTeamNames[league.id]).flatMap(([group, names]) =>
      names.map((name) => ({
        seasonId: currentSeason.id,
        teamId: newTeam(name).id,
        leagueId: league.id,
        group,
        strength: between(0.2, 0.8),
      })),
    ),
  ),
);

const formerTeams = formerTeamNames.map(newTeam);

// Poprzednia edycja powstaje z następnej: kilka zespołów jest nowych (wcześniej w ich miejscu grał
// zespół, który już się nie zgłosił), a między sąsiednimi ligami wymieniamy po dwa zespoły (awanse i spadki).
function previousPlacement(next: TeamSeason[], seasonId: string): TeamSeason[] {
  const entries = next.map((e) => ({ ...e, seasonId, strength: clamp(e.strength + between(-0.12, 0.12), 0.15, 0.85) }));

  for (let k = 0; k < 4 && formerTeams.length; k++) {
    const candidates = entries.map((e, i) => [e, i] as const).filter(([e]) => e.leagueId === '2' || e.leagueId === '3');
    const [, index] = pick(candidates);
    entries[index] = { ...entries[index], teamId: formerTeams.pop()!.id, strength: between(0.2, 0.8) };
  }

  // Każdy zespół zmienia ligę najwyżej o jeden poziom na edycję.
  const order: LeagueId[] = ['eks', '1', '2', '3'];
  const moved = new Set<TeamSeason>();
  for (let i = 0; i < order.length - 1; i++) {
    for (let k = 0; k < 2; k++) {
      const upper = pick(entries.filter((e) => e.leagueId === order[i] && !moved.has(e)));
      const lower = pick(entries.filter((e) => e.leagueId === order[i + 1] && !moved.has(e)));
      moved.add(upper).add(lower);
      [upper.leagueId, upper.group, lower.leagueId, lower.group] = [lower.leagueId, lower.group, upper.leagueId, upper.group];
    }
  }
  return entries;
}

for (let s = seasons.length - 2; s >= 0; s--) {
  placements.set(seasons[s].id, previousPlacement(placements.get(seasons[s + 1].id)!, seasons[s].id));
}

export const teamById = new Map(teams.map((team) => [team.id, team]));

export function getPlacement(seasonId: string): TeamSeason[] {
  return placements.get(seasonId) ?? [];
}

export function getTeamSeason(seasonId: string, teamId: string) {
  return getPlacement(seasonId).find((e) => e.teamId === teamId);
}

// Edycje, w których zespół grał, od najstarszej.
export function getTeamSeasons(teamId: string) {
  return seasons.filter((season) => getTeamSeason(season.id, teamId));
}

export function getSeasonTeams(seasonId: string, leagueId: LeagueId, group?: string) {
  return getPlacement(seasonId)
    .filter((e) => e.leagueId === leagueId && (group === undefined || e.group === group))
    .map((e) => ({ team: teamById.get(e.teamId)!, teamSeason: e }));
}

// --- Zawodnicy i składy ---

export const players: Player[] = [];
const rosters = new Map<string, RosterEntry[]>();
const rosterKey = (seasonId: string, teamId: string) => `${seasonId}|${teamId}`;

function newPlayer(position: Player['position']): Player {
  const isBig = position === 'PF' || position === 'C';
  const isGuard = position === 'PG' || position === 'SG';
  const [minHeight, maxHeight] = heightRange[position];
  const player: Player = {
    id: `p${players.length + 1}`,
    firstName: pick(firstNames),
    lastName: pick(lastNames),
    birthYear: Math.floor(between(1978, 2007)),
    height: Math.round(between(minHeight, maxHeight)),
    position,
    scoring: between(0.4, 1.6),
    rebounding: between(0.4, 1) * (isBig ? 2 : 0.8),
    passing: between(0.4, 1) * (position === 'PG' ? 2.4 : isGuard ? 1.2 : 0.7),
  };
  players.push(player);
  return player;
}

function addToRoster(seasonId: string, teamId: string, playerId: string, preferredNumber?: number) {
  const key = rosterKey(seasonId, teamId);
  const roster = rosters.get(key) ?? [];
  const used = new Set(roster.map((r) => r.number));
  let number = preferredNumber ?? Math.floor(between(0, 100));
  while (used.has(number)) number = Math.floor(between(0, 100));
  roster.push({ seasonId, teamId, playerId, number });
  rosters.set(key, roster);
}

// Bieżąca edycja: amatorskie składy mają od 8 do 12 zawodników.
for (const entry of getPlacement(currentSeason.id)) {
  const size = 8 + Math.floor(between(0, 5));
  positions.slice(0, size).forEach((position) => addToRoster(currentSeason.id, entry.teamId, newPlayer(position).id));
}

// Wcześniejsze edycje: większość zawodników grała w tym samym zespole, część przeszła z innego,
// a reszta to zawodnicy, którzy później zakończyli grę w lidze.
for (let s = seasons.length - 2; s >= 0; s--) {
  const seasonId = seasons[s].id;
  const nextId = seasons[s + 1].id;
  const prev = getPlacement(seasonId);
  const prevTeamIds = new Set(prev.map((e) => e.teamId));

  for (const entry of getPlacement(nextId)) {
    for (const r of rosters.get(rosterKey(nextId, entry.teamId)) ?? []) {
      const roll = rand();
      if (prevTeamIds.has(entry.teamId) && roll < 0.75) {
        addToRoster(seasonId, entry.teamId, r.playerId, r.number);
      } else if (roll < 0.87) {
        const other = pick(prev.filter((e) => e.teamId !== entry.teamId));
        if ((rosters.get(rosterKey(seasonId, other.teamId))?.length ?? 0) < 12) addToRoster(seasonId, other.teamId, r.playerId, r.number);
      }
    }
  }

  for (const entry of prev) {
    const size = 8 + Math.floor(between(0, 5));
    while ((rosters.get(rosterKey(seasonId, entry.teamId))?.length ?? 0) < size) {
      addToRoster(seasonId, entry.teamId, newPlayer(pick(positions)).id);
    }
  }
}

export const playerById = new Map(players.map((player) => [player.id, player]));

export function getRoster(seasonId: string, teamId: string) {
  return rosters.get(rosterKey(seasonId, teamId)) ?? [];
}

// --- Terminarz i wyniki ---

// Algorytm "kołowy": każdy z każdym raz. Przy nieparzystej liczbie zespołów jeden pauzuje w kolejce.
function roundRobin(ids: string[]): [string, string][][] {
  const order: (string | null)[] = ids.length % 2 ? [...ids, null] : [...ids];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < order.length - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < order.length / 2; i++) {
      const a = order[i];
      const b = order[order.length - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    order.splice(1, 0, order.pop()!);
  }
  return rounds;
}

// Rozdziela sumę drużyny między zawodników proporcjonalnie do ich wag.
function distribute(total: number, weights: number[]): number[] {
  const noisy = weights.map((w) => w * between(0.4, 1.6));
  const sum = noisy.reduce((a, b) => a + b, 0);
  const values = noisy.map((w) => Math.floor((w / sum) * total));
  let rest = total - values.reduce((a, b) => a + b, 0);
  const byWeight = noisy.map((w, i) => [w, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % values.length, rest--) values[byWeight[k][1]]++;
  return values;
}

function boxScore(seasonId: string, teamId: string, score: number): PlayerLine[] {
  const roster = getRoster(seasonId, teamId).map((r) => playerById.get(r.playerId)!);
  const points = distribute(score, roster.map((p) => p.scoring));
  const rebounds = distribute(Math.round(between(30, 46)), roster.map((p) => p.rebounding));
  const assists = distribute(Math.round(between(9, 22)), roster.map((p) => p.passing));
  return roster.map((p, i) => ({ playerId: p.id, points: points[i], rebounds: rebounds[i], assists: assists[i] }));
}

const now = new Date();

export const matches: Match[] = [];

for (const season of seasons) {
  const placement = getPlacement(season.id);
  // Licznik terminów w weekendzie wspólny dla wszystkich lig, żeby mecze nie nakładały się w halach.
  const slotsUsed = new Map<number, number>();
  for (const league of leagues) {
    const groups = league.groups.length ? league.groups : [''];
    const rounds = new Map<number, { group: string; homeId: string; awayId: string }[]>();
    for (const group of groups) {
      const ids = placement.filter((e) => e.leagueId === league.id && e.group === group).map((e) => e.teamId);
      roundRobin(ids).forEach((pairs, r) => {
        const list = rounds.get(r) ?? [];
        list.push(...pairs.map(([homeId, awayId]) => ({ group, homeId, awayId })));
        rounds.set(r, list);
      });
    }

    rounds.forEach((games, roundIndex) => {
      games.forEach(({ group, homeId, awayId }, index) => {
        const slot = slotsUsed.get(roundIndex) ?? 0;
        slotsUsed.set(roundIndex, slot + 1);
        // Sobota/niedziela na zmianę, 4 hale, kolejne bloki dwugodzinne od 10:00.
        const date = new Date(
          season.start.getFullYear(),
          season.start.getMonth(),
          season.start.getDate() + roundIndex * 7 + (slot % 2),
          10 + 2 * Math.floor(slot / 8),
        );
        const match: Match = {
          id: `${season.id}-${league.id}${group}-${roundIndex + 1}-${index + 1}`,
          seasonId: season.id,
          leagueId: league.id,
          group,
          round: roundIndex + 1,
          date,
          venue: venues[Math.floor(slot / 2) % venues.length],
          homeId,
          awayId,
          played: date < now,
        };

        if (match.played) {
          const strength = (id: string) => placement.find((e) => e.teamId === id)!.strength;
          const base = 68 + leagueLevel[league.id];
          let homeScore = Math.round(base + (strength(homeId) - 0.5) * 24 + 2 + between(-12, 12));
          let awayScore = Math.round(base + (strength(awayId) - 0.5) * 24 + between(-12, 12));
          if (homeScore === awayScore) {
            match.overtime = true;
            if (rand() < 0.5) homeScore += Math.round(between(3, 9));
            else awayScore += Math.round(between(3, 9));
          }
          match.homeScore = homeScore;
          match.awayScore = awayScore;
          match.box = [...boxScore(season.id, homeId, homeScore), ...boxScore(season.id, awayId, awayScore)];
        }
        matches.push(match);
      });
    });
  }
}

matches.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));

export function getMatches(seasonId: string, leagueId: LeagueId) {
  return matches.filter((m) => m.seasonId === seasonId && m.leagueId === leagueId);
}

// --- Tabele i statystyki ---

const playedByTeam = new Map<string, Match[]>();
for (const match of matches) {
  if (!match.played) continue;
  for (const id of [match.homeId, match.awayId]) playedByTeam.set(id, [...(playedByTeam.get(id) ?? []), match]);
}

const teamWon = (match: Match, teamId: string) =>
  match.homeId === teamId ? match.homeScore! > match.awayScore! : match.awayScore! > match.homeScore!;

// Tabela: 2 pkt za zwycięstwo, 1 pkt za porażkę (zasady FIBA).
export function getStandings(leagueId: LeagueId, group = '', seasonId = currentSeason.id): StandingRow[] {
  const seasonMatches = matches.filter((m) => m.seasonId === seasonId && m.leagueId === leagueId && m.group === group && m.played);
  const cutoff = Math.max(0, ...seasonMatches.map((m) => m.date.getTime()));

  const rows = getSeasonTeams(seasonId, leagueId, group).map(({ team }) => {
    const history = (playedByTeam.get(team.id) ?? []).filter((m) => m.date.getTime() <= cutoff);
    const row: StandingRow = {
      team, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, tablePoints: 0,
      allWins: history.filter((m) => teamWon(m, team.id)).length,
      allLosses: history.filter((m) => !teamWon(m, team.id)).length,
      form: history.slice(-10).map((m) => (teamWon(m, team.id) ? 'W' : 'P')),
    };
    for (const m of seasonMatches) {
      if (m.homeId !== team.id && m.awayId !== team.id) continue;
      const home = m.homeId === team.id;
      const won = teamWon(m, team.id);
      row.played++;
      row.pointsFor += home ? m.homeScore! : m.awayScore!;
      row.pointsAgainst += home ? m.awayScore! : m.homeScore!;
      if (won) row.wins++;
      else row.losses++;
      row.tablePoints += won ? 2 : 1;
    }
    return row;
  });

  return rows.sort(
    (a, b) =>
      b.tablePoints - a.tablePoints ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
      b.pointsFor - a.pointsFor,
  );
}

export function getTopPlayers(category: StatCategory, leagueId: LeagueId | 'all', limit = 10, seasonId = currentSeason.id): PlayerStatRow[] {
  const totals = new Map<string, { games: number; total: number; teamId: string }>();
  for (const match of matches) {
    if (!match.box || match.seasonId !== seasonId || (leagueId !== 'all' && match.leagueId !== leagueId)) continue;
    match.box.forEach((line, i) => {
      const entry = totals.get(line.playerId) ?? { games: 0, total: 0, teamId: '' };
      entry.games++;
      entry.total += line[category];
      // Box score zawiera najpierw gospodarzy, potem gości.
      entry.teamId = i < getRoster(seasonId, match.homeId).length ? match.homeId : match.awayId;
      totals.set(line.playerId, entry);
    });
  }

  return [...totals.entries()]
    .map(([playerId, { games, total, teamId }]) => ({
      player: playerById.get(playerId)!,
      team: teamById.get(teamId)!,
      games,
      total,
      average: total / games,
    }))
    .sort((a, b) => b.average - a.average || b.total - a.total)
    .slice(0, limit);
}

export function getSeasonPlayers(seasonId: string, leagueId: LeagueId | 'all'): SeasonPlayer[] {
  return getPlacement(seasonId)
    .filter((e) => leagueId === 'all' || e.leagueId === leagueId)
    .flatMap((teamSeason) =>
      getRoster(seasonId, teamSeason.teamId).map((r) => ({
        player: playerById.get(r.playerId)!,
        team: teamById.get(teamSeason.teamId)!,
        teamSeason,
        number: r.number,
      })),
    );
}

const rosterEntriesByPlayer = new Map<string, RosterEntry[]>();
for (const roster of rosters.values()) {
  for (const r of roster) rosterEntriesByPlayer.set(r.playerId, [...(rosterEntriesByPlayer.get(r.playerId) ?? []), r]);
}
const seasonOrder = (id: string) => seasons.findIndex((s) => s.id === id);

export function getPlayerCareer(playerId: string): CareerRow[] {
  return (rosterEntriesByPlayer.get(playerId) ?? [])
    .sort((a, b) => seasonOrder(a.seasonId) - seasonOrder(b.seasonId))
    .map((r) => {
      const teamSeason = getTeamSeason(r.seasonId, r.teamId)!;
      const row: CareerRow = {
        season: seasonById.get(r.seasonId)!,
        team: teamById.get(r.teamId)!,
        league: leagueById.get(teamSeason.leagueId)!,
        group: teamSeason.group,
        number: r.number,
        games: 0,
        points: 0,
        rebounds: 0,
        assists: 0,
      };
      for (const m of playedByTeam.get(r.teamId) ?? []) {
        if (m.seasonId !== r.seasonId) continue;
        const line = m.box!.find((l) => l.playerId === playerId);
        if (!line) continue;
        row.games++;
        row.points += line.points;
        row.rebounds += line.rebounds;
        row.assists += line.assists;
      }
      return row;
    });
}

// Wszyscy zawodnicy z bazy z edycjami, w których grali.
export function getAllPlayers() {
  return players.map((player) => {
    const entries = (rosterEntriesByPlayer.get(player.id) ?? []).sort((a, b) => seasonOrder(a.seasonId) - seasonOrder(b.seasonId));
    const last = entries[entries.length - 1];
    return {
      player,
      firstSeason: seasonById.get(entries[0].seasonId)!,
      lastSeason: seasonById.get(last.seasonId)!,
      lastTeam: teamById.get(last.teamId)!,
      seasonsCount: entries.length,
      // Drużyna zawodnika w każdej edycji, w której grał.
      teamBySeason: new Map(entries.map((e) => [e.seasonId, teamById.get(e.teamId)!])),
    };
  });
}

// --- Strona główna ---

const weekendKey = (date: Date) => {
  const saturday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() === 0 ? 1 : 0));
  return saturday.toDateString();
};

// Mecze bieżącej edycji z ostatniego rozegranego weekendu i z najbliższego nadchodzącego.
export function getWeekendMatches() {
  const seasonMatches = matches.filter((m) => m.seasonId === currentSeason.id);
  const lastPlayed = [...seasonMatches].reverse().find((m) => m.played);
  const nextUpcoming = seasonMatches.find((m) => !m.played);
  const lastKey = lastPlayed && weekendKey(lastPlayed.date);
  const nextKey = nextUpcoming && weekendKey(nextUpcoming.date);
  return {
    last: lastKey ? seasonMatches.filter((m) => weekendKey(m.date) === lastKey && m.played) : [],
    next: nextKey ? seasonMatches.filter((m) => weekendKey(m.date) === nextKey && !m.played) : [],
  };
}

export function lastPlayedRound(leagueId: LeagueId, seasonId = currentSeason.id) {
  return Math.max(0, ...matches.filter((m) => m.seasonId === seasonId && m.leagueId === leagueId && m.played).map((m) => m.round));
}
