import { useSearchParams } from 'react-router-dom';
import { currentSeason, leagueById, seasonById, type LeagueId } from '../data/league';

type LeagueFilter = LeagueId | 'all';

// Edycja i poziom rozgrywek trzymane w adresie (?edycja=2026-27&liga=eks), żeby widok dało się podlinkować.
export function useSeasonLeagueFilters<T extends LeagueFilter>(defaultLeague: T) {
  const [params, setParams] = useSearchParams();
  const seasonParam = params.get('edycja');
  const leagueParam = params.get('liga');
  const seasonId = seasonParam && seasonById.has(seasonParam) ? seasonParam : currentSeason.id;
  const leagueId = (
    leagueParam && (leagueById.has(leagueParam as LeagueId) || (leagueParam === 'all' && defaultLeague === 'all')) ? leagueParam : defaultLeague
  ) as T;

  const update = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );

  return {
    seasonId,
    leagueId,
    setSeasonId: (value: string) => update('edycja', value),
    setLeagueId: (value: T) => update('liga', value),
  };
}
