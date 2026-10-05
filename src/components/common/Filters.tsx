import type { ReactNode } from 'react';
import { currentSeason, leagues, seasons, type LeagueId } from '../../data/league';

type LeagueFilter = LeagueId | 'all';

const selectClass =
  'w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-900 shadow-sm transition hover:border-orange-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex min-w-48 flex-1 flex-col gap-1 sm:flex-none">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="relative">
        <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </span>
    </label>
  );
}

export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-5">{children}</div>;
}

export function SeasonFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [...seasons].reverse().map((season) => ({
    value: season.id,
    label: `Edycja ${season.name}${season.id === currentSeason.id ? ' (bieżąca)' : ''}`,
  }));
  return <FilterSelect label="Edycja" value={value} onChange={onChange} options={options} />;
}

export function LeagueFilter<T extends LeagueFilter>({ value, onChange, allowAll }: { value: T; onChange: (value: T) => void; allowAll?: boolean }) {
  const options = [...(allowAll ? [{ value: 'all', label: 'Wszystkie ligi' }] : []), ...leagues.map((league) => ({ value: league.id, label: league.name }))];
  return <FilterSelect label="Poziom rozgrywek" value={value} onChange={(v) => onChange(v as T)} options={options} />;
}

interface FilterBarProps<T extends LeagueFilter> {
  seasonId: string;
  onSeasonChange: (value: string) => void;
  leagueId: T;
  onLeagueChange: (value: T) => void;
  allowAllLeagues?: boolean;
  children?: ReactNode;
}

// Standardowy zestaw filtrów podstron: edycja i poziom rozgrywek.
export function FilterBar<T extends LeagueFilter>({ seasonId, onSeasonChange, leagueId, onLeagueChange, allowAllLeagues, children }: FilterBarProps<T>) {
  return (
    <FilterRow>
      <SeasonFilter value={seasonId} onChange={onSeasonChange} />
      <LeagueFilter value={leagueId} onChange={onLeagueChange} allowAll={allowAllLeagues} />
      {children}
    </FilterRow>
  );
}
