// Drużyny rozgrywek i zawodnicy, którzy w nich zagrali, ze średnimi (zakładka „Osiągnięcia” w panelu
// administratora): medal drużyny trafia do jej zawodników, a liderów (punkty, zbiórki, asysty) podpowiadamy.
// Statystyki drużyny w Genius (/team/<numer>/statistics) wymieniają tylko zawodników z występami w tej drużynie.
import { fetchGeniusJson } from './geniusFetch';

export interface RosterPlayer {
  id: string;
  name: string;
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
}

export interface RosterTeam {
  id: string;
  name: string;
  players: RosterPlayer[];
}

const ATTEMPTS = 3;
const PARALLEL = 4;

// Treść strony rozgrywek; pusta strona (przy przeciążeniu Genius nie ma klasy rozgrywek) — kolejna próba z innym adresem.
async function loadPage(page: string, cid: number): Promise<HTMLElement | undefined> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const json = await fetchGeniusJson(attempt ? `${page}?r=${Date.now()}&` : page, { showSubMenus: false }).catch(() => undefined);
    if (json?.html?.includes(`_comp_${cid}`)) return new DOMParser().parseFromString(json.html, 'text/html').body;
  }
  return undefined;
}

const idFrom = (href: string | null, kind: 'team' | 'person') => decodeURIComponent(href ?? '').match(new RegExp(`/${kind}/(\\d+)`))?.[1];

// Tabele statystyk drużyny: kolumny po nazwie z nagłówka (G, PPG, RPG, APG) z kilku tabel, po numerze zawodnika.
function readTeamStatistics(root: HTMLElement): RosterPlayer[] {
  const players = new Map<string, RosterPlayer>();
  root.querySelectorAll('table').forEach((table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim().toUpperCase() ?? '');
    [...table.tBodies].flatMap((body) => [...body.rows]).forEach((row) => {
      const link = row.querySelector('a[href*="/person/"]');
      const id = idFrom(link?.getAttribute('href') ?? null, 'person');
      if (!id) return;
      const player = players.get(id) ?? { id, name: link!.textContent?.replace(/\s+/g, ' ').trim() ?? id, games: 0, ppg: 0, rpg: 0, apg: 0 };
      const cell = (head: string) => {
        const index = heads.indexOf(head);
        return index < 0 ? undefined : Number(row.cells[index]?.textContent?.trim().replace(',', '.'));
      };
      player.games = cell('G') ?? player.games;
      player.ppg = cell('PPG') ?? player.ppg;
      player.rpg = cell('RPG') ?? player.rpg;
      player.apg = cell('APG') ?? player.apg;
      players.set(id, player);
    });
  });
  return [...players.values()];
}

// Drużyny rozgrywek (z listy drużyn) i ich zawodnicy. Drużyna, której statystyk Genius nie oddał, ma pustą listę
// i flagę failed.
export async function loadCompetitionRosters(cid: number, onProgress?: (done: number, total: number) => void): Promise<(RosterTeam & { failed?: boolean })[]> {
  const list = await loadPage(`/competition/${cid}/teams`, cid);
  if (!list) throw new Error('Genius nie oddał listy drużyn — spróbuj ponownie za chwilę.');
  const names = new Map<string, string>();
  list.querySelectorAll('a[href*="/team/"]').forEach((link) => {
    const id = idFrom(link.getAttribute('href'), 'team');
    const name = link.textContent?.replace(/\s+/g, ' ').trim();
    if (id && name && !names.has(id)) names.set(id, name);
  });
  const teams = [...names].map(([id, name]) => ({ id, name }));
  const result: (RosterTeam & { failed?: boolean })[] = [];
  let done = 0;
  onProgress?.(0, teams.length);
  for (let i = 0; i < teams.length; i += PARALLEL) {
    const batch = await Promise.all(
      teams.slice(i, i + PARALLEL).map(async (team) => {
        const root = await loadPage(`/competition/${cid}/team/${team.id}/statistics`, cid);
        onProgress?.(++done, teams.length);
        return root ? { ...team, players: readTeamStatistics(root) } : { ...team, players: [], failed: true };
      }),
    );
    result.push(...batch);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

// Kadra drużyny w rozgrywkach (/team/<numer>/roster) — wszyscy zgłoszeni, także ci bez występów.
export async function loadTeamRoster(cid: number, teamId: string): Promise<{ id: string; name: string }[]> {
  const root = await loadPage(`/competition/${cid}/team/${teamId}/roster`, cid);
  if (!root) throw new Error('Genius nie oddał kadry drużyny.');
  const players = new Map<string, string>();
  root.querySelectorAll('a[href*="/person/"]').forEach((link) => {
    const id = idFrom(link.getAttribute('href'), 'person');
    const name = link.textContent?.replace(/\s+/g, ' ').trim();
    if (id && name && !players.has(id)) players.set(id, name);
  });
  return [...players].map(([id, name]) => ({ id, name }));
}

// Lider w statystyce wśród zawodników z co najmniej połową meczów najczęściej grającego (żeby nie wygrał ktoś
// z jednym meczem).
export function suggestLeader(teams: RosterTeam[], stat: 'ppg' | 'rpg' | 'apg'): { player: RosterPlayer; team: RosterTeam } | undefined {
  const all = teams.flatMap((team) => team.players.map((player) => ({ player, team })));
  const maxGames = Math.max(0, ...all.map(({ player }) => player.games));
  return all
    .filter(({ player }) => player.games >= Math.ceil(maxGames / 2))
    .sort((a, b) => b.player[stat] - a.player[stat])[0];
}
