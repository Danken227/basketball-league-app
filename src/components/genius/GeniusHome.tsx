import { useState } from 'react';
import { leagues, type StatCategory } from '../../data/league';
import SegmentedControl from '../common/SegmentedControl';
import GeniusEmbed from './GeniusEmbed';
import GeniusPrefetch from './GeniusPrefetch';
import { competitionId, currentGeniusEdition, geniusJuniorCompetitions, juniorCategories } from './geniusConfig';

// Tabela i Top 10 strony głównej w trybie Genius: nasza oprawa i filtry, dane z Genius Sports.
// Pasek meczów jest w GeniusMatchBar. Tabele i liderów pozostałych lig wczytujemy w tle (GeniusPrefetch),
// więc przełączanie ligi i kategorii pokazuje je od razu.

// Skrypt Genius nie przyjmuje "%" w ścieżce, więc spacje zapisujemy jako "+", jak dalk.pl.
const standingsPage = (cid: number, phase = '') => `/competition/${cid}/standings${phase ? `?phaseName=${phase.replace(/ /g, '+')}&` : ''}`;

const currentCompetitions = leagues.flatMap((league) => {
  const cid = competitionId(currentGeniusEdition.id, league.id);
  return cid ? [{ league, cid }] : [];
});

// Rozgrywki do wyboru w tabeli i Top 10: ligi seniorów i każda kategoria juniorów osobno (bieżąca edycja).
const juniorCompetitions = juniorCategories.flatMap((category) => {
  const cid = geniusJuniorCompetitions[currentGeniusEdition.id]?.[category];
  return cid ? [{ value: category as string, label: `Junior ${category} ${currentGeniusEdition.name}`, cid }] : [];
});
const seniorCompetitions = currentCompetitions.map(({ league, cid }) => ({ value: league.id as string, label: `${league.name} ${currentGeniusEdition.name}`, cid }));
const homeCompetitions = [...seniorCompetitions, ...juniorCompetitions];
const homeCompetitionById = new Map(homeCompetitions.map((c) => [c.value, c]));

// Z wyprzedzeniem wczytujemy tylko tabele i liderów lig seniorów (po jednym zapytaniu na ligę), żeby nie
// obciążać serwera Genius — przy zbyt wielu zapytaniach zaczyna odpowiadać wolno albo pustymi stronami.
// Tabele grup i rozgrywki juniorów wczytują się dopiero po wybraniu (potem są w pamięci).
const standingsPrefetch = currentCompetitions.map(({ cid }) => ({ page: standingsPage(cid) }));
const leadersPrefetch = currentCompetitions.map(({ cid }) => ({ page: `/competition/${cid}/leaders`, showSubMenus: false }));

function CompetitionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      aria-label="Rozgrywki"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
    >
      <optgroup label="Ligi">
        {seniorCompetitions.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </optgroup>
      {juniorCompetitions.length > 0 && (
        <optgroup label="Juniorzy">
          {juniorCompetitions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Grupy (fazy) tabeli odczytane z podmenu Genius, które chowamy (genius.css) na rzecz naszego przełącznika.
function readGroups(root: HTMLElement) {
  const links = [...root.querySelectorAll('.selection-scroll a.menuoption')];
  return {
    names: links.map((link) => link.textContent?.trim() ?? '').filter(Boolean),
    current: links.find((link) => link.classList.contains('currentoption'))?.textContent?.trim() ?? '',
  };
}

export function GeniusLeagueTable() {
  const [competition, setCompetition] = useState('eks');
  // Grupa wybrana naszym przełącznikiem ("" = domyślna z Genius, czyli pierwsza).
  const [phase, setPhase] = useState('');
  const [groups, setGroups] = useState<{ names: string[]; current: string }>({ names: [], current: '' });
  const cid = homeCompetitionById.get(competition)?.cid;

  const changeCompetition = (value: string) => {
    setCompetition(value);
    setPhase('');
    setGroups({ names: [], current: '' });
  };

  const onContent = (root: HTMLElement) => {
    const next = readGroups(root);
    setGroups((prev) => (prev.names.join('|') === next.names.join('|') && prev.current === next.current ? prev : next));
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Tabela</h2>
        <CompetitionSelect value={competition} onChange={changeCompetition} />
      </div>
      {groups.names.length > 1 && (
        <div className="mb-3 max-w-full overflow-x-auto">
          <SegmentedControl
            label="Grupa"
            options={groups.names.map((name) => ({ value: name, label: name }))}
            value={phase || groups.current}
            onChange={setPhase}
          />
        </div>
      )}
      {cid && <GeniusEmbed page={standingsPage(cid, phase)} compact onContent={onContent} />}
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
  const [competition, setCompetition] = useState('eks');
  const cid = homeCompetitionById.get(competition)?.cid;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Top 10</h2>
        <CompetitionSelect value={competition} onChange={setCompetition} />
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
