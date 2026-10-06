import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterRow, FilterSelect, LeagueFilter } from '../components/common/Filters';
import { PlayerLink, TeamLink } from '../components/common/Links';
import { useSeasonLeagueFilters } from '../hooks/useSeasonLeagueFilters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import PlayerPhoto from '../components/common/PlayerPhoto';
import TeamBadge from '../components/common/TeamBadge';
import { currentSeason, getAllPlayers, getSeasonPlayers, leagueById, players, seasonById, seasons, type LeagueId, type Player, type SeasonPlayer } from '../data/league';
import { playerPath } from '../utils/paths';

const collator = new Intl.Collator('pl');
const sortName = (a: Player, b: Player) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName);
const matchesQuery = (player: Player, query: string) =>
  !query || `${player.lastName} ${player.firstName}`.toLowerCase().includes(query.trim().toLowerCase());

// Grupuje listę po pierwszej literze nazwiska, jak spis zawodników na plk.pl.
function byLetter<T>(items: T[], getPlayer: (item: T) => Player) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const letter = getPlayer(item).lastName[0].toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), item]);
  }
  return [...groups.entries()];
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-w-48 flex-1 flex-col gap-1 sm:max-w-xs">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Szukaj</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nazwisko lub imię"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
      />
    </label>
  );
}

function LetterSection({ letter, children }: { letter: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-4">
      <h3 className="mb-3 text-lg font-black text-slate-900">{letter}</h3>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>
    </section>
  );
}

function SeasonPlayers({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  // Ta zakładka zawsze dotyczy bieżącej edycji, więc filtrujemy tylko poziom rozgrywek.
  const { leagueId, setLeagueId } = useSeasonLeagueFilters<LeagueId | 'all'>('all');
  // Zawodnik zgłoszony w kilku drużynach (różne poziomy) ma jedną kartę z wszystkimi drużynami.
  const byPlayer = new Map<string, { player: Player; teams: SeasonPlayer[] }>();
  for (const entry of getSeasonPlayers(currentSeason.id, leagueId)) {
    const item = byPlayer.get(entry.player.id) ?? { player: entry.player, teams: [] };
    item.teams.push(entry);
    byPlayer.set(entry.player.id, item);
  }
  const list = [...byPlayer.values()].filter((entry) => matchesQuery(entry.player, query)).sort((a, b) => sortName(a.player, b.player));

  return (
    <>
      <FilterRow>
        <LeagueFilter value={leagueId} onChange={setLeagueId} allowAll />
        <SearchField value={query} onChange={setQuery} />
      </FilterRow>
      <h2 className="mt-6 text-xl font-black text-slate-900">
        Zawodnicy w sezonie {currentSeason.name}
        <span className="ml-2 text-sm font-medium text-slate-500">
          {leagueId === 'all' ? 'wszystkie ligi' : leagueById.get(leagueId)!.name} · {list.length}
        </span>
      </h2>
      <div className="mt-4 flex flex-col gap-6">
        {byLetter(list, (e) => e.player).map(([letter, entries]) => (
          <LetterSection key={letter} letter={letter}>
            {entries.map(({ player, teams }) => (
              <li key={player.id} className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-white hover:shadow-sm">
                <Link to={playerPath(player.id)} aria-label={`${player.firstName} ${player.lastName}`} tabIndex={-1}>
                  <PlayerPhoto team={teams[0].team} number={teams[0].number} />
                </Link>
                <span className="min-w-0">
                  <PlayerLink player={player} className="block font-bold text-slate-900">
                    {player.lastName} {player.firstName}
                  </PlayerLink>
                  {teams.map(({ team, teamSeason }) => (
                    <span key={team.id} className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <TeamBadge team={team} size="sm" />
                      <TeamLink team={team} className="truncate" />
                      <span className="shrink-0 text-[11px] text-slate-400">
                        · {leagueById.get(teamSeason.leagueId)!.short}
                        {teamSeason.group && ` ${teamSeason.group}`}
                      </span>
                    </span>
                  ))}
                  <span className="mt-0.5 block text-[11px] text-slate-400">{player.position}</span>
                </span>
              </li>
            ))}
          </LetterSection>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-500">Brak zawodników dla wybranych filtrów.</p>}
      </div>
    </>
  );
}

// Edycje do wyboru w historii: najpierw wszystkie, potem minione od najnowszej (bez bieżącej).
const historicSeasonOptions = [
  { value: 'all', label: 'Wszystkie edycje' },
  ...[...seasons]
    .reverse()
    .filter((season) => season.id !== currentSeason.id)
    .map((season) => ({ value: season.id, label: `Edycja ${season.name}` })),
];

function HistoricPlayers({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('edycja');
  const seasonFilter = historicSeasonOptions.some((o) => o.value === requested) ? requested! : 'all';
  const setSeasonFilter = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('edycja', value);
        return next;
      },
      { replace: true },
    );

  const season = seasonFilter === 'all' ? undefined : seasonById.get(seasonFilter)!;
  const list = getAllPlayers()
    .filter((entry) => !season || entry.teamsBySeason.has(season.id))
    .filter((entry) => matchesQuery(entry.player, query))
    .sort((a, b) => sortName(a.player, b.player));

  return (
    <>
      <FilterRow>
        <FilterSelect label="Edycja" value={seasonFilter} onChange={setSeasonFilter} options={historicSeasonOptions} />
        <SearchField value={query} onChange={setQuery} />
        <p className="ml-auto text-xs font-semibold uppercase tracking-wide text-slate-500">Baza zawodników · {players.length}</p>
      </FilterRow>
      <h2 className="mt-6 text-xl font-black text-slate-900">
        Historycznie zawodnicy
        <span className="ml-2 text-sm font-medium text-slate-500">
          {season ? `edycja ${season.name}` : 'wszystkie edycje'} · {list.length}
        </span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {season ? `Zawodnicy, którzy wystąpili w lidze w edycji ${season.name}.` : 'Wszyscy zawodnicy, którzy wystąpili w lidze w dowolnej edycji.'}
      </p>
      <div className="mt-4 flex flex-col gap-6">
        {byLetter(list, (e) => e.player).map(([letter, entries]) => (
          <LetterSection key={letter} letter={letter}>
            {entries.map(({ player, firstSeason, lastSeason, lastTeams, seasonsCount, teamsBySeason }) => {
              // Przy wybranej edycji pokazujemy drużyny z tej edycji, inaczej z ostatniej.
              const teams = season ? teamsBySeason.get(season.id)! : lastTeams;
              return (
                <li key={player.id} className="rounded-lg px-2 py-1.5 transition hover:bg-white hover:shadow-sm">
                  <PlayerLink player={player} className="block font-bold text-slate-900">
                    {player.lastName} {player.firstName}
                  </PlayerLink>
                  <span className="block text-xs text-slate-500">
                    {firstSeason.id === lastSeason.id ? firstSeason.name : `${firstSeason.name} – ${lastSeason.name}`} · {seasonsCount}{' '}
                    {seasonsCount === 1 ? 'edycja' : 'edycje'} · {season ? 'wtedy' : 'ostatnio'}{' '}
                    {teams.map((team, i) => (
                      <span key={team.id}>
                        {i > 0 && ', '}
                        <TeamLink team={team} seasonId={season?.id ?? lastSeason.id} />
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </LetterSection>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-500">Brak zawodników dla wybranych filtrów.</p>}
      </div>
    </>
  );
}

const tabs = [
  { id: 'sezon', label: 'Bieżąca edycja' },
  { id: 'historia', label: 'Historycznie zawodnicy' },
];

function PlayersPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const view = params.get('widok') === 'historia' ? 'historia' : 'sezon';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Zawodnicy" icon={icons.player} />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => setParams(tab.id === 'sezon' ? {} : { widok: tab.id })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              view === tab.id ? 'border-orange-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {view === 'sezon' ? <SeasonPlayers query={query} setQuery={setQuery} /> : <HistoricPlayers query={query} setQuery={setQuery} />}
    </div>
  );
}

export default PlayersPage;
