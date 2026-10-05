import { useSearchParams } from 'react-router-dom';
import { FilterBar } from '../components/common/Filters';
import { useSeasonLeagueFilters } from '../hooks/useSeasonLeagueFilters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import { TeamLink } from '../components/common/Links';
import TeamBadge from '../components/common/TeamBadge';
import { getMatches, leagueById, seasonById, teamById, type LeagueId, type Match } from '../data/league';

const views = [
  { id: 'najblizsze', label: 'Najbliższe mecze' },
  { id: 'wszystkie', label: 'Wszystkie mecze' },
  { id: 'ostatnie', label: 'Ostatnie mecze' },
] as const;

type View = (typeof views)[number]['id'];

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

function TeamCell({ teamId, seasonId, won }: { teamId: string; seasonId: string; won?: boolean }) {
  const team = teamById.get(teamId)!;
  return (
    <span className={`flex items-center gap-2.5 ${won ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
      <TeamBadge team={team} />
      <TeamLink team={team} seasonId={seasonId} />
    </span>
  );
}

function RoundTable({ round, matches, showGroup }: { round: number; matches: Match[]; showGroup: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex items-center justify-between border-b-2 border-orange-500 bg-slate-950 px-4 py-2.5">
        <h2 className="font-black uppercase text-white">{round}. kolejka</h2>
        <p className="text-xs text-slate-400">
          {dateFormat.format(matches[0].date)}
          {matches.length > 1 && ` – ${dateFormat.format(matches[matches.length - 1].date)}`}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 text-left font-semibold">Gospodarz</th>
              <th className="py-2.5 text-left font-semibold">Gość</th>
              {showGroup && <th className="px-3 py-2.5 text-center font-semibold">Grupa</th>}
              <th className="px-3 py-2.5 text-left font-semibold">Data spotkania</th>
              <th className="px-3 py-2.5 text-left font-semibold">Hala</th>
              <th className="px-4 py-2.5 text-center font-semibold">Wynik</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const homeWon = m.played && m.homeScore! > m.awayScore!;
              return (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <TeamCell teamId={m.homeId} seasonId={m.seasonId} won={homeWon} />
                  </td>
                  <td className="py-2.5">
                    <TeamCell teamId={m.awayId} seasonId={m.seasonId} won={m.played && !homeWon} />
                  </td>
                  {showGroup && <td className="px-3 py-2.5 text-center font-semibold text-slate-600">{m.group}</td>}
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">
                    {dateFormat.format(m.date)} <span className="text-slate-400">{dayFormat.format(m.date)}</span> / {timeFormat.format(m.date)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{m.venue}</td>
                  <td className="px-4 py-2.5 text-center">
                    {m.played ? (
                      <span className="inline-block min-w-20 rounded bg-slate-950 px-2 py-1 font-bold tabular-nums text-white">
                        {m.homeScore} : {m.awayScore}
                        {m.overtime && <span className="ml-1 text-[10px] font-semibold text-orange-400">OT</span>}
                      </span>
                    ) : (
                      <span className="inline-block min-w-20 rounded bg-slate-100 px-2 py-1 tabular-nums text-slate-400">– : –</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SchedulePage() {
  const { seasonId, leagueId, setSeasonId, setLeagueId } = useSeasonLeagueFilters<LeagueId>('eks');
  const [params, setParams] = useSearchParams();
  const view: View = views.some((v) => v.id === params.get('widok')) ? (params.get('widok') as View) : 'wszystkie';
  const league = leagueById.get(leagueId)!;

  const all = getMatches(seasonId, leagueId);
  const filtered = view === 'najblizsze' ? all.filter((m) => !m.played) : view === 'ostatnie' ? all.filter((m) => m.played) : all;
  const rounds = [...new Set(filtered.map((m) => m.round))].sort((a, b) => (view === 'ostatnie' ? b - a : a - b));

  const setView = (id: View) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('widok', id);
      return next;
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Terminarz" icon={icons.calendar} />
      <FilterBar seasonId={seasonId} onSeasonChange={setSeasonId} leagueId={leagueId} onLeagueChange={setLeagueId}>
        <p className="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-500">
          {league.name} {seasonById.get(seasonId)!.name} · {all.filter((m) => m.played).length}/{all.length} rozegranych
        </p>
      </FilterBar>

      <div role="tablist" className="mt-5 flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              view === v.id ? 'bg-orange-500 text-slate-950' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-6">
        {rounds.map((round) => (
          <RoundTable key={round} round={round} matches={filtered.filter((m) => m.round === round)} showGroup={league.groups.length > 0} />
        ))}
        {rounds.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            {view === 'najblizsze' ? 'Wszystkie mecze tej edycji zostały rozegrane.' : 'Brak rozegranych meczów w tej edycji.'}
          </p>
        )}
      </div>
    </div>
  );
}

export default SchedulePage;
