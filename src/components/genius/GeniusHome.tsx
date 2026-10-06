import { useState } from 'react';
import type { LeagueId, StatCategory } from '../../data/league';
import LeagueSelect from '../common/LeagueSelect';
import SegmentedControl from '../common/SegmentedControl';
import GeniusEmbed from './GeniusEmbed';
import { competitionId, currentGeniusEdition, geniusLeaderBlocks } from './geniusConfig';

// Tabela i Top 10 strony głównej w trybie Genius: nasza oprawa i filtry, dane z Genius Sports.
// Pasek meczów jest w GeniusMatchBar.

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
