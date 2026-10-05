import { useState } from 'react';
import { getTopPlayers, type LeagueId, type StatCategory } from '../../data/league';
import LeagueSelect from '../common/LeagueSelect';
import { PlayerLink, TeamLink } from '../common/Links';
import SegmentedControl from '../common/SegmentedControl';

const categoryOptions: { value: StatCategory; label: string }[] = [
  { value: 'points', label: 'Punkty' },
  { value: 'rebounds', label: 'Zbiórki' },
  { value: 'assists', label: 'Asysty' },
];

const unit: Record<StatCategory, string> = { points: 'PKT', rebounds: 'ZB', assists: 'AS' };

const StatsTable = () => {
  const [category, setCategory] = useState<StatCategory>('points');
  const [leagueId, setLeagueId] = useState<LeagueId>('eks');
  const top = getTopPlayers(category, leagueId);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Top 10</h2>
        <LeagueSelect value={leagueId} onChange={setLeagueId} />
      </div>
      <SegmentedControl label="Kategoria" options={categoryOptions} value={category} onChange={setCategory} />

      <ol className="mt-3">
        {top.map((row, index) => (
          <li key={row.player.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
            <span className={`w-5 text-sm tabular-nums ${index < 3 ? 'font-bold text-orange-600' : 'text-slate-500'}`}>{index + 1}</span>
            <span className="min-w-0 flex-1">
              <PlayerLink player={row.player} className="block truncate text-sm font-medium text-slate-900" />
              <span className="block text-[11px] text-slate-500">
                <TeamLink team={row.team} /> · {row.player.position} · {row.games} M
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-bold tabular-nums text-slate-900">{row.average.toFixed(1)}</span>
              <span className="block text-[10px] uppercase text-slate-500">{unit[category]}/mecz</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default StatsTable;
