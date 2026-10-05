import { currentSeason } from '../data/league';

// Strona drużyny pokazuje skład z danej edycji; bieżąca edycja nie potrzebuje parametru.
export const teamPath = (teamId: string, seasonId?: string) =>
  `/druzyny/${teamId}${seasonId && seasonId !== currentSeason.id ? `?edycja=${seasonId}` : ''}`;

export const playerPath = (playerId: string) => `/zawodnicy/${playerId}`;
