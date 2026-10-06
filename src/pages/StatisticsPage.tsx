import { NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import GeniusEmbed, { type StatsMode } from '../components/genius/GeniusEmbed';
import GeniusFilterBar from '../components/genius/GeniusFilterBar';
import GeniusMissing from '../components/genius/GeniusMissing';
import StatsModeToggle from '../components/genius/StatsModeToggle';
import { competitionId, geniusStatsSections } from '../components/genius/geniusConfig';
import type { LeagueId } from '../data/league';
import { useGeniusFilters } from '../hooks/useGeniusFilters';

// Oficjalne statystyki ligi z Genius Sports: statystyki zawodników i drużyn oraz liderzy wybranych rozgrywek.
function StatisticsPage() {
  const { section: slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { editionId, leagueId, setEditionId, setLeagueId } = useGeniusFilters<LeagueId>('eks');
  const section = geniusStatsSections.find((s) => s.slug === slug);
  if (!section) return <Navigate to={`/statystyki/${geniusStatsSections[0].slug}`} replace />;

  const cid = competitionId(editionId, leagueId);
  const query = params.toString();
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
        title="Statystyki"
        icon={icons.table}
        aside={<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oficjalne dane · Genius Sports / FIBA LiveStats</p>}
      />
      <GeniusFilterBar editionId={editionId} onEditionChange={setEditionId} leagueId={leagueId} onLeagueChange={setLeagueId} />
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Sekcje statystyk" className="flex flex-wrap gap-2">
          {geniusStatsSections.map((s) => (
            <NavLink
              key={s.slug}
              to={`/statystyki/${s.slug}${query ? `?${query}` : ''}`}
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  isActive ? 'bg-orange-500 text-slate-950' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        {hasModes && <StatsModeToggle value={statsMode} onChange={setStatsMode} />}
      </div>
      {cid ? (
        // Sekcje wybieramy własnymi zakładkami, więc podmenu Genius (Team / Player) chowamy.
        <GeniusEmbed
          key={`${cid}-${section.slug}`}
          page={`/competition/${cid}/${section.path}`}
          showSubMenus={false}
          statsMode={hasModes ? statsMode : undefined}
        />
      ) : (
        <GeniusMissing editionId={editionId} leagueId={leagueId} />
      )}
    </div>
  );
}

export default StatisticsPage;
