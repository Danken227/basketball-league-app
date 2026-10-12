// Podsumowanie drużyny (Genius, sekcja "home"): tabele ostatnich i najbliższych meczów mają tylko datę, rywala
// z (H)/(A) i wynik — bez linków i hali. Te dane bierzemy z terminarza drużyny (sekcja "schedule", wczytywana
// w tle) i dopasowujemy po dniu meczu i rywalu: rywal prowadzi do strony drużyny, wynik do statystyk meczu,
// a najbliższe mecze dostają godzinę (przy dacie) i kolumnę z halą.
import { translateDate } from './geniusI18n';

export interface TeamScheduleMatch {
  // Dzień meczu "20.09.2026".
  day: string;
  // Godzina meczu "18:00".
  time?: string;
  opponent: string;
  opponentHref?: string;
  matchHref?: string;
  venue?: string;
}

// "Sep 20, 2026, 6:00 PM" albo (po tłumaczeniu) "20.09.2026, 18:00" → dzień "20.09.2026" i godzina "18:00".
const dayAndTime = (text: string) => {
  const trimmed = text.trim();
  const match = (/^\d{2}\.\d{2}\.\d{4}/.test(trimmed) ? trimmed : (translateDate(trimmed) ?? '')).match(/^(\d{2}\.\d{2}\.\d{4})(?:, (\d{2}:\d{2}))?/);
  return { day: match?.[1], time: match?.[2] };
};

const plain = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

export function readTeamSchedule(root: HTMLElement, teamId: string): TeamScheduleMatch[] {
  return [...root.querySelectorAll('.match-wrap')].flatMap((wrap) => {
    const { day, time } = dayAndTime(wrap.querySelector('.match-time span')?.textContent ?? '');
    const sides = [...wrap.querySelectorAll('.home-team, .away-team')];
    const other = sides.find((side) => !side.querySelector(`a[href^="/druzyny/${teamId}?"], a[href="/druzyny/${teamId}"]`));
    const opponentLink = other?.querySelector<HTMLAnchorElement>('.team-name a');
    if (!day || !opponentLink) return [];
    return [
      {
        day,
        time,
        opponent: opponentLink.textContent?.trim() ?? '',
        opponentHref: opponentLink.getAttribute('href') ?? undefined,
        matchHref: wrap.querySelector('.match-center-link a')?.getAttribute('href') ?? undefined,
        venue: wrap.querySelector('.match-venue a, .match-venue span')?.textContent?.trim() || undefined,
      },
    ];
  });
}

// Uzupełnia tabele meczów w podsumowaniu. Zmiany są oznaczone (data-linked), więc kolejne wywołania
// (obserwator treści Genius) niczego nie zmieniają.
export function linkTeamSummary(root: HTMLElement, schedule: TeamScheduleMatch[]) {
  if (schedule.length === 0) return;
  root.querySelectorAll<HTMLTableElement>('.page-team .summary .matches-block table').forEach((table) => {
    const upcoming = !table.querySelector('th.matchResult');
    if (upcoming && !table.querySelector('th.matchVenue')) {
      const header = document.createElement('th');
      header.className = 'matchVenue';
      header.textContent = 'Venue';
      table.querySelector('thead tr')?.append(header);
    }
    table.querySelectorAll('tbody tr').forEach((row) => {
      if (row.hasAttribute('data-linked')) return;
      const opponentCell = row.querySelector<HTMLElement>('td.matchOpponent');
      const dayCell = row.querySelector('td.matchTime');
      const day = dayCell?.textContent?.trim();
      if (!opponentCell || !day) return;
      // Nazwa rywala bez dopisku (H)/(A) (albo przetłumaczonego (dom)/(wyjazd)).
      const opponent = plain(opponentCell.textContent?.replace(/\s*\([^)]*\)\s*$/, '') ?? '');
      const sameDay = schedule.filter((match) => match.day === day);
      const match = sameDay.find((m) => plain(m.opponent) === opponent) ?? (sameDay.length === 1 ? sameDay[0] : undefined);
      if (!match) return;
      row.setAttribute('data-linked', '');

      if (match.opponentHref) {
        const link = document.createElement('a');
        link.href = match.opponentHref;
        link.className = 'match-link';
        link.append(...opponentCell.childNodes);
        opponentCell.append(link);
      }
      const resultCell = row.querySelector<HTMLElement>('td.matchResult');
      if (resultCell && match.matchHref) {
        const link = document.createElement('a');
        link.href = match.matchHref.replace(/sekcja=[^&]*/, 'sekcja=boxscore');
        link.className = 'match-link';
        link.title = 'Statystyki meczu';
        link.append(...resultCell.childNodes);
        resultCell.append(link);
      }
      if (upcoming) {
        if (match.time) dayCell!.textContent = `${day}, ${match.time}`;
        const venueCell = document.createElement('td');
        venueCell.className = 'matchVenue';
        venueCell.textContent = match.venue ?? '';
        row.append(venueCell);
      }
    });
  });
}
