import type { ReactNode } from 'react';
import type { LeagueId } from '../../data/league';
import { FilterRow, FilterSelect, LeagueFilter } from '../common/Filters';
import { currentGeniusEdition, geniusEditions } from './geniusConfig';

const editionOptions = geniusEditions.map((edition) => ({
  value: edition.id,
  label: `Edycja ${edition.name}${edition.id === currentGeniusEdition.id ? ' (bieżąca)' : ''}`,
}));

interface GeniusFilterBarProps<T extends LeagueId | 'all'> {
  editionId?: string;
  onEditionChange?: (value: string) => void;
  leagueId: T;
  onLeagueChange: (value: T) => void;
  allowAllLeagues?: boolean;
  children?: ReactNode;
}

// Te same filtry co w wersji z danymi testowymi, tylko edycje są edycjami DALK w Genius Sports.
// Bez editionId pasek pokazuje sam poziom rozgrywek (np. zakładka bieżącej edycji zawodników).
function GeniusFilterBar<T extends LeagueId | 'all'>({ editionId, onEditionChange, leagueId, onLeagueChange, allowAllLeagues, children }: GeniusFilterBarProps<T>) {
  return (
    <FilterRow>
      {editionId && onEditionChange && <FilterSelect label="Edycja" value={editionId} onChange={onEditionChange} options={editionOptions} />}
      <LeagueFilter value={leagueId} onChange={onLeagueChange} allowAll={allowAllLeagues} />
      {children}
    </FilterRow>
  );
}

export default GeniusFilterBar;
