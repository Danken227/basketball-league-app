import { Link, useParams, useSearchParams } from 'react-router-dom';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import { findCompetition } from '../../components/genius/geniusConfig';

// Strona drużyny albo zawodnika z Genius pod naszym adresem (/druzyny/91563?rozgrywki=49970&sekcja=roster).
// Podmenu Genius (np. Skład, Terminarz, Statystyki) przekłada się na parametr "sekcja".
function GeniusEntityPage({ kind }: { kind: 'team' | 'person' }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const cid = params.get('rozgrywki');
  // Drużyna domyślnie pokazuje skład, a zawodnik statystyki ze wszystkich rozgrywek
  // (zakładka "Profile" jest w Genius u amatorów zwykle pusta).
  const section = params.get('sekcja') ?? (kind === 'team' ? 'roster' : 'statistics');

  const base = cid ? `/competition/${cid}/${kind}/${id}` : `/${kind}/${id}`;
  const page = section ? `${base}/${section}` : base;

  const found = cid ? findCompetition(Number(cid)) : undefined;
  const listPath = kind === 'team' ? '/druzyny' : '/zawodnicy';
  const backTo = found && kind === 'team' ? `${listPath}?edycja=${found.editionId}&liga=${found.leagueId}` : listPath;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to={backTo} className="text-sm font-medium text-orange-600 hover:text-orange-700">
        ← {kind === 'team' ? 'Drużyny' : 'Zawodnicy'}
      </Link>
      <div className="mt-4">
        <GeniusEmbed key={page} page={page} showTitle />
      </div>
    </div>
  );
}

export default GeniusEntityPage;
