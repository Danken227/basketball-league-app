import { Link } from 'react-router-dom';
import { FilterBar } from '../components/common/Filters';
import { useSeasonLeagueFilters } from '../hooks/useSeasonLeagueFilters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import TeamBadge from '../components/common/TeamBadge';
import { getSeasonTeams, leagueById, seasonById, type LeagueId } from '../data/league';
import { teamPath } from '../utils/paths';

function TeamsPage() {
  const { seasonId, leagueId, setSeasonId, setLeagueId } = useSeasonLeagueFilters<LeagueId>('eks');
  const league = leagueById.get(leagueId)!;
  const groups = league.groups.length ? league.groups : [''];
  const total = getSeasonTeams(seasonId, leagueId).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Drużyny" icon={icons.teams} />
      <FilterBar seasonId={seasonId} onSeasonChange={setSeasonId} leagueId={leagueId} onLeagueChange={setLeagueId}>
        <p className="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-500">
          {league.name} {seasonById.get(seasonId)!.name} · {total} drużyn
        </p>
      </FilterBar>

      <div className="mt-6 flex flex-col gap-8">
        {groups.map((group) => {
          const teams = getSeasonTeams(seasonId, leagueId, group).sort((a, b) => a.team.name.localeCompare(b.team.name, 'pl'));
          return (
            <section key={group}>
              {group && <h2 className="mb-3 border-b border-slate-200 pb-2 text-sm font-black uppercase tracking-wide text-slate-900">Grupa {group}</h2>}
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {teams.map(({ team }) => (
                  <li key={team.id}>
                    <Link to={teamPath(team.id, seasonId)} className="group flex flex-col items-center text-center">
                      <span className="grid aspect-square w-full place-items-center rounded-lg border border-slate-200 bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-orange-400 group-hover:shadow-md">
                        <span className="scale-[2.2]">
                          <TeamBadge team={team} />
                        </span>
                      </span>
                      <span className="mt-2 text-sm font-bold leading-tight text-orange-600 underline-offset-2 group-hover:underline">{team.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default TeamsPage;
