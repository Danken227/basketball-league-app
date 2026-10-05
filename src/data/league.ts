// Deterministyczne dane testowe w układzie rozgrywek jak na dalk.pl:
// Ekstraliga (jedna tabela) oraz 1., 2. i 3. Liga podzielone na grupy.
// Nazwy zespołów, zawodników i wyniki są fikcyjne.

export type LeagueId = 'eks' | '1' | '2' | '3';

export interface League {
  id: LeagueId;
  name: string;
  short: string;
  season: string;
  // Pusta lista oznacza jedną tabelę bez podziału na grupy.
  groups: string[];
}

export interface Team {
  id: string;
  name: string;
  leagueId: LeagueId;
  group: string;
  color: string;
  strength: number;
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  number: number;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  scoring: number;
  rebounding: number;
  passing: number;
}

export interface PlayerLine {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
}

export interface Match {
  id: string;
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

export interface StandingRow {
  team: Team;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  tablePoints: number;
}

export type StatCategory = 'points' | 'rebounds' | 'assists';

export interface PlayerStatRow {
  player: Player;
  team: Team;
  games: number;
  total: number;
  average: number;
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

export const season = '2026/27';

export const leagues: League[] = [
  { id: 'eks', name: 'Ekstraliga', short: 'EKS', season, groups: [] },
  { id: '1', name: '1. Liga', short: '1L', season, groups: ['A', 'B'] },
  { id: '2', name: '2. Liga', short: '2L', season, groups: ['A', 'B', 'C', 'D'] },
  { id: '3', name: '3. Liga', short: '3L', season, groups: ['A', 'B', 'C', 'D', 'E'] },
];

export const leagueById = new Map(leagues.map((league) => [league.id, league]));

// Zespoły per liga i grupa (klucz '' = liga bez grup). Liczebności jak w sezonie 2026/27 na dalk.pl.
const teamNames: Record<LeagueId, Record<string, string[]>> = {
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
] as const;

const positions: Player['position'][] = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PG'];

const venues = ['Hala SP 12', 'Hala Sportowa Północ', 'Hala MOSiR Zachód', 'Hala Akademicka'];

// Liga wyżej to średnio mocniejsze zespoły.
const leagueLevel: Record<LeagueId, number> = { eks: 6, '1': 3, '2': 0, '3': -3 };

export const teams: Team[] = [];
export const players: Player[] = [];

for (const league of leagues) {
  for (const [group, names] of Object.entries(teamNames[league.id])) {
    names.forEach((name, index) => {
      const team: Team = {
        id: `${league.id}${group}-${index + 1}`,
        name,
        leagueId: league.id,
        group,
        color: teamColors[(teams.length * 3) % teamColors.length],
        strength: between(0.2, 0.8),
      };
      teams.push(team);

      // Amatorskie składy mają od 8 do 12 zawodników.
      const rosterSize = 8 + Math.floor(between(0, 5));
      const usedNumbers = new Set<number>();
      positions.slice(0, rosterSize).forEach((position, i) => {
        let number = Math.floor(between(0, 100));
        while (usedNumbers.has(number)) number = Math.floor(between(0, 100));
        usedNumbers.add(number);
        const isBig = position === 'PF' || position === 'C';
        const isGuard = position === 'PG' || position === 'SG';
        players.push({
          id: `${team.id}-${i + 1}`,
          teamId: team.id,
          firstName: pick(firstNames),
          lastName: pick(lastNames),
          number,
          position,
          // Pierwsza piątka gra więcej i zdobywa więcej punktów.
          scoring: between(0.4, 1) * (i < 5 ? 1.6 : 0.6),
          rebounding: between(0.4, 1) * (isBig ? 2 : 0.8),
          passing: between(0.4, 1) * (position === 'PG' ? 2.4 : isGuard ? 1.2 : 0.7),
        });
      });
    });
  }
}

export const teamById = new Map(teams.map((team) => [team.id, team]));
export const playerById = new Map(players.map((player) => [player.id, player]));

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

function boxScore(teamId: string, score: number): PlayerLine[] {
  const roster = players.filter((p) => p.teamId === teamId);
  const points = distribute(score, roster.map((p) => p.scoring));
  const rebounds = distribute(Math.round(between(30, 46)), roster.map((p) => p.rebounding));
  const assists = distribute(Math.round(between(9, 22)), roster.map((p) => p.passing));
  return roster.map((p, i) => ({ playerId: p.id, points: points[i], rebounds: rebounds[i], assists: assists[i] }));
}

const seasonStart = new Date(2026, 8, 5); // sobota 5.09.2026
const now = new Date();

export const matches: Match[] = [];

leagues.forEach((league, leagueIndex) => {
  const groups = league.groups.length ? league.groups : [''];
  const rounds = new Map<number, { group: string; homeId: string; awayId: string }[]>();
  for (const group of groups) {
    const ids = teams.filter((t) => t.leagueId === league.id && t.group === group).map((t) => t.id);
    roundRobin(ids).forEach((pairs, r) => {
      const list = rounds.get(r) ?? [];
      list.push(...pairs.map(([homeId, awayId]) => ({ group, homeId, awayId })));
      rounds.set(r, list);
    });
  }

  rounds.forEach((games, roundIndex) => {
    games.forEach(({ group, homeId, awayId }, index) => {
      // Sobota/niedziela na zmianę, 4 hale, kolejne bloki godzinowe; każda liga zaczyna o innej porze.
      const date = new Date(
        seasonStart.getFullYear(),
        seasonStart.getMonth(),
        seasonStart.getDate() + roundIndex * 7 + (index % 2),
        10 + 2 * Math.floor(index / 8) + 2 * leagueIndex,
      );
      const match: Match = {
        id: `${league.id}${group}-${roundIndex + 1}-${index + 1}`,
        leagueId: league.id,
        group,
        round: roundIndex + 1,
        date,
        venue: venues[Math.floor(index / 2) % venues.length],
        homeId,
        awayId,
        played: date < now,
      };

      if (match.played) {
        const home = teamById.get(homeId)!;
        const away = teamById.get(awayId)!;
        const base = 68 + leagueLevel[league.id];
        let homeScore = Math.round(base + (home.strength - 0.5) * 24 + 2 + between(-12, 12));
        let awayScore = Math.round(base + (away.strength - 0.5) * 24 + between(-12, 12));
        if (homeScore === awayScore) {
          match.overtime = true;
          if (rand() < 0.5) homeScore += Math.round(between(3, 9));
          else awayScore += Math.round(between(3, 9));
        }
        match.homeScore = homeScore;
        match.awayScore = awayScore;
        match.box = [...boxScore(homeId, homeScore), ...boxScore(awayId, awayScore)];
      }
      matches.push(match);
    });
  });
});

matches.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));

// Tabela: 2 pkt za zwycięstwo, 1 pkt za porażkę (zasady FIBA).
export function getStandings(leagueId: LeagueId, group = ''): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams
      .filter((t) => t.leagueId === leagueId && t.group === group)
      .map((team) => [team.id, { team, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, tablePoints: 0 }]),
  );

  for (const match of matches) {
    if (match.leagueId !== leagueId || match.group !== group || !match.played) continue;
    const home = rows.get(match.homeId)!;
    const away = rows.get(match.awayId)!;
    const homeWon = match.homeScore! > match.awayScore!;
    for (const [row, scored, conceded, won] of [
      [home, match.homeScore!, match.awayScore!, homeWon],
      [away, match.awayScore!, match.homeScore!, !homeWon],
    ] as const) {
      row.played++;
      row.pointsFor += scored;
      row.pointsAgainst += conceded;
      if (won) row.wins++;
      else row.losses++;
      row.tablePoints += won ? 2 : 1;
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.tablePoints - a.tablePoints ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
      b.pointsFor - a.pointsFor,
  );
}

export function getTopPlayers(category: StatCategory, leagueId: LeagueId | 'all', limit = 10): PlayerStatRow[] {
  const totals = new Map<string, { games: number; total: number }>();
  for (const match of matches) {
    if (!match.box || (leagueId !== 'all' && match.leagueId !== leagueId)) continue;
    for (const line of match.box) {
      const entry = totals.get(line.playerId) ?? { games: 0, total: 0 };
      entry.games++;
      entry.total += line[category];
      totals.set(line.playerId, entry);
    }
  }

  return [...totals.entries()]
    .map(([playerId, { games, total }]) => {
      const player = playerById.get(playerId)!;
      return { player, team: teamById.get(player.teamId)!, games, total, average: total / games };
    })
    .sort((a, b) => b.average - a.average || b.total - a.total)
    .slice(0, limit);
}

const weekendKey = (date: Date) => {
  const saturday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() === 0 ? 1 : 0));
  return saturday.toDateString();
};

// Mecze z ostatniego rozegranego weekendu i z najbliższego nadchodzącego.
export function getWeekendMatches() {
  const lastPlayed = [...matches].reverse().find((m) => m.played);
  const nextUpcoming = matches.find((m) => !m.played);
  const lastKey = lastPlayed && weekendKey(lastPlayed.date);
  const nextKey = nextUpcoming && weekendKey(nextUpcoming.date);
  return {
    last: lastKey ? matches.filter((m) => weekendKey(m.date) === lastKey && m.played) : [],
    next: nextKey ? matches.filter((m) => weekendKey(m.date) === nextKey && !m.played) : [],
  };
}

export function lastPlayedRound(leagueId: LeagueId) {
  return Math.max(0, ...matches.filter((m) => m.leagueId === leagueId && m.played).map((m) => m.round));
}
