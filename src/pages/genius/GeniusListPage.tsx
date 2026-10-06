import type { ReactNode } from 'react';
import PageHeader from '../../components/common/PageHeader';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import GeniusFilterBar from '../../components/genius/GeniusFilterBar';
import GeniusMissing from '../../components/genius/GeniusMissing';
import GeniusPrefetch from '../../components/genius/GeniusPrefetch';
import { competitionId } from '../../components/genius/geniusConfig';
import { leagueById, leagues, type LeagueId } from '../../data/league';
import { useGeniusFilters } from '../../hooks/useGeniusFilters';

interface GeniusListPageProps {
  title: string;
  icon: ReactNode;
  // Strona rozgrywek w Genius, np. "standings" -> /competition/{id}/standings.
  path: string;
  showMatchFilter?: boolean;
}

// Wspólny układ podstron Tabele / Terminarz / Drużyny w trybie Genius: nasz nagłówek i filtry,
// a w środku strona Genius dla rozgrywek wybranych edycją i poziomem.
function GeniusListPage({ title, icon, path, showMatchFilter }: GeniusListPageProps) {
  const { editionId, leagueId, phase, setEditionId, setLeagueId } = useGeniusFilters<LeagueId>('eks');
  const cid = competitionId(editionId, leagueId);
  // Skrypt Genius przyjmuje w ścieżce tylko litery, cyfry i kilka znaków (bez "%"), więc spacje zapisujemy jako "+", jak dalk.pl.
  const pageFor = (competition: number, phaseName = '') => `/competition/${competition}/${path}${phaseName ? `?phaseName=${phaseName.replace(/ /g, '+')}&` : ''}`;
  const page = pageFor(cid!, phase);

  // W tle: ta sama strona dla pozostałych lig edycji, a w tabelach także pozostałe grupy wybranej ligi.
  const prefetch = [
    ...leagues.flatMap((league) => {
      const other = competitionId(editionId, league.id);
      return other && league.id !== leagueId ? [{ page: pageFor(other), showMatchFilter }] : [];
    }),
    ...(path === 'standings' && cid
      ? leagueById
          .get(leagueId)!
          .groups.filter((g) => `Grupa ${g}` !== phase)
          .map((g) => ({ page: pageFor(cid, `Grupa ${g}`), showMatchFilter }))
      : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={title}
        icon={icon}
        aside={<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oficjalne dane · Genius Sports</p>}
      />
      <GeniusFilterBar editionId={editionId} onEditionChange={setEditionId} leagueId={leagueId} onLeagueChange={setLeagueId} />
      <div className="mt-6">
        {cid ? <GeniusEmbed page={page} showMatchFilter={showMatchFilter} /> : <GeniusMissing editionId={editionId} leagueId={leagueId} />}
      </div>
      <GeniusPrefetch key={`${editionId}-${leagueId}`} items={prefetch} />
    </div>
  );
}

export default GeniusListPage;
