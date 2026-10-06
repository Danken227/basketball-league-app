import { useSearchParams } from 'react-router-dom';
import { currentGeniusEdition, geniusEditionById, isGeniusLeagueId, type GeniusLeagueId } from '../components/genius/geniusConfig';

// Poziom rozgrywek: liga seniorów albo kategoria juniorów (?liga=U17), na liście zawodników także "wszystkie".
type LeagueFilter = GeniusLeagueId | 'all';

// Jak useSeasonLeagueFilters, ale edycje pochodzą z Genius (?edycja=2025-26&liga=eks).
export function useGeniusFilters<T extends LeagueFilter>(defaultLeague: T) {
  const [params, setParams] = useSearchParams();
  const editionParam = params.get('edycja');
  const leagueParam = params.get('liga');
  const editionId = editionParam && geniusEditionById.has(editionParam) ? editionParam : currentGeniusEdition.id;
  const leagueId = (
    leagueParam && (isGeniusLeagueId(leagueParam) || (leagueParam === 'all' && defaultLeague === 'all')) ? leagueParam : defaultLeague
  ) as T;

  const update = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        // Faza (np. grupa) dotyczy konkretnych rozgrywek, więc po zmianie edycji lub ligi wracamy do domyślnej.
        next.delete('faza');
        return next;
      },
      { replace: true },
    );

  return {
    editionId,
    leagueId,
    phase: params.get('faza') ?? '',
    setEditionId: (value: string) => update('edycja', value),
    setLeagueId: (value: T) => update('liga', value),
  };
}
