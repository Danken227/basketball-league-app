import { Link } from 'react-router-dom';
import { playoffRounds, roundName, seedLabel, thirdPlaceMatch, type PlayoffBracket as Bracket, type PlayoffMatch, type PlayoffSeed, type SeriesGame } from '../../data/playoff';
import { renameTeam, type TeamNameEntry } from '../../data/siteContent';
import { usePlayoffGames } from './playoffGames';

// Drabinka play-off (strona Tabele, przełącznik „Play-off”): rundy w kolumnach od pierwszej do finału. Wyniki par
// z meczów fazy play-off w Genius; pary w kolejnych kolumnach są wyśrodkowane między parami, z których przychodzą.

const MATCH_HEIGHT = 112;

function TeamRow({ seed, won, lost, cid, renames, showSeed }: { seed: PlayoffSeed | null | undefined; won: boolean; lost: boolean; cid: number; renames: TeamNameEntry[]; showSeed: boolean }) {
  if (seed === null) return <div className="flex h-9 items-center px-3 text-xs italic text-slate-400">Wolny los</div>;
  if (!seed) return <div className="flex h-9 items-center px-3 text-xs text-slate-400">Zwycięzca pary</div>;
  const rename = renames.find((entry) => entry.teamId === seed.teamId);
  const name = rename?.name ?? renameTeam(seed.name, renames);
  const logo = rename?.logo || seed.logo;
  return (
    <div className={`flex h-9 items-center gap-2 px-3 text-sm ${won ? 'font-bold text-slate-900' : lost ? 'text-slate-400' : 'text-slate-700'}`}>
      {showSeed && <span className="w-6 shrink-0 text-[10px] font-semibold text-slate-400">{seedLabel(seed)}</span>}
      <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded bg-white dark:bg-[#fff]">
        {logo && <img src={logo} alt="" className="h-5 w-5 object-contain" loading="lazy" />}
      </span>
      {seed.teamId ? (
        <Link to={`/druzyny/${seed.teamId}?rozgrywki=${cid}`} className="min-w-0 truncate hover:text-orange-600">
          {name || seedLabel(seed)}
        </Link>
      ) : (
        <span className="min-w-0 truncate">{name || seedLabel(seed)}</span>
      )}
      {won && <span className="ml-auto text-[10px] text-emerald-600">▶</span>}
    </div>
  );
}

// "2026-01-10T18:15" → "10.01, 18:15".
const shortDate = (date?: string) => (date ? `${date.slice(8, 10)}.${date.slice(5, 7)}${date.slice(11) !== '00:00' ? `, ${date.slice(11)}` : ''}` : '');

function GameLink({ game, cid }: { game: SeriesGame; cid: number }) {
  const label = game.complete && game.score ? `${game.score[0]}:${game.score[1]}` : shortDate(game.date) || 'termin nieznany';
  return (
    <Link
      to={`/mecze/${game.id}?rozgrywki=${cid}${game.complete ? '&sekcja=boxscore' : ''}`}
      className={`tabular-nums hover:text-orange-600 hover:underline ${game.complete ? 'font-semibold text-slate-700' : 'text-slate-500'}`}
      title={game.complete ? 'Statystyki meczu' : 'Mecz'}
    >
      {label}
    </Link>
  );
}

function MatchCard({ match, cid, renames, showSeed }: { match: PlayoffMatch; cid: number; renames: TeamNameEntry[]; showSeed: boolean }) {
  const decided = match.winner !== undefined && match.teams[0] && match.teams[1];
  const note = match.manual?.score || (match.summary && match.format === 'twoLeg' ? `suma ${match.summary}` : match.summary);
  return (
    <div className="w-64 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      {match.teams.map((seed, index) => (
        <div key={index} className={index === 1 ? 'border-t border-slate-100' : ''}>
          <TeamRow
            seed={seed}
            won={Boolean(decided && match.winner === seed)}
            lost={Boolean(decided && match.winner !== seed)}
            cid={cid}
            renames={renames}
            showSeed={showSeed}
          />
        </div>
      ))}
      {(match.games.length > 0 || note) && (
        <p className="flex flex-wrap items-center justify-center gap-x-2 border-t border-slate-100 bg-slate-50 px-3 py-1 text-xs">
          {match.games.map((game, index) => (
            <span key={game.id} className="inline-flex items-center gap-2">
              {index > 0 && <span className="text-slate-300">·</span>}
              <GameLink game={game} cid={cid} />
            </span>
          ))}
          {note && <span className="font-semibold text-slate-900">{match.games.length > 0 ? `(${note})` : note}</span>}
        </p>
      )}
    </div>
  );
}

function PlayoffBracket({ bracket, cid, renames }: { bracket: Bracket; cid: number; renames: TeamNameEntry[] }) {
  // Drabinki zapisane przed wprowadzeniem fazy i formatów serii nie mają tych pól.
  const games = usePlayoffGames(cid, bracket.phase || 'PLAY OFF');
  const rounds = playoffRounds(bracket, games);
  const third = thirdPlaceMatch(bracket, rounds, games);
  const height = rounds[0].length * MATCH_HEIGHT;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">{bracket.title}</h2>
        {games === undefined && <p className="text-xs text-slate-500">Wczytywanie wyników z Genius…</p>}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6">
          {rounds.map((matches, round) => (
            <div key={round} className="flex shrink-0 flex-col">
              <h3 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">{roundName(matches.length * 2)}</h3>
              <div className="flex flex-col justify-around gap-3" style={{ minHeight: height }}>
                {matches.map((match) => (
                  <MatchCard key={match.key} match={match} cid={cid} renames={renames} showSeed={round === 0} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {third && (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mecz o 3. miejsce</h3>
          <MatchCard match={third} cid={cid} renames={renames} showSeed={false} />
        </div>
      )}
    </section>
  );
}

export default PlayoffBracket;
