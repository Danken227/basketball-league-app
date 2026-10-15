// Mecze bieżącej edycji, których protokołu nie zamknięto w Genius (zakładka „Niezamknięte mecze” w panelu
// administratora). Przy stoliku nie zawsze zamyka się protokół — taki mecz wisi w Genius jako trwający i nie
// trafia do tabeli. Pasek meczów pokazuje go już jako zakończony (GeniusMatchBar), więc bez tej listy nikt by
// tego nie zauważył. Zamknąć go może tylko osoba z dostępem do Genius (FIBA LiveStats).

import { currentGeniusEdition, editionCompetitionIds, geniusSnapshot, isGeniusDomain } from './geniusConfig';
import { fetchGeniusPage } from './geniusFetch';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Terminarz Genius podaje termin jako "Oct 4, 2026, 3:15 PM", a po tłumaczeniu (geniusI18n) jako "04.10.2026, 15:15".
export function parseScheduleDate(text: string): Date | undefined {
  const pl = text.match(/(\d{2})\.(\d{2})\.(\d{4}),? (\d{2}):(\d{2})/);
  if (pl) return new Date(Number(pl[3]), Number(pl[2]) - 1, Number(pl[1]), Number(pl[4]), Number(pl[5]));
  const m = text.match(/([A-Za-z]{3})\w* (\d+), (\d{4}),? (\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return undefined;
  let hours = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hours += 12;
  return new Date(Number(m[3]), months.indexOf(m[1].toLowerCase()), Number(m[2]), hours, Number(m[5]));
}

// Mecz trwa w Genius dłużej niż mecz może trwać (z przerwami i dogrywkami mieści się w 2 godzinach).
export const UNFINISHED_AFTER_MS = 2.5 * 60 * 60 * 1000;
// Mecz zaplanowany, który się nie zaczął w Genius dobę po terminie — protokołu nie wysłano albo mecz przełożono.
const NOT_STARTED_AFTER_MS = 24 * 60 * 60 * 1000;

export interface UnfinishedMatch {
  id: string;
  competitionId: number;
  // 'open' — wisi jako trwający (do zamknięcia); 'notStarted' — termin minął, a w Genius mecz się nie zaczął.
  kind: 'open' | 'notStarted';
  // Dlaczego uznaliśmy, że mecz powinien być zakończony.
  reason: string;
  date: Date;
  venue?: string;
  home: string;
  away: string;
  homeScore?: string;
  awayScore?: string;
}

interface ScheduledMatch extends Omit<UnfinishedMatch, 'kind' | 'reason' | 'date'> {
  date?: Date;
  status: 'scheduled' | 'complete' | 'live';
}

function readSchedule(root: HTMLElement, competitionId: number): ScheduledMatch[] {
  return [...root.querySelectorAll<HTMLElement>('.match-wrap[id^="extfix_"]')].map((wrap) => {
    const text = (selector: string) => wrap.querySelector(selector)?.textContent?.trim() || undefined;
    return {
      id: wrap.id.replace('extfix_', ''),
      competitionId,
      status: wrap.classList.contains('STATUS_COMPLETE') ? 'complete' : wrap.classList.contains('STATUS_SCHEDULED') ? 'scheduled' : 'live',
      date: parseScheduleDate(text('.match-time span') ?? ''),
      venue: text('.match-venue a, .match-venue span'),
      home: text('.home-team .team-name-full') ?? '?',
      away: text('.away-team .team-name-full') ?? '?',
      homeScore: text('.homescore'),
      awayScore: text('.awayscore'),
    };
  });
}

const hoursAgo = (ms: number) => {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return hours < 48 ? `${hours} godz.` : `${Math.floor(hours / 24)} dni`;
};

// Ocena meczów z terminarzy: trwający, który zaczął się ponad 2,5 godziny temu albo po którym w tej samej hali
// zaczął się już następny mecz, oraz zaplanowany, którego termin minął ponad dobę temu.
export function findUnfinished(matches: ScheduledMatch[], now = Date.now()): UnfinishedMatch[] {
  const found: UnfinishedMatch[] = [];
  for (const match of matches) {
    if (!match.date || match.status === 'complete') continue;
    const { status, date, ...rest } = match;
    const since = now - date.getTime();
    if (status === 'live') {
      const later = matches.find(
        (other) =>
          other !== match &&
          match.venue &&
          other.venue === match.venue &&
          other.status !== 'scheduled' &&
          other.date &&
          other.date > date &&
          other.date.getTime() <= now,
      );
      if (since > UNFINISHED_AFTER_MS) found.push({ ...rest, date, kind: 'open', reason: `trwa w Genius od ${hoursAgo(since)}` });
      else if (later) found.push({ ...rest, date, kind: 'open', reason: `w tej hali zaczął się już następny mecz (${later.home} – ${later.away})` });
    } else if (status === 'scheduled' && since > NOT_STARTED_AFTER_MS) {
      found.push({ ...rest, date, kind: 'notStarted', reason: `termin minął ${hoursAgo(since)} temu` });
    }
  }
  return found.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Sprawdzenie wszystkich rozgrywek bieżącej edycji. Terminarz, którego Genius nie oddał, zgłaszamy w `failed`
// (lista może być wtedy niepełna).
export async function checkUnfinishedMatches(): Promise<{ matches: UnfinishedMatch[]; failed: number }> {
  if (geniusSnapshot || !isGeniusDomain()) return { matches: [], failed: 0 };
  const ids = editionCompetitionIds(currentGeniusEdition.id);
  const schedules = await Promise.all(ids.map((cid) => fetchGeniusPage(`/competition/${cid}/schedule`).then((root) => root && readSchedule(root, cid))));
  return {
    // Hale mają różne rozgrywki (np. junior i senior po sobie), więc oceniamy wszystkie mecze edycji razem.
    matches: findUnfinished(schedules.flatMap((schedule) => schedule ?? [])),
    failed: schedules.filter((schedule) => !schedule).length,
  };
}
