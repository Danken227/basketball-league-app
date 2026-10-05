import { leagueById, type LeagueId } from '../../data/league';
import { geniusEditionById } from './geniusConfig';

// Komunikat, gdy w wybranej edycji Genius nie ma rozgrywek danej ligi.
function GeniusMissing({ editionId, leagueId }: { editionId: string; leagueId: LeagueId }) {
  return (
    <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
      W edycji {geniusEditionById.get(editionId)?.name} nie ma rozgrywek: {leagueById.get(leagueId)?.name}.
    </p>
  );
}

export default GeniusMissing;
