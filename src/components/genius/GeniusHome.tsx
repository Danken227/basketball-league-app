import { useState } from 'react';
import { leagues, type LeagueId, type StatCategory } from '../../data/league';
import LeagueSelect from '../common/LeagueSelect';
import SegmentedControl from '../common/SegmentedControl';
import GeniusEmbed from './GeniusEmbed';
import GeniusPrefetch from './GeniusPrefetch';
import { competitionId, currentGeniusEdition } from './geniusConfig';

// Tabela i Top 10 strony głównej w trybie Genius: nasza oprawa i filtry, dane z Genius Sports.
// Pasek meczów jest w GeniusMatchBar. Tabele i liderów pozostałych lig wczytujemy w tle (GeniusPrefetch),
// więc przełączanie ligi i kategorii pokazuje je od razu.

// Skrypt Genius nie przyjmuje "%" w ścieżce, więc spacje zapisujemy jako "+", jak dalk.pl.
const standingsPage = (cid: number, phase = '') => `/competition/${cid}/standings${phase ? `?phaseName=${phase.replace(/ /g, '+')}&` : ''}`;

const currentCompetitions = leagues.flatMap((league) => {
  const cid = competitionId(currentGeniusEdition.id, league.id);
  return cid ? [{ league, cid }] : [];
});

// Z wyprzedzeniem wczytujemy tylko tabele i liderów pozostałych lig (po jednym zapytaniu na ligę), żeby nie
// obciążać serwera Genius — przy zbyt wielu zapytaniach zaczyna odpowiadać wolno albo pustymi stronami.
// Tabele grup wczytują się dopiero po wybraniu grupy (potem są w pamięci).
const standingsPrefetch = currentCompetitions.map(({ cid }) => ({ page: standingsPage(cid) }));
const leadersPrefetch = currentCompetitions.map(({ cid }) => ({ page: `/competition/${cid}/leaders`, showSubMenus: false }));

export function GeniusLeagueTable() {
  const [leagueId, setLeagueId] = useState<LeagueId>('eks');
  // Grupa (faza) wybrana w podmenu Genius — przełączamy ją w miejscu, bez przechodzenia do zakładki Tabele.
  const [phase, setPhase] = useState('');
  const cid = competitionId(currentGeniusEdition.id, leagueId);

  const changeLeague = (id: LeagueId) => {
    setLeagueId(id);
    setPhase('');
  };

  // Linki do drużyn działają normalnie; link grupy (przełożony na /tabele?...&faza=...) zmienia tylko tę tabelę.
  const onLinkClick = (href: string) => {
    if (!href.startsWith('/tabele')) return false;
    setPhase(new URLSearchParams(href.split('?')[1] ?? '').get('faza') ?? '');
    return true;
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Tabela</h2>
        <LeagueSelect value={leagueId} onChange={changeLeague} />
      </div>
      {cid && <GeniusEmbed page={standingsPage(cid, phase)} compact onLinkClick={onLinkClick} />}
      <GeniusPrefetch items={standingsPrefetch} />
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
          {/* Cała strona liderów ligi naraz; kategorię wybieramy tylko widocznością bloku (genius.css),
              więc jej zmiana nie wymaga pobierania danych. */}
          <GeniusEmbed page={`/competition/${cid}/leaders`} showSubMenus={false} compact className={`genius-leaders genius-leaders--${category}`} />
        </div>
      )}
      <GeniusPrefetch items={leadersPrefetch} />
    </section>
  );
}
