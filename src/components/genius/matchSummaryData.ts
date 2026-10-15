// Dane do naszej zakładki „Summary” meczu (MatchSummary.tsx), w układzie jak na plk.pl.
// - Z treści zakładki Summary w Genius: drużyny (nagłówek), liderzy meczu (po 5 zawodników w kategoriach) i porównanie
//   drużyn (eval, asysty, bloki…, najwyższe prowadzenie, najdłuższa seria).
// - Z zapisu akcji (play by play): wyniki kwart, zmiany prowadzenia, remisy, czas prowadzenia i punkty z ławki.
//   Zapis akcji strona meczu i tak pobiera w tle (zakładki na zapas), więc liczenie nie dokłada zapytań.

export interface SummaryTeam {
  name: string;
  logo?: string;
}

export interface Leader {
  name: string;
  href?: string;
  photo?: string;
  // 0 — gospodarz, 1 — gość (po logo drużyny); undefined, gdy nie da się rozpoznać.
  team?: 0 | 1;
  value: string;
}

export type LeaderCategory = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'eff';

export interface CompareRow {
  key: string;
  home: string;
  away: string;
}

export interface SummaryData {
  teams: [SummaryTeam, SummaryTeam];
  leaders: Partial<Record<LeaderCategory, Leader[]>>;
  compare: CompareRow[];
  date?: string;
}

// Kategorie liderów w Genius (nagłówki bloków po angielsku i po polsku — tłumaczenie geniusI18n bywa włączone).
const leaderTitles: Record<LeaderCategory, string[]> = {
  eff: ['efficiency', 'eval', 'efektywność'],
  pts: ['points', 'punkty'],
  ast: ['assists', 'asysty'],
  reb: ['total rebounds', 'zbiórki'],
  blk: ['blocks', 'bloki'],
  stl: ['steals', 'przechwyty'],
};

// Wiersze porównania drużyn: klucz po angielskiej nazwie z Genius (albo jej tłumaczeniu).
const compareKeys: Record<string, string[]> = {
  eff: ['efficiency', 'eval', 'efektywność'],
  ast: ['assists', 'asysty'],
  blk: ['blocks', 'bloki'],
  fgm: ['field goals made', 'celne rzuty z gry'],
  pf: ['personal foul', 'faule osobiste', 'faule'],
  ftm: ['free throws made', 'celne rzuty wolne'],
  '3pm': ['3 points made', 'celne za 3', 'celne rzuty za 3'],
  '2pm': ['2 points made', 'celne za 2', 'celne rzuty za 2'],
  lead: ['biggest lead', 'najwyższe prowadzenie'],
  run: ['biggest scoring run', 'najdłuższa seria punktowa'],
};

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const keyOf = (text: string, keys: Record<string, string[]>) => Object.entries(keys).find(([, names]) => names.includes(text.toLowerCase()))?.[0];

// Odczyt z treści zakładki Summary (po naszych poprawkach: linki do zawodników prowadzą na nasze strony).
// undefined, gdy nie ma liderów (mecz przed rozpoczęciem) — wtedy zostaje widok Genius.
export function readSummary(root: HTMLElement): SummaryData | undefined {
  const header = root.querySelector('.match-header');
  if (!header) return undefined;
  const team = (side: 'home' | 'away'): SummaryTeam => ({
    name: clean(header.querySelector(`.${side}-wrapper .name`)?.textContent),
    logo: header.querySelector<HTMLImageElement>(`.${side}-logo`)?.src || undefined,
  });
  const teams: [SummaryTeam, SummaryTeam] = [team('home'), team('away')];

  const leaders: SummaryData['leaders'] = {};
  root.querySelectorAll('.summary-leaders-detail').forEach((block) => {
    const category = keyOf(clean(block.querySelector('h4')?.textContent), leaderTitles) as LeaderCategory | undefined;
    if (!category) return;
    leaders[category] = [...block.querySelectorAll('tbody tr')].map((row) => {
      const person = row.querySelector('.ld-person');
      const link = [...(person?.querySelectorAll('a') ?? [])].find((a) => clean(a.textContent));
      const photo = person?.querySelector<HTMLImageElement>('.playerphoto img')?.src;
      const logo = [...(person?.querySelectorAll('img') ?? [])].find((img) => !img.closest('.playerphoto'))?.src;
      const side = logo ? teams.findIndex((t) => t.logo === logo) : -1;
      return {
        name: clean(link?.textContent),
        href: link?.getAttribute('href') ?? undefined,
        photo,
        team: side === 0 || side === 1 ? side : undefined,
        value: clean(row.querySelector('.ld-value')?.textContent),
      };
    });
  });
  if (Object.keys(leaders).length === 0) return undefined;

  const compare = [...root.querySelectorAll('.summary-compare-detail')].flatMap((row) => {
    const key = keyOf(clean(row.querySelector('.fieldName')?.textContent), compareKeys);
    return key
      ? [{ key, home: clean(row.querySelector('.fieldHomeStatNumber')?.textContent) || '0', away: clean(row.querySelector('.fieldAwayStatNumber')?.textContent) || '0' }]
      : [];
  });
  return { teams, leaders, compare, date: clean(header.querySelector('.match-time span')?.textContent) || undefined };
}

// Adres, pod którym migawka (wersja demonstracyjna) trzyma dane policzone z zapisu akcji meczu poprzedniej edycji
// (samej strony zapisu akcji w migawce dla niej nie ma — SnapshotCrawler).
export const pbpStatsPage = (matchId: string | undefined, cid: string | null) =>
  cid ? `/competition/${cid}/match/${matchId}/pbp-stats` : `/match/${matchId}/pbp-stats`;

export interface PlayByPlayStats {
  // Punkty w kolejnych kwartach (i dogrywkach): [gospodarz, gość].
  periods: [number, number][];
  leadChanges: number;
  ties: number;
  // Sekundy prowadzenia: [gospodarz, gość].
  timeLeading: [number, number];
  benchPoints: [number, number];
}

const REGULAR_PERIOD_S = 10 * 60;
const OVERTIME_S = 5 * 60;

// Czas akcji "09:47:00" (minuty, sekundy, setne — zegar do końca kwarty) → sekundy do końca.
const clockSeconds = (text: string) => {
  const m = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};

// Liczenie z zapisu akcji. Akcje idą od początku meczu; drużyna 1 to gospodarz, wynik "gospodarz-gość".
// undefined, gdy zapisu nie ma albo jest niepełny (suma punktów z akcji nie zgadza się z wynikiem).
export function readPlayByPlay(root: HTMLElement): PlayByPlayStats | undefined {
  const actions = [...root.querySelectorAll<HTMLElement>('#playbyplay .pbpa')];
  if (actions.length === 0) return undefined;

  const periods: [number, number][] = [];
  const score: [number, number] = [0, 0];
  const timeLeading: [number, number] = [0, 0];
  const benchPoints: [number, number] = [0, 0];
  let leadChanges = 0;
  let ties = 0;
  // Kto prowadzi teraz (undefined przy remisie) i kto prowadził ostatnio (zmiana prowadzenia: A, remis, B — jedna).
  let leader: 0 | 1 | undefined;
  let lastLeader: 0 | 1 | undefined;
  // Sekundy od początku meczu w chwili poprzedniej akcji.
  let lastElapsed = 0;
  // Pierwsza piątka: zawodnicy, których pierwszą akcją nie jest wejście z ławki.
  const seen = new Set<string>();
  const starters = new Set<string>();

  for (const action of actions) {
    const period = Number(action.className.match(/\bper_(\d+)/)?.[1] ?? 1);
    const team = Number(action.className.match(/\bpbpt(\d)/)?.[1] ?? 0);
    const player = clean(action.querySelector('.pbp-action strong')?.textContent);
    if ((team === 1 || team === 2) && player && !seen.has(`${team}:${player}`)) {
      seen.add(`${team}:${player}`);
      if (!/substitution in/i.test(action.querySelector('.pbp-action')?.textContent ?? '')) starters.add(`${team}:${player}`);
    }

    // Czas prowadzenia płynie między akcjami (zegar kwarty odlicza w dół; dogrywki po 5 minut).
    const remaining = clockSeconds(action.querySelector('.pbp-time')?.textContent ?? '');
    if (remaining !== undefined) {
      const start = period <= 4 ? (period - 1) * REGULAR_PERIOD_S : 4 * REGULAR_PERIOD_S + (period - 5) * OVERTIME_S;
      const elapsed = start + Math.max(0, (period <= 4 ? REGULAR_PERIOD_S : OVERTIME_S) - remaining);
      if (elapsed > lastElapsed) {
        if (leader !== undefined) timeLeading[leader] += elapsed - lastElapsed;
        lastElapsed = elapsed;
      }
    }

    while (periods.length < period) periods.push([0, 0]);
    if (!action.classList.contains('scaction') || (team !== 1 && team !== 2)) continue;
    const points = action.classList.contains('pbpty3pt') ? 3 : action.classList.contains('pbpty2pt') ? 2 : 1;
    const side = (team - 1) as 0 | 1;
    score[side] += points;
    periods[period - 1][side] += points;
    if (player && !starters.has(`${team}:${player}`)) benchPoints[side] += points;

    leader = score[0] === score[1] ? undefined : score[0] > score[1] ? 0 : 1;
    if (leader === undefined) ties++;
    else {
      if (lastLeader !== undefined && leader !== lastLeader) leadChanges++;
      lastLeader = leader;
    }
  }

  // Zgodność z wynikiem w zapisie (ostatni stan, np. "85-92").
  const final = [...actions]
    .reverse()
    .map((a) => clean(a.querySelector('.pbpsc')?.textContent).match(/^(\d+)-(\d+)$/))
    .find(Boolean);
  if (final && (Number(final[1]) !== score[0] || Number(final[2]) !== score[1])) return undefined;
  return { periods, leadChanges, ties, timeLeading, benchPoints };
}
