import { useState } from 'react';
import { currentSeason, getStandings, lastPlayedRound, leagueById, type LeagueId } from '../../data/league';
import LeagueSelect from '../common/LeagueSelect';
import { TeamLink } from '../common/Links';
import SegmentedControl from '../common/SegmentedControl';
import TeamBadge from '../common/TeamBadge';

const LeagueTable = () => {
  const [leagueId, setLeagueId] = useState<LeagueId>('eks');
  const [group, setGroup] = useState('');
  const league = leagueById.get(leagueId)!;
  const standings = getStandings(leagueId, group);

  const changeLeague = (id: LeagueId) => {
    setLeagueId(id);
    setGroup(leagueById.get(id)!.groups[0] ?? '');
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Tabela</h2>
        <LeagueSelect value={leagueId} onChange={changeLeague} />
      </div>

      {league.groups.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Grupa</span>
          <SegmentedControl label="Grupa" options={league.groups.map((g) => ({ value: g, label: g }))} value={group} onChange={setGroup} />
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-1 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Drużyna</th>
            <th className="px-1 py-2 text-right font-semibold" title="Mecze">M</th>
            <th className="px-1 py-2 text-right font-semibold" title="Zwycięstwa">Z</th>
            <th className="px-1 py-2 text-right font-semibold" title="Porażki">P</th>
            <th className="px-1 py-2 text-right font-semibold" title="Punkty w tabeli">Pkt</th>
            <th className="py-2 pl-1 text-right font-semibold" title="Różnica punktów">+/-</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => {
            const diff = row.pointsFor - row.pointsAgainst;
            return (
              <tr key={row.team.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-1 text-slate-500 tabular-nums">{index + 1}</td>
                <td className="w-full max-w-0 py-2">
                  <span className="flex items-center gap-2 font-medium text-slate-900" title={row.team.name}>
                    <TeamBadge team={row.team} size="sm" />
                    <TeamLink team={row.team} className="truncate" />
                  </span>
                </td>
                <td className="px-1 py-2 text-right tabular-nums text-slate-600">{row.played}</td>
                <td className="px-1 py-2 text-right tabular-nums text-slate-600">{row.wins}</td>
                <td className="px-1 py-2 text-right tabular-nums text-slate-600">{row.losses}</td>
                <td className="px-1 py-2 text-right font-bold tabular-nums text-slate-900">{row.tablePoints}</td>
                <td className={`py-2 pl-1 text-right tabular-nums ${diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  {diff > 0 ? `+${diff}` : diff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-slate-500">
        {league.name} {currentSeason.name}
        {group && ` · Grupa ${group}`} · po {lastPlayedRound(leagueId)}. kolejce · 2 pkt za zwycięstwo, 1 za porażkę
      </p>
    </section>
  );
};

export default LeagueTable;
