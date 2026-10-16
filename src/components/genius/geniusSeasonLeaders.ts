// Liderzy sezonu zasadniczego (podpowiedzi najlepszego strzelca, zbierającego i asystującego w zakładce
// „Osiągnięcia” panelu). Statystyki drużyn w Genius sumują sezon zasadniczy z play-off (wybór fazy działa tam tylko
// przy tabelach i terminarzu), więc średnie liczymy sami z box score meczów sezonu zasadniczego: rozegrane mecze
// rozgrywek bez meczów z terminarza fazy play-off. Liczy przeglądarka administratora; nic nie trafia do bazy.
import { fetchGeniusPage } from './geniusFetch';
import { isPlayoffPhase, readGroups } from './geniusGroups';
import { loadBoxScores, playedMatchIds, readPlayedMatches, type RecordsProgress } from './geniusRecordsData';
import { playoffSchedulePage } from '../playoff/playoffGames';

export type LeaderStat = 'ppg' | 'rpg' | 'apg';

export interface SeasonLeader {
  playerId: string;
  player: string;
  team: string;
  games: number;
  value: number;
}

export interface SeasonLeaders {
  leaders: Partial<Record<LeaderStat, SeasonLeader>>;
  // Ile meczów sezonu zasadniczego policzono (bez play-off) i ilu box score Genius nie oddał.
  matches: number;
  playoffMatches: number;
  failed: number;
}

// Rozegrane mecze faz play-off (z menu faz tabeli rozgrywek). Bez faz play-off — pusta lista.
async function playoffMatchIds(cid: number): Promise<Set<string>> {
  const standings = await fetchGeniusPage(`/competition/${cid}/standings`);
  if (!standings?.querySelector('.hs-embed')) throw new Error('Genius nie zwrócił tabeli rozgrywek — spróbuj za chwilę.');
  const phases = readGroups(standings).names.filter(isPlayoffPhase);
  const ids = new Set<string>();
  for (const phase of phases) {
    const schedule = await fetchGeniusPage(playoffSchedulePage(cid, phase));
    if (!schedule?.querySelector('.hs-embed')) throw new Error('Genius nie zwrócił terminarza play-off — spróbuj za chwilę.');
    readPlayedMatches(schedule).forEach((id) => ids.add(id));
  }
  return ids;
}

export async function regularSeasonLeaders(cid: number, onProgress?: (progress: RecordsProgress) => void): Promise<SeasonLeaders> {
  const [all, playoff] = await Promise.all([playedMatchIds(cid), playoffMatchIds(cid)]);
  if (!all) throw new Error('Genius nie zwrócił terminarza — spróbuj za chwilę.');
  const regular = all.filter((id) => !playoff.has(id));
  const { matches, failed } = await loadBoxScores(cid, regular, onProgress);

  // Sumy zawodników z meczów, w których weszli na boisko; drużyna z pierwszego odczytanego meczu (zawodnik zwykle gra
  // w jednej drużynie rozgrywek, a panel i tak szuka go w składach drużyn).
  const totals = new Map<string, { player: string; team: string; games: number; pts: number; reb: number; ast: number }>();
  for (const { lines } of Object.values(matches)) {
    for (const line of lines) {
      if (line.played === false) continue;
      const total = totals.get(line.playerId) ?? { player: line.player, team: line.team, games: 0, pts: 0, reb: 0, ast: 0 };
      total.games++;
      total.pts += line.pts;
      total.reb += line.reb;
      total.ast += line.ast;
      totals.set(line.playerId, total);
    }
  }

  // Jak dotąd: najwyższa średnia wśród zawodników z co najmniej połową meczów najczęściej grającego.
  const players = [...totals].map(([playerId, total]) => ({ playerId, ...total }));
  const minGames = Math.ceil(Math.max(0, ...players.map((p) => p.games)) / 2);
  const eligible = players.filter((p) => p.games >= minGames && p.games > 0);
  const leader = (field: 'pts' | 'reb' | 'ast'): SeasonLeader | undefined => {
    const best = [...eligible].sort((a, b) => b[field] / b.games - a[field] / a.games)[0];
    return best && { playerId: best.playerId, player: best.player, team: best.team, games: best.games, value: best[field] / best.games };
  };
  return {
    leaders: { ppg: leader('pts'), rpg: leader('reb'), apg: leader('ast') },
    matches: Object.keys(matches).length,
    playoffMatches: playoff.size,
    failed,
  };
}
