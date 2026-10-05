import { NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import GeniusEmbed from '../components/genius/GeniusEmbed';
import GeniusFilterBar from '../components/genius/GeniusFilterBar';
import GeniusMissing from '../components/genius/GeniusMissing';
import { competitionId, geniusStatsSections } from '../components/genius/geniusConfig';
import type { LeagueId } from '../data/league';
import { useGeniusFilters } from '../hooks/useGeniusFilters';

// Oficjalne statystyki ligi z Genius Sports: statystyki zawodników i drużyn oraz liderzy wybranych rozgrywek.
function StatisticsPage() {
  const { section: slug } = useParams();
  const [params] = useSearchParams();
  const { editionId, leagueId, setEditionId, setLeagueId } = useGeniusFilters<LeagueId>('eks');
  const section = geniusStatsSections.find((s) => s.slug === slug);
  if (!section) return <Navigate to={`/statystyki/${geniusStatsSections[0].slug}`} replace />;

  const cid = competitionId(editionId, leagueId);
  const query = params.toString();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Statystyki"
        icon={icons.table}
        aside={<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oficjalne dane · Genius Sports / FIBA LiveStats</p>}
      />
      <GeniusFilterBar editionId={editionId} onEditionChange={setEditionId} leagueId={leagueId} onLeagueChange={setLeagueId} />
      <nav aria-label="Sekcje statystyk" className="my-5 flex flex-wrap gap-2">
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
      {cid ? (
        // Sekcje wybieramy własnymi zakładkami, więc podmenu Genius (Team / Player) chowamy.
        <GeniusEmbed key={`${cid}-${section.slug}`} page={`/competition/${cid}/${section.path}`} showSubMenus={false} />
      ) : (
        <GeniusMissing editionId={editionId} leagueId={leagueId} />
      )}
    </div>
  );
}

export default StatisticsPage;
