import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FilterRow, FilterSelect } from '../components/common/Filters';
import { PlayerLink } from '../components/common/Links';
import TeamBadge from '../components/common/TeamBadge';
import { currentSeason, getRoster, getTeamSeason, getTeamSeasons, leagueById, playerById, positionNames, teamById } from '../data/league';
import Placeholder from './Placeholder';


function TeamPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const team = id ? teamById.get(id) : undefined;
  if (!team) return <Placeholder title="Nie znaleziono drużyny" />;

  // Bez edycji w adresie pokazujemy ostatnią, w której zespół grał (zwykle bieżącą).
  const teamSeasons = getTeamSeasons(team.id);
  const requested = params.get('edycja');
  const season = teamSeasons.find((s) => s.id === requested) ?? teamSeasons[teamSeasons.length - 1];
  const teamSeason = getTeamSeason(season.id, team.id)!;
  const league = leagueById.get(teamSeason.leagueId)!;
  const roster = getRoster(season.id, team.id)
    .map((entry) => ({ ...entry, player: playerById.get(entry.playerId)! }))
    .sort((a, b) => a.number - b.number);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to={`/druzyny?edycja=${season.id}&liga=${league.id}`} className="text-sm font-medium text-orange-600 hover:text-orange-700">
        ← Drużyny
      </Link>

      {/* Tylko edycje, w których zespół grał, od najnowszej. */}
      <div className="mt-4">
        <FilterRow>
          <FilterSelect
            label="Edycja"
            value={season.id}
            onChange={(value) => setParams({ edycja: value })}
            options={[...teamSeasons].reverse().map((s) => ({ value: s.id, label: `Edycja ${s.name}${s.id === currentSeason.id ? ' (bieżąca)' : ''}` }))}
          />
        </FilterRow>
      </div>

      <section className="keep-dark mt-4 flex flex-col items-center gap-6 rounded-xl bg-slate-950 p-6 text-white sm:flex-row">
        <span className="grid h-32 w-32 shrink-0 place-items-center rounded-xl bg-white">
          <span className="scale-[2.6]">
            <TeamBadge team={team} />
          </span>
        </span>
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-black uppercase sm:text-4xl">{team.name}</h1>
          {/* Poziom rozgrywek, na którym zespół grał w wybranej edycji. */}
          <p className="mt-1.5 text-sm font-bold uppercase tracking-wide text-orange-400">
            {league.name}
            {teamSeason.group && ` · Grupa ${teamSeason.group}`} · edycja {season.name}
          </p>
        </div>
      </section>

      <h2 className="mt-8 text-xl font-black text-slate-900">
        Skład <span className="text-sm font-medium text-slate-500">{roster.length} zawodników</span>
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="w-16 px-4 py-3 text-center font-semibold">Nr</th>
              <th className="py-3 text-left font-semibold">Zawodnik</th>
              <th className="px-3 py-3 text-left font-semibold">Pozycja</th>
              <th className="px-3 py-3 text-center font-semibold">Wzrost</th>
              <th className="px-4 py-3 text-center font-semibold">Rocznik</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(({ player, number }) => (
              <tr key={player.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-grid h-7 w-7 place-items-center rounded text-xs font-bold text-white" style={{ backgroundColor: team.color }}>
                    {number}
                  </span>
                </td>
                <td className="py-2.5 font-semibold text-slate-900">
                  <PlayerLink player={player}>
                    {player.lastName} {player.firstName}
                  </PlayerLink>
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {positionNames[player.position]} ({player.position})
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{player.height} cm</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">{player.birthYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeamPage;
