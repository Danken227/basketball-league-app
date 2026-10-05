import { useState } from 'react';
import type { LeagueId, StatCategory } from '../../data/league';
import LeagueSelect from '../common/LeagueSelect';
import SegmentedControl from '../common/SegmentedControl';
import GeniusEmbed from './GeniusEmbed';
import GeniusWidget from './GeniusWidget';
import { competitionId, currentGeniusEdition, geniusLeaderBlocks, geniusResultsWidgets } from './geniusConfig';

// Elementy strony głównej w trybie Genius: nasza oprawa i filtry, dane z Genius Sports.

export function GeniusResultsBar() {
  // Filtr ligi pokazujemy dopiero, gdy w panelu Genius są osobne widgety dla poziomów rozgrywek.
  const perLeague = Object.keys(geniusResultsWidgets).filter((key) => key !== 'all') as LeagueId[];
  const [filter, setFilter] = useState<LeagueId | 'all'>('all');
  const widgetId = geniusResultsWidgets[filter] ?? geniusResultsWidgets.all!;

  return (
    <section aria-label="Wyniki i najbliższe mecze" className="bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Mecze</h2>
          {perLeague.length > 0 && <LeagueSelect value={filter} onChange={setFilter} allowAll dark />}
        </div>
        <GeniusWidget key={widgetId} widgetId={widgetId} />
      </div>
    </section>
  );
}

export function GeniusLeagueTable() {
  const [leagueId, setLeagueId] = useState<LeagueId>('eks');
  const cid = competitionId(currentGeniusEdition.id, leagueId);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Tabela</h2>
        <LeagueSelect value={leagueId} onChange={setLeagueId} />
      </div>
      {cid && <GeniusEmbed page={`/competition/${cid}/standings`} compact />}
    </section>
  );
}

const categoryOptions: { value: StatCategory; label: string }[] = [
  { value: 'points', label: 'Punkty' },
  { value: 'rebounds', label: 'Zbiórki' },
  { value: 'assists', label: 'Asysty' },
];

export function GeniusTopPlayers() {
  const [category, setCategory] = useState<StatCategory>('points');
  const [leagueId, setLeagueId] = useState<LeagueId>('eks');
  const cid = competitionId(currentGeniusEdition.id, leagueId);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Top 10</h2>
        <LeagueSelect value={leagueId} onChange={setLeagueId} />
      </div>
      <SegmentedControl label="Kategoria" options={categoryOptions} value={category} onChange={setCategory} />
      {cid && (
        <div className="mt-3">
          {/* Strona liderów Genius ograniczona do jednego bloku (kategorii). */}
          <GeniusEmbed page={`/competition/${cid}/leaders`} blockDisplay={geniusLeaderBlocks[category]} showSubMenus={false} compact />
        </div>
      )}
    </section>
  );
}
