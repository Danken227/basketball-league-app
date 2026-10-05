import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterRow, FilterSelect } from '../../components/common/Filters';
import PageHeader from '../../components/common/PageHeader';
import { icons } from '../../components/common/icons';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import GeniusFilterBar from '../../components/genius/GeniusFilterBar';
import { competitionId, currentGeniusEdition, geniusEditionById, geniusEditions } from '../../components/genius/geniusConfig';
import { leagues, type LeagueId } from '../../data/league';
import { useGeniusFilters } from '../../hooks/useGeniusFilters';

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

// Listy zawodników rozgrywek jednej edycji; przy "wszystkich ligach" kolejno każda liga,
// bo Genius ma listę zawodników tylko dla pojedynczych rozgrywek.
function CompetitionPlayers({ editionId, leagueIds, query }: { editionId: string; leagueIds: LeagueId[]; query: string }) {
  const lists = leagueIds.flatMap((leagueId) => {
    const cid = competitionId(editionId, leagueId);
    return cid ? [{ leagueId, cid }] : [];
  });

  return (
    <div className="mt-6 flex flex-col gap-6">
      {lists.map(({ leagueId, cid }) => (
        <section key={cid}>
          {leagueIds.length > 1 && <h2 className="mb-2 text-lg font-black text-slate-900">{leagues.find((l) => l.id === leagueId)!.name}</h2>}
          <GeniusEmbed page={`/competition/${cid}/players`} showSubMenus={false} textFilter={{ selector: '.playerblock', query }} />
        </section>
      ))}
    </div>
  );
}

function CurrentPlayers({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const { leagueId, setLeagueId } = useGeniusFilters<LeagueId | 'all'>('all');
  return (
    <>
      <GeniusFilterBar leagueId={leagueId} onLeagueChange={setLeagueId} allowAllLeagues>
        <SearchField value={query} onChange={setQuery} />
      </GeniusFilterBar>
      <h2 className="mt-6 text-xl font-black text-slate-900">Zawodnicy w sezonie {currentGeniusEdition.name}</h2>
      <CompetitionPlayers editionId={currentGeniusEdition.id} leagueIds={leagueId === 'all' ? leagues.map((l) => l.id) : [leagueId]} query={query} />
    </>
  );
}

// Edycje w historii: najpierw wszystkie (baza "All Players" w Genius), potem minione od najnowszej.
const historicOptions = [
  { value: 'all', label: 'Wszystkie edycje' },
  ...geniusEditions.filter((e) => e.id !== currentGeniusEdition.id).map((e) => ({ value: e.id, label: `Edycja ${e.name}` })),
];

function HistoricPlayers({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('edycja');
  const editionFilter = historicOptions.some((o) => o.value === requested) ? requested! : 'all';
  const setEditionFilter = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('edycja', value);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <FilterRow>
        <FilterSelect label="Edycja" value={editionFilter} onChange={setEditionFilter} options={historicOptions} />
        <SearchField value={query} onChange={setQuery} />
      </FilterRow>
      <h2 className="mt-6 text-xl font-black text-slate-900">
        Historycznie zawodnicy
        <span className="ml-2 text-sm font-medium text-slate-500">
          {editionFilter === 'all' ? 'wszystkie edycje' : `edycja ${geniusEditionById.get(editionFilter)!.name}`}
        </span>
      </h2>
      {editionFilter === 'all' ? (
        <div className="mt-6">
          {/* Pełna baza zawodników ligi z Genius (kilka tysięcy nazwisk, ładuje się dłużej). */}
          <GeniusEmbed page="/players?all=1" showSubMenus={false} textFilter={{ selector: '.playerblock', query }} />
        </div>
      ) : (
        <CompetitionPlayers editionId={editionFilter} leagueIds={leagues.map((l) => l.id)} query={query} />
      )}
    </>
  );
}

const tabs = [
  { id: 'sezon', label: 'Bieżąca edycja' },
  { id: 'historia', label: 'Historycznie zawodnicy' },
];

function GeniusPlayersPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const view = params.get('widok') === 'historia' ? 'historia' : 'sezon';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Zawodnicy"
        icon={icons.player}
        aside={<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oficjalne dane · Genius Sports</p>}
      />
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
      {view === 'sezon' ? <CurrentPlayers query={query} setQuery={setQuery} /> : <HistoricPlayers query={query} setQuery={setQuery} />}
    </div>
  );
}

export default GeniusPlayersPage;
