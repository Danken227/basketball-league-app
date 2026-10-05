import { Navigate, useSearchParams } from 'react-router-dom';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import { mapGeniusPath } from '../../components/genius/geniusConfig';

// Wejście z linku Genius (/genius?&WHurl=/competition/..). Drużyny, zawodników i listy przekierowujemy
// na nasze podstrony, a resztę (np. relacja meczu, hala) pokazujemy tutaj.
function GeniusLinkPage() {
  const [params] = useSearchParams();
  const path = params.get('WHurl') ?? '';
  const mapped = mapGeniusPath(path);
  if (!mapped.startsWith('/genius')) return <Navigate to={mapped} replace />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <GeniusEmbed key={path} page={path} />
    </div>
  );
}

export default GeniusLinkPage;
