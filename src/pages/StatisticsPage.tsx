import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import GeniusEmbed, { type StatsMode } from '../components/genius/GeniusEmbed';
import GeniusFilterBar from '../components/genius/GeniusFilterBar';
import GeniusMissing from '../components/genius/GeniusMissing';
import GeniusRecords from '../components/genius/GeniusRecords';
import StatsModeToggle from '../components/genius/StatsModeToggle';
import { competitionId, geniusStatsSections, type GeniusLeagueId } from '../components/genius/geniusConfig';
import { useGeniusFilters } from '../hooks/useGeniusFilters';

// Nazwy tabel tłumaczy GeniusEmbed (geniusI18n: "Averages" → "Średnie"). U zawodników ta tabela ma też sumy
// (zbiórki, asysty, przechwyty, bloki, straty, EVAL), więc przy przełączniku "Średnie / Sumy" nazywamy ją inaczej.
function polishStatsTables(root: HTMLElement, mode: StatsMode) {
  root.querySelectorAll('.stats-player h4').forEach((heading) => {
    if (heading.textContent?.trim() === 'Średnie') heading.textContent = 'Zbiórki, asysty i inne';
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
  const { editionId, leagueId, setEditionId, setLeagueId } = useGeniusFilters<GeniusLeagueId>('eks');
  const section = geniusStatsSections.find((s) => s.slug === slug);
  if (!section) return <Navigate to={`/statystyki/${geniusStatsSections[0].slug}`} replace />;

  const cid = competitionId(editionId, leagueId);
  // Średnie na mecz (domyślnie) albo sumy — w adresie (?widok=sumy), żeby dało się podlinkować widok.
  const statsMode: StatsMode = params.get('widok') === 'sumy' ? 'tot' : 'avg';
  const records = section.slug === 'rekordy';
  const hasModes = section.slug !== 'liderzy' && !records;
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
      {cid && records ? (
        <GeniusRecords key={cid} cid={cid} />
      ) : cid ? (
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
