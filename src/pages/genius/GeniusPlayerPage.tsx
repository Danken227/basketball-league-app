import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FilterRow, FilterSelect } from '../../components/common/Filters';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import { currentGeniusEdition, findCompetition, geniusEditionById, geniusEditions } from '../../components/genius/geniusConfig';
import { leagues, type League } from '../../data/league';

// Strona zawodnika z danych Genius. Genius pokazuje statystyki zawodnika zawsze w kontekście jednych
// rozgrywek, a w DALK zawodnik może grać w kilku drużynach na różnych poziomach (np. w 1. i 2. Lidze).
// Dlatego dla wybranej edycji pytamy o każdą ligę osobno i pokazujemy te, w których zawodnik wystąpił.

type Section = 'statistics' | 'gamelog';

interface TeamRef {
  name: string;
  href?: string;
}

interface BlockInfo {
  empty: boolean;
  name?: string;
  teams: TeamRef[];
}

const editionOptions = geniusEditions.map((e) => ({
  value: e.id,
  label: `Edycja ${e.name}${e.id === currentGeniusEdition.id ? ' (bieżąca)' : ''}`,
}));

const sections: { id: Section; label: string }[] = [
  { id: 'statistics', label: 'Statystyki' },
  { id: 'gamelog', label: 'Mecze' },
];

// Odczytuje z treści Genius: nazwisko, czy są jakiekolwiek występy i (w statystykach) drużynę z kolumny "Team".
function readBlock(root: HTMLElement, section: Section): BlockInfo {
  const name = root.querySelector('.person-name, .person-header h1')?.textContent?.trim() || undefined;
  const rows = [...root.querySelectorAll('table tbody tr')];
  const empty = rows.length === 0 || (rows.length === 1 && /no results/i.test(rows[0].textContent ?? ''));
  const teams: TeamRef[] = [];
  if (!empty && section === 'statistics') {
    for (const row of rows) {
      const cell = row.querySelectorAll('td')[1];
      const teamName = cell?.textContent?.trim();
      if (teamName && !teams.some((t) => t.name === teamName)) {
        teams.push({ name: teamName, href: cell.querySelector('a')?.getAttribute('href') ?? undefined });
      }
    }
  }
  return { empty, name, teams };
}

function PlayerBlocks({ personId, editionId, section }: { personId: string; editionId: string; section: Section }) {
  const edition = geniusEditionById.get(editionId)!;
  const blocks = leagues.flatMap((league) => {
    const cid = edition.competitions[league.id];
    return cid ? [{ league, cid }] : [];
  });
  const [info, setInfo] = useState<Record<number, BlockInfo>>({});

  const report = (cid: number, next: BlockInfo) =>
    setInfo((prev) => (JSON.stringify(prev[cid]) === JSON.stringify(next) ? prev : { ...prev, [cid]: next }));

  const loaded = blocks.filter((b) => info[b.cid]).length;
  const played = blocks.filter((b) => info[b.cid] && !info[b.cid].empty);
  const name = Object.values(info).find((i) => i.name)?.name;

  return (
    <>
      <section className="mt-4 rounded-xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-400">Edycja {edition.name}</p>
        <h1 className="mt-1 text-3xl font-black uppercase sm:text-4xl">{name ?? 'Zawodnik'}</h1>
        {played.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {played.map(({ league, cid }) => (
              <li key={cid} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                <span className="font-semibold text-orange-300">{league.name}</span>
                {info[cid].teams.map((team) => (
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
      </section>

      {loaded < blocks.length && <p className="mt-6 text-sm text-slate-500">Wczytywanie danych Genius Sports…</p>}
      {loaded === blocks.length && played.length === 0 && (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Zawodnik nie wystąpił w żadnym meczu w edycji {edition.name}. Wybierz inną edycję.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {blocks.map(({ league, cid }) => (
          <LeagueBlock key={cid} league={league} cid={cid} personId={personId} section={section} info={info[cid]} onInfo={(i) => report(cid, i)} />
        ))}
      </div>
    </>
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

// Blok jednej ligi; dopóki nie wiadomo, czy zawodnik w niej grał (albo nie grał), jest ukryty.
function LeagueBlock({ league, cid, personId, section, info, onInfo }: LeagueBlockProps) {
  return (
    <section className={!info || info.empty ? 'hidden' : ''}>
      <h2 className="mb-2 text-lg font-black text-slate-900">
        {league.name}
        {info && info.teams.length > 0 && <span className="font-semibold text-slate-500"> · {info.teams.map((t) => t.name).join(', ')}</span>}
      </h2>
      <GeniusEmbed
        page={`/competition/${cid}/person/${personId}/${section}`}
        showTitle
        showSubMenus={false}
        className="genius-person-block"
        onContent={(root) => onInfo(readBlock(root, section))}
      />
    </section>
  );
}

function GeniusPlayerPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const fromCompetition = findCompetition(Number(params.get('rozgrywki')));
  const requested = params.get('edycja');
  const editionId = requested && geniusEditionById.has(requested) ? requested : (fromCompetition?.editionId ?? currentGeniusEdition.id);
  const section: Section = params.get('sekcja') === 'gamelog' ? 'gamelog' : 'statistics';

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
          <FilterSelect label="Edycja" value={editionId} onChange={(value) => update({ edycja: value })} options={editionOptions} />
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
        </FilterRow>
      </div>
      {/* Klucz resetuje zebrane informacje o blokach przy zmianie edycji lub sekcji. */}
      <PlayerBlocks key={`${id}-${editionId}-${section}`} personId={id!} editionId={editionId} section={section} />
    </div>
  );
}

export default GeniusPlayerPage;
