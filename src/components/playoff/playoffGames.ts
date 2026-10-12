// Mecze fazy play-off z terminarza Genius (?phaseName=…): numer meczu, termin, numery drużyn i wynik. Faza, której
// jeszcze nie ma (play-off się nie zaczął), daje pusty terminarz.
import { useEffect, useState } from 'react';
import type { PlayoffGame } from '../../data/playoff';
import { fetchGeniusPage } from '../genius/geniusFetch';
import { translateDate } from '../genius/geniusI18n';

// Link do drużyny: Genius ("…/team/123") albo w migawce już nasz ("/druzyny/123").
const teamIdOf = (side: Element | null) => side?.querySelector('a[href]')?.getAttribute('href')?.match(/(?:\/team\/|\/druzyny\/)(\d+)/)?.[1] ?? '';

const scoreOf = (side: Element | null) => {
  const text = side?.querySelector('.team-score')?.textContent?.trim() ?? '';
  return /^\d+$/.test(text) ? Number(text) : undefined;
};

// "Jan 10, 2026, 9:00 AM" (albo już "10.01.2026, 09:00") → "2026-01-10T09:00" (porządek tekstowy = chronologiczny).
function sortableDate(text: string) {
  const polish = (/^\d{2}\.\d{2}\.\d{4}/.test(text) ? text : (translateDate(text) ?? '')).match(/^(\d{2})\.(\d{2})\.(\d{4})(?:, (\d{2}:\d{2}))?/);
  return polish ? `${polish[3]}-${polish[2]}-${polish[1]}T${polish[4] ?? '00:00'}` : undefined;
}

export function readPlayoffGames(root: HTMLElement | undefined): PlayoffGame[] {
  return [...(root?.querySelectorAll<HTMLElement>('.match-wrap[id^="extfix_"]') ?? [])].map((wrap) => {
    const home = wrap.querySelector('.home-team');
    const away = wrap.querySelector('.away-team');
    return {
      id: wrap.id.replace('extfix_', ''),
      date: sortableDate(wrap.querySelector('.match-time span')?.textContent?.trim() ?? ''),
      homeId: teamIdOf(home),
      awayId: teamIdOf(away),
      homeScore: scoreOf(home),
      awayScore: scoreOf(away),
      complete: wrap.classList.contains('STATUS_COMPLETE'),
    };
  });
}

export const playoffSchedulePage = (cid: number, phase: string) => `/competition/${cid}/schedule?phaseName=${phase.trim().replace(/ /g, '+')}&`;

// Mecze fazy play-off rozgrywek (undefined — wczytywanie).
export function usePlayoffGames(cid: number, phase: string) {
  const [state, setState] = useState<{ key: string; games: PlayoffGame[] }>();
  const key = `${cid}:${phase}`;
  useEffect(() => {
    let active = true;
    fetchGeniusPage(playoffSchedulePage(cid, phase))
      .then((root) => readPlayoffGames(root))
      .catch(() => [])
      .then((games) => active && setState({ key, games }));
    return () => {
      active = false;
    };
  }, [cid, phase, key]);
  return state?.key === key ? state.games : undefined;
}
