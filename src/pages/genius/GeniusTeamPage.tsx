import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FilterRow, FilterSelect } from '../../components/common/Filters';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import GeniusIndexLoader from '../../components/genius/GeniusIndexLoader';
import { currentGeniusEdition, geniusEditionById } from '../../components/genius/geniusConfig';
import { competitionInfo, competitionsWith, pendingCompetitions } from '../../components/genius/geniusIndex';
import { leagueById } from '../../data/league';
import { useGeniusIndex } from '../../hooks/useGeniusIndex';

// Strona drużyny z Genius pod naszym adresem (/druzyny/91563?rozgrywki=49970&sekcja=roster).
// Filtr edycji pokazuje tylko edycje, w których drużyna występowała (indeks list drużyn), a pod nazwą
// drużyny wypisujemy poziom rozgrywek w wybranej edycji.
function GeniusTeamPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  useGeniusIndex();

  const teamCompetitions = competitionsWith('teams', id!);
  const requestedCid = Number(params.get('rozgrywki')) || undefined;
  // Bez wskazanych rozgrywek bierzemy najnowsze, w których drużyna grała (gdy indeks już je zna).
  const cid = requestedCid ?? teamCompetitions[0];
  const info = cid ? competitionInfo(cid) : undefined;
  // Drużyna domyślnie pokazuje skład; podmenu Genius (Summary, Roster…) przekłada się na parametr "sekcja".
  const section = params.get('sekcja') ?? 'roster';
  const page = cid ? `/competition/${cid}/team/${id}/${section}` : `/team/${id}`;

  // Edycje drużyny od najnowszej (wybrana zawsze na liście, nawet zanim indeks się zbuduje).
  const editions = [...new Set([...(info ? [info.editionId] : []), ...teamCompetitions.map((c) => competitionInfo(c)!.editionId)])]
    .map((editionId) => geniusEditionById.get(editionId)!)
    .sort((a, b) => [...geniusEditionById.keys()].indexOf(a.id) - [...geniusEditionById.keys()].indexOf(b.id));
  const options = editions.map((e) => ({ value: e.id, label: `Edycja ${e.name}${e.id === currentGeniusEdition.id ? ' (bieżąca)' : ''}` }));
  const listsLeft = pendingCompetitions('teams').length;

  const changeEdition = (editionId: string) => {
    const target = teamCompetitions.find((c) => competitionInfo(c)!.editionId === editionId);
    if (!target) return;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('rozgrywki', String(target));
      return next;
    });
  };

  // Poziom rozgrywek pod nazwą drużyny w nagłówku Genius (dopisywany do treści osadzenia).
  const levelText = info ? `${leagueById.get(info.leagueId)!.name} · edycja ${geniusEditionById.get(info.editionId)!.name}` : '';
  const addLevel = (root: HTMLElement) => {
    const nameCell = root.querySelector('.team-header .team-name');
    if (!nameCell || !levelText) return;
    let level = nameCell.querySelector<HTMLElement>('.team-level');
    if (!level) {
      level = document.createElement('p');
      level.className = 'team-level';
      nameCell.appendChild(level);
    }
    if (level.textContent !== levelText) level.textContent = levelText;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to={info ? `/druzyny?edycja=${info.editionId}&liga=${info.leagueId}` : '/druzyny'} className="text-sm font-medium text-orange-600 hover:text-orange-700">
        ← Drużyny
      </Link>
      <div className="mt-4">
        <FilterRow>
          {info && <FilterSelect label="Edycja" value={info.editionId} onChange={changeEdition} options={options} />}
          {listsLeft > 0 && <p className="ml-auto text-xs text-slate-500">Sprawdzam, w których edycjach drużyna grała… (listy rozgrywek: zostało {listsLeft})</p>}
        </FilterRow>
      </div>
      <div className="mt-6">
        <GeniusEmbed key={page} page={page} showTitle onContent={addLevel} />
      </div>
      {/* Indeks list drużyn buduje się w tle, po jednym zapytaniu naraz (raz na dobę). */}
      <GeniusIndexLoader kind="teams" />
    </div>
  );
}

export default GeniusTeamPage;
