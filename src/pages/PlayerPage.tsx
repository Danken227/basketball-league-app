import { Link, useParams } from 'react-router-dom';
import { TeamLink } from '../components/common/Links';
import PlayerPhoto from '../components/common/PlayerPhoto';
import TeamBadge from '../components/common/TeamBadge';
import { currentSeason, getPlayerCareer, playerById, positionNames, seasons } from '../data/league';
import Placeholder from './Placeholder';

const avg = (total: number, games: number) => (games ? (total / games).toFixed(1) : '–');

function PlayerPage() {
  const { id } = useParams();
  const player = id ? playerById.get(id) : undefined;
  if (!player) return <Placeholder title="Nie znaleziono zawodnika" />;

  const career = getPlayerCareer(player.id);
  const latest = career[career.length - 1];
  // W jednej edycji zawodnik może grać w kilku drużynach (na różnych poziomach rozgrywek).
  const latestRows = career.filter((row) => row.season.id === latest.season.id);
  const seasonsCount = new Set(career.map((row) => row.season.id)).size;
  const active = latest.season.id === currentSeason.id;
  const totals = career.reduce(
    (sum, row) => ({ games: sum.games + row.games, points: sum.points + row.points, rebounds: sum.rebounds + row.rebounds, assists: sum.assists + row.assists }),
    { games: 0, points: 0, rebounds: 0, assists: 0 },
  );

  const facts = [
    ['Pozycja', `${positionNames[player.position]} (${player.position})`],
    ['Wzrost', `${player.height} cm`],
    ['Rocznik', String(player.birthYear)],
    ['Edycje w lidze', String(seasonsCount)],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/zawodnicy" className="text-sm font-medium text-orange-600 hover:text-orange-700">
        ← Zawodnicy
      </Link>

      <section className="mt-4 flex flex-col gap-6 overflow-hidden rounded-xl bg-slate-950 p-6 text-white sm:flex-row sm:items-end">
        {active ? (
          <PlayerPhoto team={latest.team} number={latest.number} size="lg" />
        ) : (
          <span className="grid h-40 w-32 place-items-center rounded-lg bg-white/5 text-xs text-slate-500">brak zdjęcia</span>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-400">
            {!active && `Ostatnio (${latest.season.name}): `}
            {latestRows.map((row, i) => (
              <span key={row.team.id}>
                {i > 0 && <span className="text-slate-500"> / </span>}
                {active && `#${row.number} · `}
                <TeamLink team={row.team} seasonId={row.season.id} className="hover:text-orange-300" />
                {latestRows.length > 1 && <span className="text-slate-400"> ({row.league.name})</span>}
              </span>
            ))}
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase sm:text-4xl">
            {player.firstName} <span className="text-orange-400">{player.lastName}</span>
          </h1>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <h2 className="mt-8 text-xl font-black text-slate-900">Kariera w lidze</h2>
      <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left font-semibold">Edycja</th>
              <th className="py-3 text-left font-semibold">Drużyna</th>
              <th className="px-3 py-3 text-left font-semibold">Liga</th>
              <th className="px-3 py-3 text-center font-semibold">Nr</th>
              <th className="px-3 py-3 text-center font-semibold" title="Mecze">M</th>
              <th className="px-3 py-3 text-center font-semibold" title="Punkty na mecz">PKT</th>
              <th className="px-3 py-3 text-center font-semibold" title="Zbiórki na mecz">ZB</th>
              <th className="px-4 py-3 text-center font-semibold" title="Asysty na mecz">AS</th>
            </tr>
          </thead>
          <tbody>
            {/* Od najnowszej edycji; w obrębie edycji kolejność lig od najwyższej (jak w getPlayerCareer). */}
            {[...career]
              .sort((a, b) => seasons.indexOf(b.season) - seasons.indexOf(a.season))
              .map((row) => (
              <tr key={`${row.season.id}-${row.team.id}`} className="border-b border-slate-100">
                <td className="px-4 py-2.5 font-semibold text-slate-900">{row.season.name}</td>
                <td className="py-2.5">
                  <span className="flex items-center gap-2 text-slate-900">
                    <TeamBadge team={row.team} size="sm" />
                    <TeamLink team={row.team} seasonId={row.season.id} />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {row.league.name}
                  {row.group && ` · Gr. ${row.group}`}
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{row.number}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{row.games}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-900">{avg(row.points, row.games)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{avg(row.rebounds, row.games)}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">{avg(row.assists, row.games)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2.5 text-slate-900" colSpan={4}>
                Łącznie
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">{totals.games}</td>
              <td className="px-3 py-2.5 text-center tabular-nums">{avg(totals.points, totals.games)}</td>
              <td className="px-3 py-2.5 text-center tabular-nums">{avg(totals.rebounds, totals.games)}</td>
              <td className="px-4 py-2.5 text-center tabular-nums">{avg(totals.assists, totals.games)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlayerPage;
