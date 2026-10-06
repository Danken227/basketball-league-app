import { useState } from 'react';
import { getWeekendMatches, leagueById, teamById, type LeagueId, type Match } from '../../data/league';
import { DragScroller, GroupLabel } from '../common/DragScroller';
import LeagueSelect from '../common/LeagueSelect';
import { TeamLink } from '../common/Links';
import TeamBadge from '../common/TeamBadge';

type Filter = LeagueId | 'all';

const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

function MatchCard({ match }: { match: Match }) {
  const league = leagueById.get(match.leagueId)!;
  const rows = [
    { team: teamById.get(match.homeId)!, score: match.homeScore },
    { team: teamById.get(match.awayId)!, score: match.awayScore },
  ];
  const winnerScore = match.played ? Math.max(match.homeScore!, match.awayScore!) : undefined;

  return (
    <article className="w-60 shrink-0 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-semibold text-orange-300">
          {league.short}
          {match.group && ` · Gr. ${match.group}`}
        </span>
        <span>
          {dayFormat.format(match.date)}
          {!match.played && ` · ${timeFormat.format(match.date)}`}
        </span>
      </div>
      <ul className="space-y-1.5">
        {rows.map(({ team, score }) => (
          <li key={team.id} className="flex items-center gap-2">
            <TeamBadge team={team} size="sm" />
            <span title={team.name} className={`min-w-0 flex-1 truncate text-sm ${score === winnerScore ? 'font-bold text-white' : 'text-slate-300'}`}>
              <TeamLink team={team} className="hover:text-orange-300" />
            </span>
            {match.played && (
              <span className={`text-sm tabular-nums ${score === winnerScore ? 'font-bold text-white' : 'text-slate-400'}`}>{score}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 truncate text-[11px] text-slate-500">
        {match.played ? (match.overtime ? 'Koniec po dogrywce' : 'Koniec') : match.venue}
      </p>
    </article>
  );
}

function ResultsBar() {
  const [filter, setFilter] = useState<Filter>('all');

  const { last, next } = getWeekendMatches();
  const byLeague = (m: Match) => filter === 'all' || m.leagueId === filter;
  const lastMatches = last.filter(byLeague);
  const nextMatches = next.filter(byLeague);

  return (
    <section aria-label="Wyniki i najbliższe mecze" className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Mecze</h2>
          <LeagueSelect value={filter} onChange={setFilter} allowAll dark />
        </div>

        <DragScroller resetKey={filter}>
          {lastMatches.length > 0 && <GroupLabel>Wyniki</GroupLabel>}
          {lastMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
          {lastMatches.length > 0 && nextMatches.length > 0 && <div data-divider className="w-px shrink-0 bg-white/15" />}
          {nextMatches.length > 0 && <GroupLabel>Najbliższe</GroupLabel>}
          {nextMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
          {lastMatches.length + nextMatches.length === 0 && <p className="py-6 text-sm text-slate-400">Brak meczów.</p>}
        </DragScroller>
      </div>
    </section>
  );
}

export default ResultsBar;
