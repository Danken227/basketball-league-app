import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AchievementsStrip from '../../components/common/AchievementsStrip';
import { playerAchievements, useAchievements } from '../../data/achievements';
import { FilterRow, FilterSelect } from '../../components/common/Filters';
import PhotoDialog from '../../components/common/PhotoDialog';
import GeniusEmbed, { type StatsMode } from '../../components/genius/GeniusEmbed';
import GeniusIndexLoader from '../../components/genius/GeniusIndexLoader';
import { useForegroundReady } from '../../components/genius/geniusPriority';
import { currentGeniusEdition, findCompetition, geniusEditionById, geniusEditions, geniusSnapshot } from '../../components/genius/geniusConfig';
import { awaitingHistory, competitionsWith, indexedCompetitions, loadHistory, pendingCompetitions, personTeams, playedIn, savePersonTeams, savePlayed, type PersonTeam } from '../../components/genius/geniusIndex';
import { leagues, type League } from '../../data/league';
import { useGeniusIndex } from '../../hooks/useGeniusIndex';
import StatsModeToggle from '../../components/genius/StatsModeToggle';
import PlayerRecords from '../../components/genius/PlayerRecords';

// Strona zawodnika z danych Genius. Genius pokazuje statystyki zawodnika zawsze w kontekście jednych
// rozgrywek, a w DALK zawodnik może grać w kilku drużynach na różnych poziomach (np. w 1. i 2. Lidze).
// Dlatego dla wybranej edycji pytamy o każdą ligę osobno i pokazujemy te, w których zawodnik wystąpił.

type Section = 'statistics' | 'gamelog' | 'records';

interface BlockInfo {
  empty: boolean;
  // Wersja demonstracyjna: tej strony nie ma w migawce danych (to nie znaczy, że zawodnik nie grał).
  missing?: boolean;
  // Genius odpowiedział bez tabeli statystyk (np. przy chwilowej awarii) — nie wiadomo, czy zawodnik grał.
  failed?: boolean;
  name?: string;
  // Zdjęcie zawodnika z nagłówka Genius (tylko gdy liga je dodała — bez zdjęcia Genius nie podaje bloku .photo).
  photo?: string;
  teams: PersonTeam[];
}

const editionOptions = geniusEditions.map((e) => ({
  value: e.id,
  label: `Edycja ${e.name}${e.id === currentGeniusEdition.id ? ' (bieżąca)' : ''}`,
}));

const sections: { id: Section; label: string }[] = [
  { id: 'statistics', label: 'Statystyki' },
  { id: 'gamelog', label: 'Mecze' },
  { id: 'records', label: 'Rekordy' },
];

// Odczytuje z treści Genius: nazwisko, czy są jakiekolwiek występy i (w statystykach) drużynę z kolumny "Team".
function readBlock(root: HTMLElement, section: Section): BlockInfo {
  const name = root.querySelector('.person-name, .person-header h1')?.textContent?.trim() || undefined;
  const photo = root.querySelector<HTMLImageElement>('.person-header .photo img')?.getAttribute('src') || undefined;
  const rows = [...root.querySelectorAll('table tbody tr')];
  const empty = rows.length === 0 || (rows.length === 1 && /no results|brak wyników/i.test(rows[0].textContent ?? ''));
  // Brak występów potwierdza tylko tabela Genius (z wierszem "No results"); odpowiedź bez tabeli to błąd po stronie
  // Genius — nie zapisujemy jej w indeksie jako "nie grał", bo zostałoby to zapamiętane na dobę.
  const failed = !root.querySelector('table') && !root.querySelector('.genius-snapshot-missing');
  const teams: PersonTeam[] = [];
  if (!empty && section === 'statistics') {
    for (const row of rows) {
      const cell = row.querySelectorAll('td')[1];
      const teamName = cell?.textContent?.trim();
      if (teamName && !teams.some((t) => t.name === teamName)) {
        teams.push({ name: teamName, href: cell.querySelector('a')?.getAttribute('href') ?? undefined });
      }
    }
  }
  const missing = Boolean(root.querySelector('.genius-snapshot-missing'));
  return { empty, missing, failed, name, photo, teams };
}

// Genius podaje zdjęcie w kilku rozmiarach, rozróżnionych końcówką nazwy pliku: T1 (75 px), S1 (200 px, miniatura
// na stronie zawodnika), M1 (400 px), L1 (600 px). Do powiększenia bierzemy największe.
const largePhoto = (src: string) => src.replace(/[TSM]1(\.\w+)$/, 'L1$1');

// Rozgrywki, w których zawodnik grał (wszystkie edycje): potwierdzone występy albo jeszcze niesprawdzone, a zawodnik
// jest na liście zawodników — do rekordów całej kariery.
const careerCompetitions = (personId: string) => {
  const listed = new Set(competitionsWith('players', personId));
  return indexedCompetitions.filter(({ cid }) => playedIn(personId, cid) ?? listed.has(cid)).map(({ cid }) => cid);
};

function PlayerBlocks({ personId, editionId, section }: { personId: string; editionId: string; section: Section }) {
  const edition = geniusEditionById.get(editionId)!;
  const blocks = leagues.flatMap((league) => {
    const cid = edition.competitions[league.id];
    return cid ? [{ league, cid }] : [];
  });
  const [info, setInfo] = useState<Record<number, BlockInfo>>({});

  useGeniusIndex();
  const report = (cid: number, next: BlockInfo) => {
    // Przy okazji zapisujemy w indeksie, czy zawodnik grał w tych rozgrywkach (lista edycji w filtrze)
    // i w jakich drużynach (zakładka "Mecze" nie ma kolumny drużyny, więc stamtąd ją bierze).
    if (!next.missing && !next.failed) savePlayed(personId, cid, !next.empty);
    if (next.teams.length > 0) savePersonTeams(personId, cid, next.teams);
    setInfo((prev) => (JSON.stringify(prev[cid]) === JSON.stringify(next) ? prev : { ...prev, [cid]: next }));
  };

  const loaded = blocks.filter((b) => info[b.cid]).length;
  const played = blocks.filter((b) => info[b.cid] && !info[b.cid].empty);
  const name = Object.values(info).find((i) => i.name)?.name;
  const photo = Object.values(info).find((i) => i.photo)?.photo;

  // Cała treść w ramce jak strona drużyny (karta osadzenia Genius) — czarny nagłówek odcina się od niej także w trybie ciemnym.
  // Na telefonie zdjęcie nad nazwiskiem (nazwisko ma całą szerokość). Czcionkę nazwiska dobieramy do szerokości ramki
  // i najdłuższego słowa (jednostki cqw), żeby słowo mieściło się w linii; poniżej 20 px słowo już się łamie.
  const longestWord = Math.max(8, ...(name ?? '').split(/\s+/).map((word) => word.length));
  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <section className="keep-dark flex flex-col items-start gap-4 rounded-xl bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        {photo && (
          <PhotoDialog thumbnail={photo} full={largePhoto(photo)} alt={name ?? 'Zdjęcie zawodnika'} className="h-24 w-24 shrink-0 ring-2 ring-white/10 sm:h-32 sm:w-32" />
        )}
        <div className="@container w-full min-w-0 sm:flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-400">Edycja {edition.name}</p>
          <h1
            className="mt-1 font-black uppercase leading-tight [overflow-wrap:anywhere]"
            style={{ fontSize: `clamp(1.25rem, calc(100cqw / ${(longestWord * 0.75).toFixed(2)}), 2.25rem)` }}
          >
            {name ?? 'Zawodnik'}
          </h1>
          {played.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {played.map(({ league, cid }) => (
                <li key={cid} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                  <span className="font-semibold text-orange-300">{league.name}</span>
                  {teamsOf(personId, cid, info[cid]).map((team) => (
                    <span key={team.name}>
                      {' · '}
                      {team.href ? (
                        <Link to={team.href} className="hover:text-orange-300 hover:underline">
                          {team.name}
                        </Link>
                      ) : (
                        team.name
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {loaded < blocks.length && <p className="mt-6 text-sm text-slate-500">Wczytywanie danych Genius Sports…</p>}
      {loaded === blocks.length && played.length === 0 && (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {blocks.some((b) => info[b.cid]?.failed)
            ? 'Genius Sports nie zwrócił danych zawodnika. Spróbuj odświeżyć stronę za chwilę.'
            : blocks.some((b) => info[b.cid]?.missing)
              ? 'Tej części strony zawodnika nie ma w wersji demonstracyjnej (zapis danych Genius Sports).'
              : `Zawodnik nie wystąpił w żadnym meczu w edycji ${edition.name}. Wybierz inną edycję.`}
        </p>
      )}

      {/* Rekordy liczymy z zakładki „Mecze” — bloki lig wczytują ją w tle (nazwisko, zdjęcie, występy w nagłówku). */}
      <div className={`mt-6 flex flex-col gap-6 ${section === 'records' ? 'hidden' : ''}`}>
        {blocks.map(({ league, cid }) => (
          <LeagueBlock
            key={cid}
            league={league}
            cid={cid}
            personId={personId}
            section={section === 'records' ? 'gamelog' : section}
            info={info[cid]}
            onInfo={(i) => report(cid, i)}
          />
        ))}
      </div>
      {section === 'records' && loaded === blocks.length && played.length > 0 && (
        <PlayerRecords
          personId={personId}
          seasonName={edition.name}
          seasonCids={played.map(({ cid }) => cid)}
          careerCids={[...new Set([...played.map(({ cid }) => cid), ...careerCompetitions(personId)])]}
        />
      )}
    </div>
  );
}

interface LeagueBlockProps {
  league: League;
  cid: number;
  personId: string;
  section: Section;
  info?: BlockInfo;
  onInfo: (info: BlockInfo) => void;
}

// Drużyny zawodnika w rozgrywkach: z wczytanych statystyk, a w zakładce "Mecze" z indeksu.
const teamsOf = (personId: string, cid: number, info?: BlockInfo) =>
  info && info.teams.length > 0 ? info.teams : (personTeams(personId, cid) ?? []);

// Blok jednej ligi; dopóki nie wiadomo, czy zawodnik w niej grał (albo nie grał), jest ukryty.
function LeagueBlock({ league, cid, personId, section, info, onInfo }: LeagueBlockProps) {
  const [mode, setMode] = useState<StatsMode>('avg');
  const teams = teamsOf(personId, cid, info);
  const visible = Boolean(info) && !info!.empty;
  return (
    <section className={visible ? '' : 'hidden'}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-black text-slate-900">
          {league.name}
          {teams.length > 0 && (
            <span className="font-semibold text-slate-500">
              {' · '}
              {teams.map((team, i) => (
                <span key={team.name}>
                  {i > 0 && ', '}
                  {team.href ? (
                    <Link to={team.href} className="hover:text-orange-600 hover:underline">
                      {team.name}
                    </Link>
                  ) : (
                    team.name
                  )}
                </span>
              ))}
            </span>
          )}
        </h2>
        {section === 'statistics' && <StatsModeToggle value={mode} onChange={setMode} />}
      </div>
      <GeniusEmbed
        page={`/competition/${cid}/person/${personId}/${section}`}
        showTitle
        showSubMenus={false}
        statsMode={section === 'statistics' ? mode : undefined}
        className="genius-person-block"
        onContent={(root) => onInfo(readBlock(root, section))}
      />
      {/* "Mecze" bez zapamiętanej drużyny: doczytujemy ją w tle ze statystyk tych rozgrywek. */}
      {section === 'gamelog' && visible && teams.length === 0 && <TeamsFetcher personId={personId} cid={cid} />}
    </section>
  );
}

function TeamsFetcher({ personId, cid }: { personId: string; cid: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
      <GeniusEmbed
        page={`/competition/${cid}/person/${personId}/statistics`}
        showSubMenus={false}
        onContent={(root) => {
          const { teams } = readBlock(root, 'statistics');
          if (teams.length > 0) savePersonTeams(personId, cid, teams);
        }}
      />
    </div>
  );
}

// Sprawdza w tle (po jednym zapytaniu) występy zawodnika w rozgrywkach, na których listach figuruje,
// a jeszcze niesprawdzonych. Wynik trafia do indeksu i zawęża listę edycji w filtrze.
// Zaczyna dopiero, gdy statystyki wybranej edycji są na ekranie (geniusPriority).
function PlayedChecker({ personId }: { personId: string }) {
  useGeniusIndex();
  const ready = useForegroundReady();
  // Zamknięte rozgrywki rozstrzyga plik list (geniusIndex) — do jego wczytania o nie nie pytamy.
  const next = ready ? competitionsWith('players', personId).find((cid) => playedIn(personId, cid) === undefined && !awaitingHistory(cid)) : undefined;

  // Gdy sprawdzenie się nie uda, zostawiamy edycję na liście (lepiej pokazać za dużo niż ukryć występy).
  useEffect(() => {
    if (next === undefined) return;
    const timer = window.setTimeout(() => savePlayed(personId, next, true), 20000);
    return () => window.clearTimeout(timer);
  }, [personId, next]);

  if (next === undefined) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
      <GeniusEmbed
        key={next}
        page={`/competition/${next}/person/${personId}/statistics`}
        showSubMenus={false}
        onContent={(root) => {
          const block = readBlock(root, 'statistics');
          if (!block.failed) savePlayed(personId, next, !block.empty);
          if (block.teams.length > 0) savePersonTeams(personId, next, block.teams);
        }}
      />
    </div>
  );
}

function GeniusPlayerPage() {
  const { id } = useParams();
  const achievements = useAchievements();
  const [params, setParams] = useSearchParams();
  useGeniusIndex();
  // W wersji demonstracyjnej nie ma ładowarki indeksu (GeniusIndexLoader), a to ona wczytuje listy zamkniętych
  // edycji (kto zagrał). Bez nich filtr edycji znałby tylko oglądaną edycję — wczytujemy je tu.
  useEffect(() => {
    if (geniusSnapshot) loadHistory();
  }, []);
  const fromCompetition = findCompetition(Number(params.get('rozgrywki')));
  const requested = params.get('edycja');
  const editionId = requested && geniusEditionById.has(requested) ? requested : (fromCompetition?.editionId ?? currentGeniusEdition.id);
  const section: Section = sections.find((s) => s.id === params.get('sekcja'))?.id ?? 'statistics';

  // Edycje, w których zawodnik zagrał choć jeden mecz (wybrana zostaje na liście zawsze).
  const playedEditions = geniusEditions.filter((e) => Object.values(e.competitions).some((cid) => playedIn(id!, cid)));
  const options = editionOptions.filter((o) => o.value === editionId || playedEditions.some((e) => e.id === o.value));
  const listsLeft = pendingCompetitions('players').length;
  const checksLeft = competitionsWith('players', id!).filter((cid) => playedIn(id!, cid) === undefined).length;
  // W migawce nie budujemy indeksu (GeniusIndexLoader) — nie ma czego sprawdzać.
  const checking = !geniusSnapshot && (listsLeft > 0 || checksLeft > 0);

  // Wejście bez wskazanej edycji (np. z listy historycznej): gdy w bieżącej zawodnik nie zagrał,
  // przechodzimy na jego najnowszą edycję z występami.
  const currentAllChecked = Object.values(geniusEditionById.get(editionId)!.competitions).every((cid) => playedIn(id!, cid) === false);
  const autoEdition = !requested && !fromCompetition && currentAllChecked ? playedEditions[0]?.id : undefined;
  useEffect(() => {
    if (!autoEdition) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('edycja', autoEdition);
        return next;
      },
      { replace: true },
    );
  }, [autoEdition, setParams]);

  const update = (changes: Record<string, string>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        // Po świadomym wyborze edycji numer rozgrywek z linku nie jest już potrzebny.
        next.delete('rozgrywki');
        next.set('edycja', editionId);
        Object.entries(changes).forEach(([key, value]) => next.set(key, value));
        return next;
      },
      { replace: true },
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/zawodnicy" className="text-sm font-medium text-orange-600 hover:text-orange-700">
        ← Zawodnicy
      </Link>
      <div className="mt-4">
        <FilterRow>
          <FilterSelect label="Edycja" value={editionId} onChange={(value) => update({ edycja: value })} options={options} />
          <div role="tablist" className="flex gap-2">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                onClick={() => update({ sekcja: s.id })}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  section === s.id ? 'bg-orange-500 text-slate-950' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {checking && (
            <p className="ml-auto text-xs text-slate-500">
              Sprawdzam, w których edycjach zawodnik grał…
              {listsLeft > 0 && ` (listy rozgrywek: zostało ${listsLeft})`}
            </p>
          )}
        </FilterRow>
      </div>
      <AchievementsStrip title="Osiągnięcia" items={playerAchievements(achievements, id!)} showTeam />
      {/* Indeks list zawodników i sprawdzanie występów działają w tle, po jednym zapytaniu naraz. */}
      {!geniusSnapshot && <GeniusIndexLoader kind="players" />}
      {!geniusSnapshot && <PlayedChecker personId={id!} />}
      {/* Klucz resetuje zebrane informacje o blokach przy zmianie edycji lub sekcji. */}
      <PlayerBlocks key={`${id}-${editionId}-${section}`} personId={id!} editionId={editionId} section={section} />
    </div>
  );
}

export default GeniusPlayerPage;
