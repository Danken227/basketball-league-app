import { useLayoutEffect, useRef, useState } from 'react';
import { findCompetition, geniusEditionById, geniusEditions, geniusLeagueName } from '../genius/geniusConfig';
import { achievementLabel, individualAwards, medalIcons, type ListedAchievement } from '../../data/achievements';

// Osiągnięcia zawodnika albo drużyny (zakładka „Osiągnięcia” w panelu) jako odznaki nad statystykami:
// od najnowszej edycji, w edycji medale przed nagrodami. Zwinięte do jednej linii odznak; gdy się nie mieszczą,
// przycisk rozwija resztę. Bez osiągnięć nic się nie pokazuje.
const editionOrder = (cid: number) => {
  const found = findCompetition(cid);
  return found ? geniusEditions.findIndex((edition) => edition.id === found.editionId) : geniusEditions.length;
};
const typeOrder = (item: ListedAchievement) => (item.type === 'medal' ? (item.place ?? 1) - 4 : individualAwards.findIndex((award) => award.type === item.type));

function AchievementsStrip({ title, items, showTeam = false }: { title: string; items: ListedAchievement[]; showTeam?: boolean }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Ile odznak jest w pierwszej linii (reszta ukryta po zwinięciu).
  const [firstLine, setFirstLine] = useState<number>();

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const tops = [...list.children].map((child) => (child as HTMLElement).offsetTop);
      setFirstLine(tops.filter((top) => top === tops[0]).length);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items.length]);

  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => editionOrder(a.competitionId) - editionOrder(b.competitionId) || typeOrder(a) - typeOrder(b));
  const hidden = firstLine === undefined ? 0 : sorted.length - firstLine;
  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">{title}</h2>
        {hidden > 0 && (
          <button
            type="button"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Zwiń' : `Pokaż wszystkie (${sorted.length})`}
          </button>
        )}
      </div>
      {/* Zwinięte: wysokość jednej linii odznak (pomiar wszystkich odznak, więc lista zawsze ma pełną treść). */}
      <ul ref={listRef} className={`flex flex-wrap gap-2 ${expanded ? '' : 'max-h-[3.25rem] overflow-hidden'}`}>
        {sorted.map((item, index) => {
          const found = findCompetition(item.competitionId);
          const where = found ? `${geniusLeagueName(found.leagueId)} ${geniusEditionById.get(found.editionId)?.name ?? ''}` : '';
          const details = [where, showTeam && item.teamName].filter(Boolean).join(' · ');
          return (
            <li key={index} className="flex h-[3.25rem] items-center gap-2 rounded-lg bg-slate-50 px-3 ring-1 ring-inset ring-slate-200">
              <span className="text-xl leading-none" aria-hidden="true">
                {item.type === 'medal' ? medalIcons[item.place ?? 1] : '🏆'}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">{achievementLabel(item)}</span>
                {details && <span className="text-xs text-slate-500">{details}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default AchievementsStrip;
