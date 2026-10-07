import { FilterBar } from '../components/common/Filters';
import { useSeasonLeagueFilters } from '../hooks/useSeasonLeagueFilters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import { TeamLink } from '../components/common/Links';
import TeamBadge from '../components/common/TeamBadge';
import { getStandings, lastPlayedRound, leagueById, seasonById, type League, type LeagueId, type StandingRow } from '../data/league';

const positionClass = ['bg-orange-500 text-white', 'bg-orange-400 text-white', 'bg-orange-300 text-white'];

function FormStrip({ form }: { form: StandingRow['form'] }) {
  const wins = form.filter((r) => r === 'W').length;
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-8 text-right text-xs tabular-nums text-slate-500">
        {wins}–{form.length - wins}
      </span>
      <span className="flex gap-0.5">
        {form.map((result, i) => (
          <span
            key={i}
            className={`grid h-4 w-4 place-items-center rounded-sm text-[9px] font-bold text-white ${result === 'W' ? 'bg-green-600' : 'bg-red-600'}`}
            title={result === 'W' ? 'Wygrana' : 'Porażka'}
          >
            {result}
          </span>
        ))}
      </span>
    </span>
  );
}

function ZoneLabel({ kind }: { kind: 'promotion' | 'relegation' }) {
  return (
    <tr className={kind === 'promotion' ? 'bg-sky-50' : 'bg-red-50'}>
      <td colSpan={8} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider ${kind === 'promotion' ? 'text-sky-700' : 'text-red-700'}`}>
        {kind === 'promotion' ? 'Strefa awansu' : 'Strefa spadku'}
      </td>
    </tr>
  );
}

function GroupTable({ league, group, seasonId }: { league: League; group: string; seasonId: string }) {
  const rows = getStandings(league.id, group, seasonId);
  const relegationFrom = rows.length - league.relegation;

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="keep-dark flex items-center justify-between border-b-2 border-orange-500 bg-slate-950 px-4 py-3">
        <p className="text-sm font-semibold uppercase text-slate-400">
          Liga: <span className="text-orange-400">{league.name}</span>
        </p>
        {group && <p className="text-lg font-black uppercase text-white">Grupa {group}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="w-12 px-4 py-3 text-left font-semibold">#</th>
              <th className="py-3 text-left font-semibold">Drużyna</th>
              <th className="px-3 py-3 text-center font-semibold" title="Mecze">M</th>
              <th className="px-3 py-3 text-center font-semibold" title="Punkty w tabeli">Pkt</th>
              <th className="px-3 py-3 text-center font-semibold" title="Kosze: zdobyte i stracone">Suma</th>
              <th className="px-3 py-3 text-center font-semibold" title="Kosze: różnica">Różnica</th>
              <th className="hidden px-3 py-3 text-center font-semibold md:table-cell" title="Bilans wszystkich meczów we wszystkich edycjach">
                Wszystkie
              </th>
              <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell" title="Ostatnie 10 meczów">
                Forma (10)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const promoted = index < league.promotion;
              const relegated = index >= relegationFrom;
              const diff = row.pointsFor - row.pointsAgainst;
              return [
                index === 0 && league.promotion > 0 && <ZoneLabel key="promotion" kind="promotion" />,
                index === relegationFrom && league.relegation > 0 && <ZoneLabel key="relegation" kind="relegation" />,
                <tr
                  key={row.team.id}
                  className={`border-t border-slate-100 ${index === 0 ? 'bg-orange-50/60' : ''} ${
                    promoted ? 'shadow-[inset_3px_0_0_#0284c7]' : relegated ? 'shadow-[inset_3px_0_0_#dc2626]' : ''
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className={`grid h-6 w-6 place-items-center rounded text-[11px] font-bold ${positionClass[index] ?? 'bg-slate-900 text-white'}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2.5 font-semibold uppercase text-slate-900">
                      <TeamBadge team={row.team} size="sm" />
                      <TeamLink team={row.team} seasonId={seasonId} />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">{row.played}</td>
                  <td className="px-3 py-2.5 text-center text-base font-bold tabular-nums text-slate-900">{row.tablePoints}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">
                    {row.pointsFor}:{row.pointsAgainst}
                  </td>
                  <td className={`px-3 py-2.5 text-center tabular-nums ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="hidden px-3 py-2.5 text-center tabular-nums text-slate-600 md:table-cell">
                    {row.allWins} : {row.allLosses}
                  </td>
                  <td className="hidden px-4 py-2.5 lg:table-cell">
                    <FormStrip form={row.form} />
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {league.promotion > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-sky-600" /> Awans
          </span>
        )}
        {league.relegation > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-red-600" /> Spadek
          </span>
        )}
        <span>2 pkt za zwycięstwo, 1 pkt za porażkę</span>
      </footer>
    </section>
  );
}

function TablesPage() {
  const { seasonId, leagueId, setSeasonId, setLeagueId } = useSeasonLeagueFilters<LeagueId>('eks');
  const league = leagueById.get(leagueId)!;
  const groups = league.groups.length ? league.groups : [''];
  const round = lastPlayedRound(leagueId, seasonId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Tabele" icon={icons.table} />
      <FilterBar seasonId={seasonId} onSeasonChange={setSeasonId} leagueId={leagueId} onLeagueChange={setLeagueId}>
        <p className="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-500">
          {seasonById.get(seasonId)!.name} · {groups.length === 1 ? '1 grupa' : `${groups.length} ${groups.length < 5 ? 'grupy' : 'grup'}`} · po {round}. kolejce
        </p>
      </FilterBar>
      <div className="mt-6 flex flex-col gap-6">
        {groups.map((group) => (
          <GroupTable key={group} league={league} group={group} seasonId={seasonId} />
        ))}
      </div>
    </div>
  );
}

export default TablesPage;
