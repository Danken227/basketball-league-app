// Osiągnięcia zawodników i drużyn (zakładka „Osiągnięcia” w panelu administratora): medale drużyn, nagrody
// indywidualne (MVP, MVP finału, najlepszy strzelec, zbierający i asystujący) i medale dopisane zawodnikowi ręcznie.
// Zapisane po numerze rozgrywek (edycja × liga); strona zawodnika i drużyny wybiera z nich swoje.

export type AchievementType = 'medal' | 'mvp' | 'finalsMvp' | 'topScorer' | 'topRebounder' | 'topAssists';
export type MedalPlace = 1 | 2 | 3;

export interface Achievement {
  type: AchievementType;
  // Medal: miejsce drużyny (albo zawodnika — wpis ręczny).
  place?: MedalPlace;
  teamId?: string;
  teamName?: string;
  // Nagroda indywidualna i medal dopisany ręcznie: zawodnik.
  playerId?: string;
  playerName?: string;
  // Medal drużyny: zawodnicy, którzy zagrali w niej w tych rozgrywkach (medal pokazuje się też na ich stronach).
  players?: string[];
}

// Numer rozgrywek → osiągnięcia.
export type AchievementsByCompetition = Record<string, Achievement[]>;

export const individualAwards: { type: Exclude<AchievementType, 'medal'>; label: string; stat?: 'ppg' | 'rpg' | 'apg' }[] = [
  { type: 'mvp', label: 'MVP sezonu' },
  { type: 'finalsMvp', label: 'MVP finału' },
  { type: 'topScorer', label: 'Najlepszy strzelec', stat: 'ppg' },
  { type: 'topRebounder', label: 'Najlepiej zbierający', stat: 'rpg' },
  { type: 'topAssists', label: 'Najlepiej asystujący', stat: 'apg' },
];

export const medalNames: Record<MedalPlace, string> = { 1: 'Złoty medal', 2: 'Srebrny medal', 3: 'Brązowy medal' };
export const medalIcons: Record<MedalPlace, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export const achievementLabel = (achievement: Achievement) =>
  achievement.type === 'medal'
    ? medalNames[achievement.place ?? 1]
    : (individualAwards.find((award) => award.type === achievement.type)?.label ?? achievement.type);

export interface ListedAchievement extends Achievement {
  competitionId: number;
}

// Osiągnięcia zawodnika: nagrody i medale wpisane na niego oraz medale drużyn, w których zagrał.
export function playerAchievements(all: AchievementsByCompetition, playerId: string): ListedAchievement[] {
  return Object.entries(all).flatMap(([cid, items]) =>
    items
      .filter((item) => item.playerId === playerId || (!item.playerId && item.players?.includes(playerId)))
      .map((item) => ({ ...item, competitionId: Number(cid) })),
  );
}

// Medale drużyny (bez wpisów zawodników).
export function teamAchievements(all: AchievementsByCompetition, teamId: string): ListedAchievement[] {
  return Object.entries(all).flatMap(([cid, items]) =>
    items.filter((item) => item.type === 'medal' && !item.playerId && item.teamId === teamId).map((item) => ({ ...item, competitionId: Number(cid) })),
  );
}
