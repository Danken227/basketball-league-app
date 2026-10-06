import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import GeniusEmbed, { type StatsMode } from '../components/genius/GeniusEmbed';
import GeniusFilterBar from '../components/genius/GeniusFilterBar';
import GeniusMissing from '../components/genius/GeniusMissing';
import StatsModeToggle from '../components/genius/StatsModeToggle';
import { competitionId, geniusStatsSections } from '../components/genius/geniusConfig';
import type { LeagueId } from '../data/league';
import { useGeniusFilters } from '../hooks/useGeniusFilters';

// Polskie nazwy tabel Genius. Tabela "Averages" u zawodników ma też sumy (zbiórki, asysty, przechwyty, bloki,
// straty, EFF), więc jej nazwa myliła przy przełączniku "Średnie / Sumy".
const tableTitles: Record<string, string> = {
  'Shooting Statistics': 'Rzuty',
  Averages: 'Zbiórki, asysty i inne',
  'Fouls Summary': 'Faule',
};

function polishStatsTables(root: HTMLElement, mode: StatsMode) {
  root.querySelectorAll('h4').forEach((heading) => {
    const title = tableTitles[heading.textContent?.trim() ?? ''];
    if (title) heading.textContent = title;
  });
  // Kopia z pamięci podręcznej mogła mieć tę tabelę zawodników schowaną (wcześniejsza wersja strony).
  root.querySelectorAll('.genius-block-hidden:not(.dblock)').forEach((element) => element.classList.remove('genius-block-hidden'));
  // U drużyn ta tabela (osobny blok .dblock) ma same średnie — w widoku "Sumy" byłaby sprzeczna z wyborem.
  root.querySelectorAll('.dblock[data-blockname="Averages"]').forEach((block) => block.classList.toggle('genius-block-hidden', mode === 'tot'));
}

// Oficjalne statystyki ligi z Genius Sports: statystyki zawodników i drużyn oraz liderzy wybranych rozgrywek.
// Sekcję wybiera się w menu "Statystyki" w nagłówku strony.
function StatisticsPage() {
  const { section: slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { editionId, leagueId, setEditionId, setLeagueId } = useGeniusFilters<LeagueId>('eks');
  const section = geniusStatsSections.find((s) => s.slug === slug);
  if (!section) return <Navigate to={`/statystyki/${geniusStatsSections[0].slug}`} replace />;

  const cid = competitionId(editionId, leagueId);
  // Średnie na mecz (domyślnie) albo sumy — w adresie (?widok=sumy), żeby dało się podlinkować widok.
  const statsMode: StatsMode = params.get('widok') === 'sumy' ? 'tot' : 'avg';
  const hasModes = section.slug !== 'liderzy';
  const setStatsMode = (mode: StatsMode) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (mode === 'tot') next.set('widok', 'sumy');
        else next.delete('widok');
        return next;
      },
      { replace: true },
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={section.label}
        icon={icons.table}
        aside={<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oficjalne dane · Genius Sports / FIBA LiveStats</p>}
      />
      <GeniusFilterBar editionId={editionId} onEditionChange={setEditionId} leagueId={leagueId} onLeagueChange={setLeagueId} />
      {hasModes && (
        <div className="mt-5 flex justify-end">
          <StatsModeToggle value={statsMode} onChange={setStatsMode} />
        </div>
      )}
      {cid ? (
        // Sekcje wybieramy w menu strony, więc podmenu Genius (Team / Player) chowamy.
        <GeniusEmbed
          key={`${cid}-${section.slug}`}
          page={`/competition/${cid}/${section.path}`}
          showSubMenus={false}
          statsMode={hasModes ? statsMode : undefined}
          pageSize={hasModes ? 20 : undefined}
          onContent={hasModes ? (root) => polishStatsTables(root, statsMode) : undefined}
          className={hasModes ? 'mt-3' : 'mt-5'}
        />
      ) : (
        <GeniusMissing editionId={editionId} leagueId={leagueId} />
      )}
    </div>
  );
}

export default StatisticsPage;
