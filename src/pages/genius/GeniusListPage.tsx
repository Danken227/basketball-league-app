import type { ReactNode } from 'react';
import PageHeader from '../../components/common/PageHeader';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import GeniusFilterBar from '../../components/genius/GeniusFilterBar';
import GeniusMissing from '../../components/genius/GeniusMissing';
import { competitionId, type GeniusLeagueId } from '../../components/genius/geniusConfig';
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
// Bez wczytywania z wyprzedzeniem (obciążałoby serwer Genius); raz otwarte dane pokazują się potem z pamięci.
function GeniusListPage({ title, icon, path, showMatchFilter }: GeniusListPageProps) {
  const { editionId, leagueId, phase, setEditionId, setLeagueId } = useGeniusFilters<GeniusLeagueId>('eks');
  const cid = competitionId(editionId, leagueId);
  // Skrypt Genius przyjmuje w ścieżce tylko litery, cyfry i kilka znaków (bez "%"), więc spacje zapisujemy jako "+", jak dalk.pl.
  const page = `/competition/${cid}/${path}${phase ? `?phaseName=${phase.replace(/ /g, '+')}&` : ''}`;

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
    </div>
  );
}

export default GeniusListPage;
