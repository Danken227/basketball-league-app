import type { ReactNode } from 'react';
import { FilterRow, FilterSelect } from '../common/Filters';
import { currentGeniusEdition, geniusEditions, geniusLeagueOptions, type GeniusLeagueId } from './geniusConfig';

const editionOptions = geniusEditions.map((edition) => ({
  value: edition.id,
  label: `Edycja ${edition.name}${edition.id === currentGeniusEdition.id ? ' (bieżąca)' : ''}`,
}));

interface GeniusFilterBarProps<T extends GeniusLeagueId | 'all'> {
  editionId?: string;
  onEditionChange?: (value: string) => void;
  leagueId: T;
  onLeagueChange: (value: T) => void;
  allowAllLeagues?: boolean;
  children?: ReactNode;
}

// Te same filtry co w wersji z danymi testowymi, tylko edycje są edycjami DALK w Genius Sports,
// a poziom rozgrywek obejmuje też kategorie juniorów.
// Bez editionId pasek pokazuje sam poziom rozgrywek (np. zakładka bieżącej edycji zawodników).
function GeniusFilterBar<T extends GeniusLeagueId | 'all'>({ editionId, onEditionChange, leagueId, onLeagueChange, allowAllLeagues, children }: GeniusFilterBarProps<T>) {
  const leagueOptions = [...(allowAllLeagues ? [{ value: 'all', label: 'Wszystkie ligi' }] : []), ...geniusLeagueOptions];
  return (
    <FilterRow>
      {editionId && onEditionChange && <FilterSelect label="Edycja" value={editionId} onChange={onEditionChange} options={editionOptions} />}
      <FilterSelect label="Poziom rozgrywek" value={leagueId} onChange={(value) => onLeagueChange(value as T)} options={leagueOptions} />
      {children}
    </FilterRow>
  );
}

export default GeniusFilterBar;
