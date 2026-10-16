// Drużyny rozgrywek i zawodnicy, którzy w nich zagrali, ze średnimi (zakładka „Osiągnięcia” w panelu
// administratora): medal drużyny trafia do jej zawodników (liderów sezonu zasadniczego liczy geniusSeasonLeaders.ts).
// Statystyki drużyny w Genius (/team/<numer>/statistics) wymieniają tylko zawodników z występami w tej drużynie.
// W wersji demonstracyjnej te same strony bierzemy z migawki (linki są w niej już przepisane na nasze adresy).
import { geniusCacheKey } from './geniusCache';
import { geniusSnapshot } from './geniusConfig';
import { fetchGeniusJson, type GeniusPageOptions } from './geniusFetch';
import { loadSnapshot } from './geniusSnapshot';

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

// Warianty stron jak w migawce: lista drużyn bez podmenu (GeniusIndexLoader), zakładki drużyny z nagłówkiem
// (strona drużyny).
const TEAMS_OPTIONS: GeniusPageOptions = { showSubMenus: false };
const TEAM_TAB_OPTIONS: GeniusPageOptions = { showTitle: true };

// Treść strony rozgrywek; pusta strona (przy przeciążeniu Genius nie ma klasy rozgrywek) — kolejna próba z innym adresem.
async function loadPage(page: string, cid: number, options: GeniusPageOptions): Promise<HTMLElement | undefined> {
  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html').body;
  if (geniusSnapshot) {
    const html = await loadSnapshot(geniusCacheKey({ page, ...options }));
    return html ? parse(html) : undefined;
  }
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const json = await fetchGeniusJson(attempt ? `${page}?r=${Date.now()}&` : page, options).catch(() => undefined);
    if (json?.html?.includes(`_comp_${cid}`)) return parse(json.html);
  }
  return undefined;
}

// Linki Genius (".../team/123", ".../person/456") albo już nasze ("/druzyny/123", "/zawodnicy/456" — migawka).
const PERSON_LINKS = 'a[href*="/person/"], a[href^="/zawodnicy/"]';
const TEAM_LINKS = 'a[href*="/team/"], a[href^="/druzyny/"]';
const idFrom = (href: string | null, kind: 'team' | 'person') =>
  decodeURIComponent(href ?? '').match(kind === 'team' ? /\/(?:team|druzyny)\/(\d+)/ : /\/(?:person|zawodnicy)\/(\d+)/)?.[1];

// Tabele statystyk drużyny: kolumny po nazwie z nagłówka (G, PPG, RPG, APG) z kilku tabel, po numerze zawodnika.
function readTeamStatistics(root: HTMLElement): RosterPlayer[] {
  const players = new Map<string, RosterPlayer>();
  root.querySelectorAll('table').forEach((table) => {
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim().toUpperCase() ?? '');
    [...table.tBodies].flatMap((body) => [...body.rows]).forEach((row) => {
      const link = row.querySelector(PERSON_LINKS);
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
  const list = await loadPage(`/competition/${cid}/teams`, cid, TEAMS_OPTIONS);
  if (!list) throw new Error('Genius nie oddał listy drużyn — spróbuj ponownie za chwilę.');
  const names = new Map<string, string>();
  list.querySelectorAll(TEAM_LINKS).forEach((link) => {
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
        const root = await loadPage(`/competition/${cid}/team/${team.id}/statistics`, cid, TEAM_TAB_OPTIONS);
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
  const root = await loadPage(`/competition/${cid}/team/${teamId}/roster`, cid, TEAM_TAB_OPTIONS);
  if (!root) throw new Error('Genius nie oddał kadry drużyny.');
  const players = new Map<string, string>();
  root.querySelectorAll(PERSON_LINKS).forEach((link) => {
    const id = idFrom(link.getAttribute('href'), 'person');
    const name = link.textContent?.replace(/\s+/g, ' ').trim();
    if (id && name && !players.has(id)) players.set(id, name);
  });
  return [...players].map(([id, name]) => ({ id, name }));
}
