import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FilterRow, FilterSelect } from '../../components/common/Filters';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import GeniusIndexLoader from '../../components/genius/GeniusIndexLoader';
import { currentGeniusEdition, findCompetition, geniusEditionById, geniusLeagueName } from '../../components/genius/geniusConfig';
import { competitionInfo, competitionsWith, pendingCompetitions, readTeamLinks, saveTeamNames, teamName } from '../../components/genius/geniusIndex';
import { placeholderLogo } from '../../components/genius/geniusLogo';
import { linkTeamSummary, readTeamSchedule, type TeamScheduleMatch } from '../../components/genius/geniusTeamSummary';
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
  // Drużyna domyślnie pokazuje podsumowanie (Summary, w Genius sekcja "home"); podmenu Genius (Summary, Roster…) przekłada się na parametr "sekcja".
  const section = params.get('sekcja') ?? 'home';
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

  // Poprawki nagłówka Genius: poziom rozgrywek pod nazwą (także juniorzy), a dla drużyny bez logo — nazwa
  // z indeksu (Genius podaje ją wtedy pustą) i zastępcze logo.
  const level = cid ? findCompetition(cid) : undefined;
  const levelText = level ? `${geniusLeagueName(level.leagueId)} · edycja ${geniusEditionById.get(level.editionId)!.name}` : '';
  const name = teamName(id!);
  const polishHeader = (root: HTMLElement) => {
    const header = root.querySelector('.team-header');
    const nameCell = header?.querySelector('.team-name');
    if (!header || !nameCell) return;
    const title = nameCell.querySelector('.team-title');
    if (title && !title.textContent?.trim() && name) title.textContent = name;
    const shownName = title?.textContent?.trim();
    if (!header.querySelector('img') && shownName) {
      const logo = document.createElement('div');
      logo.className = 'logo team-detail';
      const img = document.createElement('img');
      img.src = placeholderLogo(shownName);
      img.alt = shownName;
      logo.append(img);
      header.prepend(logo);
    }
    if (!levelText) return;
    let levelLine = nameCell.querySelector<HTMLElement>('.team-level');
    if (!levelLine) {
      levelLine = document.createElement('p');
      levelLine.className = 'team-level';
      nameCell.appendChild(levelLine);
    }
    if (levelLine.textContent !== levelText) levelLine.textContent = levelText;
  };

  // Podsumowanie: linki do rywali i statystyk meczów oraz hala najbliższych meczów — z terminarza drużyny,
  // wczytywanego w tle dopiero po treści strony (dwa osadzenia Genius naraz potrafią zamienić się treścią).
  const [summaryLoaded, setSummaryLoaded] = useState<string>();
  const [schedule, setSchedule] = useState<{ page: string; matches: TeamScheduleMatch[] }>();
  const schedulePage = cid && section === 'home' ? `/competition/${cid}/team/${id}/schedule` : undefined;
  const matches = schedule && schedule.page === schedulePage ? schedule.matches : [];
  const onContent = (root: HTMLElement) => {
    polishHeader(root);
    linkTeamSummary(root, matches);
    if (root.querySelector('.page-team .summary')) setSummaryLoaded(page);
  };

  // Nazwa (z indeksu) i terminarz mogą dojść już po wczytaniu treści — wtedy poprawiamy ją jeszcze raz.
  const embedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (embedRef.current && name) polishHeader(embedRef.current);
    if (embedRef.current) linkTeamSummary(embedRef.current, matches);
  });

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
      <div ref={embedRef} className="mt-6">
        <GeniusEmbed key={page} page={page} showTitle onContent={onContent} />
      </div>
      {/* Nazwy drużyny jeszcze nie znamy (a jest potrzebna, gdy nie ma logo): lista drużyn tych rozgrywek w tle. */}
      {!name && cid && (
        <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
          <GeniusEmbed page={`/competition/${cid}/teams`} onContent={(root) => saveTeamNames(readTeamLinks(root))} />
        </div>
      )}
      {schedulePage && summaryLoaded === page && (
        <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
          <GeniusEmbed
            key={schedulePage}
            page={schedulePage}
            onContent={(root) => {
              const found = readTeamSchedule(root, id!);
              if (found.length > 0 && found.length !== matches.length) setSchedule({ page: schedulePage, matches: found });
            }}
          />
        </div>
      )}
      {/* Indeks list drużyn buduje się w tle, po jednym zapytaniu naraz (raz na dobę). */}
      <GeniusIndexLoader kind="teams" />
    </div>
  );
}

export default GeniusTeamPage;
