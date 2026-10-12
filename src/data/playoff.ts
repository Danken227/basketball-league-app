// Strefy tabel (awans do play-off, spadek) i drabinki play-off ustawiane w panelu administratora. Drabinka to
// rozstawienie (miejsca z tabel grup z zapamiętaną drużyną) i format serii w każdej rundzie; wyniki par liczymy
// z meczów fazy play-off w Genius (pary rozpoznajemy po numerach obu drużyn), a kolejne rundy — ze zwycięzców.

// Miejsca w tabeli: do play-off od góry, spadkowe od dołu (pozostałe neutralne). show — oznaczać je w tabelach.
export interface StandingsZone {
  playoff: number;
  relegation: number;
  show?: boolean;
}

// Miejsce w drabince: drużyna z danego miejsca grupy ("" — rozgrywki bez grup).
export interface PlayoffSeed {
  group: string;
  position: number;
  teamId: string;
  name: string;
  logo: string;
}

// Format serii: jeden mecz, mecz i rewanż (suma punktów) albo do dwóch zwycięstw.
export type SeriesFormat = 'single' | 'twoLeg' | 'bestOf3';

export const seriesFormats: { value: SeriesFormat; label: string }[] = [
  { value: 'single', label: 'Jeden mecz' },
  { value: 'twoLeg', label: 'Mecz i rewanż (suma punktów)' },
  { value: 'bestOf3', label: 'Do dwóch zwycięstw' },
];

// Ręczny wyjątek z panelu (np. walkower): zwycięzca (0 — pierwsza drużyna pary, 1 — druga) i opis zamiast wyniku.
export interface PlayoffResult {
  winner?: 0 | 1;
  score?: string;
}

export interface PlayoffBracket {
  enabled: boolean;
  title: string;
  // Faza Genius z meczami play-off (terminarz ?phaseName=…).
  phase: string;
  // Format serii w kolejnych rundach (brak — jeden mecz).
  formats: SeriesFormat[];
  thirdPlace: boolean;
  // Długość 2, 4, 8, 16 albo 32; kolejne pary to pierwsza runda. null — wolny los.
  seeds: (PlayoffSeed | null)[];
  // "r<runda>m<mecz>" (od zera) albo "third" (mecz o 3. miejsce).
  results: Record<string, PlayoffResult>;
  updatedAt: string;
}

export const PLAYOFF_SIZES = [2, 4, 8, 16, 32];

// Mecz fazy play-off z terminarza Genius.
export interface PlayoffGame {
  id: string;
  date?: string;
  homeId: string;
  awayId: string;
  homeScore?: number;
  awayScore?: number;
  complete: boolean;
}

// Mecz pary z punktu widzenia jej pierwszej drużyny.
export interface SeriesGame {
  id: string;
  date?: string;
  // Pierwsza drużyna pary gra u siebie.
  home: boolean;
  score?: [number, number];
  complete: boolean;
}

export interface PlayoffMatch {
  key: string;
  // Numer pary w rundzie (od 1) i liczba drużyn w rundzie (opis „zwycięzca ćwierćfinału 2”).
  number: number;
  teamsInRound: number;
  // Pary poprzedniej rundy, z których przychodzą drużyny (fromLosers — przegrani: mecz o 3. miejsce).
  sources?: [PlayoffMatch, PlayoffMatch];
  fromLosers?: boolean;
  format: SeriesFormat;
  teams: [PlayoffSeed | null | undefined, PlayoffSeed | null | undefined];
  games: SeriesGame[];
  // Podsumowanie serii, np. "143:142" (suma dwumeczu) albo "2–1".
  summary?: string;
  // Zwycięzca pary: z wyników, ręczny wyjątek albo drużyna z wolnym losem. undefined — jeszcze nie wiadomo.
  winner?: PlayoffSeed | null;
  loser?: PlayoffSeed | null;
  manual?: PlayoffResult;
}

function seriesGames(a: PlayoffSeed, b: PlayoffSeed, games: PlayoffGame[]): SeriesGame[] {
  return games
    .filter((game) => (game.homeId === a.teamId && game.awayId === b.teamId) || (game.homeId === b.teamId && game.awayId === a.teamId))
    .map((game) => {
      const home = game.homeId === a.teamId;
      const scores = game.homeScore !== undefined && game.awayScore !== undefined ? [game.homeScore, game.awayScore] : undefined;
      return { id: game.id, date: game.date, home, score: scores && ((home ? scores : [scores[1], scores[0]]) as [number, number]), complete: game.complete };
    })
    .sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''));
}

// Zwycięzca serii z rozegranych meczów: 0 / 1 albo undefined (seria trwa, remis w sumie dwumeczu).
function seriesWinner(format: SeriesFormat, games: SeriesGame[]): { winner?: 0 | 1; summary?: string } {
  const played = games.filter((game) => game.complete && game.score);
  if (format === 'twoLeg') {
    const legs = played.slice(0, 2);
    if (legs.length === 0) return {};
    const total = legs.reduce<[number, number]>((sum, game) => [sum[0] + game.score![0], sum[1] + game.score![1]], [0, 0]);
    const summary = legs.length === 2 ? `${total[0]}:${total[1]}` : undefined;
    return { summary, winner: legs.length === 2 && total[0] !== total[1] ? (total[0] > total[1] ? 0 : 1) : undefined };
  }
  if (format === 'bestOf3') {
    const wins = played.reduce<[number, number]>((sum, game) => (game.score![0] > game.score![1] ? [sum[0] + 1, sum[1]] : [sum[0], sum[1] + 1]), [0, 0]);
    if (played.length === 0) return {};
    return { summary: `${wins[0]}–${wins[1]}`, winner: wins[0] >= 2 ? 0 : wins[1] >= 2 ? 1 : undefined };
  }
  const game = played[0];
  return game && game.score![0] !== game.score![1] ? { winner: game.score![0] > game.score![1] ? 0 : 1 } : {};
}

function resolve(
  key: string,
  format: SeriesFormat,
  teams: PlayoffMatch['teams'],
  bracket: PlayoffBracket,
  games: PlayoffGame[],
  place: Pick<PlayoffMatch, 'number' | 'teamsInRound' | 'sources' | 'fromLosers'>,
): PlayoffMatch {
  const manual = bracket.results[key];
  const [a, b] = teams;
  const match: PlayoffMatch = { key, ...place, format, teams, games: a && b ? seriesGames(a, b, games) : [], manual };
  if (a === null && b === null) match.winner = match.loser = null;
  else if (a && b === null) [match.winner, match.loser] = [a, null];
  else if (b && a === null) [match.winner, match.loser] = [b, null];
  else if (a && b) {
    const { winner, summary } = seriesWinner(format, match.games);
    match.summary = summary;
    const side = manual?.winner ?? winner;
    if (side !== undefined) [match.winner, match.loser] = side === 0 ? [a, b] : [b, a];
  }
  return match;
}

// Rundy od pierwszej do finału.
export function playoffRounds(bracket: PlayoffBracket, games: PlayoffGame[] = []): PlayoffMatch[][] {
  const rounds: PlayoffMatch[][] = [];
  let teams: (PlayoffSeed | null | undefined)[] = bracket.seeds;
  for (let round = 0; teams.length >= 2; round++) {
    const format = bracket.formats?.[round] ?? 'single';
    const previous = rounds.at(-1);
    const teamsInRound = teams.length;
    const matches = Array.from({ length: teams.length / 2 }, (_, index) =>
      resolve(`r${round}m${index}`, format, [teams[index * 2], teams[index * 2 + 1]], bracket, games, {
        number: index + 1,
        teamsInRound,
        sources: previous && [previous[index * 2], previous[index * 2 + 1]],
      }),
    );
    rounds.push(matches);
    teams = matches.map((match) => match.winner);
  }
  return rounds;
}

// Mecz o 3. miejsce: przegrani półfinałów (jeden mecz).
export function thirdPlaceMatch(bracket: PlayoffBracket, rounds: PlayoffMatch[][], games: PlayoffGame[] = []): PlayoffMatch | undefined {
  const semis = rounds.at(-2);
  if (!bracket.thirdPlace || !semis || semis.length !== 2) return undefined;
  return resolve('third', 'single', [semis[0].loser, semis[1].loser], bracket, games, { number: 1, teamsInRound: 2, sources: [semis[0], semis[1]], fromLosers: true });
}

// Runda w dopełniaczu: „zwycięzca ćwierćfinału 2”.
const roundGenitive = (teamsInRound: number) =>
  teamsInRound === 4 ? 'półfinału' : teamsInRound === 8 ? 'ćwierćfinału' : teamsInRound === 2 ? 'finału' : `meczu 1/${teamsInRound / 2} finału`;

// Opis miejsca w parze, gdy drużyny jeszcze nie znamy: z której pary przyjdzie („Zwycięzca B4–A5”, a gdy i tam
// drużyn jeszcze nie ma — „Zwycięzca ćwierćfinału 2”).
export function pendingLabel(match: PlayoffMatch, side: 0 | 1) {
  const source = match.sources?.[side];
  const who = match.fromLosers ? 'Przegrany' : 'Zwycięzca';
  if (!source) return `${who} pary`;
  const [a, b] = source.teams;
  return a && b ? `${who} ${seedLabel(a)}–${seedLabel(b)}` : `${who} ${roundGenitive(source.teamsInRound)} ${source.number}`;
}

// Nazwa rundy po liczbie drużyn w niej.
export function roundName(teamsInRound: number) {
  if (teamsInRound === 2) return 'Finał';
  if (teamsInRound === 4) return 'Półfinały';
  if (teamsInRound === 8) return 'Ćwierćfinały';
  return `1/${teamsInRound / 2} finału`;
}

// Kolejność rozstawienia w drabince na `size` miejsc: 1 z ostatnim, a najwyżej rozstawieni spotykają się najpóźniej
// (8 miejsc: 1–8, 4–5, 2–7, 3–6).
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

// Skrót miejsca: "A1" dla grupy A, "1" bez grup.
export const seedLabel = (seed: Pick<PlayoffSeed, 'group' | 'position'>) => `${seed.group.replace(/^grupa\s*/i, '')}${seed.position}`;
