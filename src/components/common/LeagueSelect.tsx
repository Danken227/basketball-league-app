import { leagues, type LeagueId } from '../../data/league';

interface SelectProps<T extends LeagueId | 'all'> {
  value: T;
  onChange: (value: T) => void;
  allowAll?: boolean;
  dark?: boolean;
}

function LeagueSelect<T extends LeagueId | 'all'>({ value, onChange, dark, allowAll }: SelectProps<T>) {
  return (
    <select
      aria-label="Liga"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`rounded-lg border px-2 py-1 text-xs ${
        dark ? 'border-white/20 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      {allowAll && <option value="all">Wszystkie ligi</option>}
      {leagues.map((league) => (
        <option key={league.id} value={league.id}>
          {league.name} {league.season}
        </option>
      ))}
    </select>
  );
}

export default LeagueSelect;
