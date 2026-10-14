import { currentSeason, leagues, type LeagueId } from '../../data/league';
import { SelectChevron } from './Filters';

interface SelectProps<T extends LeagueId | 'all'> {
  value: T;
  onChange: (value: T) => void;
  allowAll?: boolean;
  dark?: boolean;
}

function LeagueSelect<T extends LeagueId | 'all'>({ value, onChange, dark, allowAll }: SelectProps<T>) {
  return (
    <span className="relative">
      <select
        aria-label="Liga"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`appearance-none rounded-lg border py-1 pl-2 pr-7 text-xs ${
          dark ? 'border-white/20 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
        }`}
      >
        {allowAll && <option value="all">Wszystkie ligi</option>}
        {leagues.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name} {currentSeason.name}
          </option>
        ))}
      </select>
      <SelectChevron className={`right-2 h-3.5 w-3.5 ${dark ? 'text-slate-300' : 'text-slate-500'}`} />
    </span>
  );
}

export default LeagueSelect;
