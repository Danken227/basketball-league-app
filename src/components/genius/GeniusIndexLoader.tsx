import { useEffect } from 'react';
import { useGeniusIndex } from '../../hooks/useGeniusIndex';
import GeniusEmbed from './GeniusEmbed';
import { markFailed, pendingCompetitions, readTeamLinks, saveList, saveTeamNames, type IndexKind } from './geniusIndex';

const pageOf = (kind: IndexKind, cid: number) => `/competition/${cid}/${kind === 'teams' ? 'teams' : 'players'}`;
// Linki na listach Genius są już przepisane na nasze adresy (/druzyny/<id>, /zawodnicy/<id>).
const linkPattern: Record<IndexKind, RegExp> = { teams: /^\/druzyny\/(\d+)/, players: /^\/zawodnicy\/(\d+)/ };

// Uzupełnia indeks rozgrywek (geniusIndex) w tle: osadza poza ekranem listę drużyn albo zawodników
// kolejnych rozgrywek, po jednej naraz, i zapisuje numery z linków. Gdy indeks jest pełny, nic nie robi.
function GeniusIndexLoader({ kind }: { kind: IndexKind }) {
  useGeniusIndex();
  const next = pendingCompetitions(kind)[0];

  // Lista, która nie wczyta się w 25 s, jest pomijana w tej wizycie, żeby indeks nie stanął.
  useEffect(() => {
    if (next === undefined) return;
    const timer = window.setTimeout(() => markFailed(kind, next), 25000);
    return () => window.clearTimeout(timer);
  }, [kind, next]);

  if (next === undefined) return null;

  const onContent = (root: HTMLElement) => {
    const content = root.querySelector('.hs-embed');
    const compClass = content && [...content.classList].find((c) => c.startsWith('_comp_'));
    if (!content || (compClass && compClass !== `_comp_${next}`)) return;
    const ids = [...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!.match(linkPattern[kind])?.[1]).filter((id) => id !== undefined);
    saveList(kind, next, [...new Set(ids)]);
    if (kind === 'teams') saveTeamNames(readTeamLinks(root));
  };

  return (
    <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
      <GeniusEmbed key={`${kind}-${next}`} page={pageOf(kind, next)} showSubMenus={false} onContent={onContent} />
    </div>
  );
}

export default GeniusIndexLoader;
