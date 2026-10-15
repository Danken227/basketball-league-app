import { findCompetition, geniusEditionById, geniusEditions, geniusLeagueName } from '../genius/geniusConfig';
import { achievementLabel, individualAwards, medalIcons, type ListedAchievement } from '../../data/achievements';

// Osiągnięcia zawodnika albo drużyny (zakładka „Osiągnięcia” w panelu) jako odznaki nad statystykami:
// od najnowszej edycji, w edycji medale przed nagrodami. Bez osiągnięć nic się nie pokazuje.
const editionOrder = (cid: number) => {
  const found = findCompetition(cid);
  return found ? geniusEditions.findIndex((edition) => edition.id === found.editionId) : geniusEditions.length;
};
const typeOrder = (item: ListedAchievement) => (item.type === 'medal' ? (item.place ?? 1) - 4 : individualAwards.findIndex((award) => award.type === item.type));

function AchievementsStrip({ title, items, showTeam = false }: { title: string; items: ListedAchievement[]; showTeam?: boolean }) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => editionOrder(a.competitionId) - editionOrder(b.competitionId) || typeOrder(a) - typeOrder(b));
  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-900">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {sorted.map((item, index) => {
          const found = findCompetition(item.competitionId);
          const where = found ? `${geniusLeagueName(found.leagueId)} ${geniusEditionById.get(found.editionId)?.name ?? ''}` : '';
          const details = [where, showTeam && item.teamName, item.value].filter(Boolean).join(' · ');
          return (
            <li key={index} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
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
