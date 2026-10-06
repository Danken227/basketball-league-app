import { useEffect, useMemo, useState } from 'react';
import { leagues, type LeagueId } from '../../data/league';
import { DragScroller, GroupLabel } from '../common/DragScroller';
import GeniusEmbed from './GeniusEmbed';
import GeniusWidget from './GeniusWidget';
import { geniusCacheKey, readGeniusCache } from './geniusCache';
import { competitionIdByName } from './geniusConfig';
import { placeholderLogo } from './geniusLogo';

// Pasek meczów w naszym wyglądzie, z danymi z widgetu Genius (ten sam widget co na dalk.pl).
// Widget działa ukryty w tle; jego karty (li.spls_lsmatch w ramce z tej samej domeny) przepisujemy
// na nasze karty z filtrem ligi i przewijaniem. Gdy danych nie da się odczytać, pokazujemy oryginalny widget.
// Karty widgetu nie mają godziny rozegranych meczów ani hali — te bierzemy z terminarza Genius
// (osadzonego w tle) po numerze meczu, który jest taki sam w obu miejscach.

type BarLeague = LeagueId | 'jun';
type Filter = BarLeague | 'all';
type MatchStatus = 'upcoming' | 'live' | 'final';

interface WidgetTeam {
  id: string;
  code: string;
  logo?: string;
  score?: string;
}

interface WidgetMatch {
  id: string;
  href: string;
  competition: string;
  league?: BarLeague;
  status: MatchStatus;
  date: Date;
  hasTime: boolean;
  teams: WidgetTeam[];
}

interface ScheduleInfo {
  date?: Date;
  venue?: string;
  live: boolean;
}

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Wszystkie ligi' },
  ...leagues.map((league) => ({ value: league.id as Filter, label: league.name })),
  { value: 'jun', label: 'Juniorzy' },
];

const leagueBadge: Record<BarLeague, string> = { eks: 'EKS', '1': '1L', '2': '2L', '3': '3L', jun: 'JUN' };

const statusLabel: Record<MatchStatus, string> = { upcoming: 'Nadchodzący', live: 'Na żywo', final: 'Zakończony' };
const statusClass: Record<MatchStatus, string> = {
  upcoming: 'bg-sky-500/15 text-sky-300',
  live: 'bg-red-500/20 text-red-300',
  final: 'bg-white/10 text-slate-300',
};

function leagueOf(competition: string): BarLeague | undefined {
  if (/^Ekstraliga/i.test(competition)) return 'eks';
  const level = competition.match(/^([123])\. Liga/i);
  if (level) return level[1] as LeagueId;
  if (/Junior/i.test(competition)) return 'jun';
  return undefined;
}

// Status karty widgetu: "Final", "Upcoming", a w trakcie meczu inne oznaczenia (np. kwarta).
function statusOf(text: string): MatchStatus {
  if (/final/i.test(text)) return 'final';
  if (/upcoming|scheduled/i.test(text) || !text.trim()) return 'upcoming';
  return 'live';
}

// Karta widgetu ma datę "03/10/2026" i opcjonalnie godzinę "9:45 am".
function parseWidgetDate(dateText: string, timeText?: string): Date {
  const [day, month, year] = dateText.split('/').map(Number);
  const time = timeText?.match(/(\d+):(\d+)\s*(am|pm)/i);
  let hours = time ? Number(time[1]) % 12 : 0;
  if (time?.[3].toLowerCase() === 'pm') hours += 12;
  return new Date(year, month - 1, day, hours, time ? Number(time[2]) : 0);
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Terminarz Genius podaje termin jako "Oct 4, 2026, 3:15 PM", a po tłumaczeniu (geniusI18n) jako "04.10.2026, 15:15".
function parseScheduleDate(text: string): Date | undefined {
  const pl = text.match(/(\d{2})\.(\d{2})\.(\d{4}),? (\d{2}):(\d{2})/);
  if (pl) return new Date(Number(pl[3]), Number(pl[2]) - 1, Number(pl[1]), Number(pl[4]), Number(pl[5]));
  const m = text.match(/([A-Za-z]{3})\w* (\d+), (\d{4}),? (\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return undefined;
  let hours = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hours += 12;
  return new Date(Number(m[3]), months.indexOf(m[1].toLowerCase()), Number(m[2]), hours, Number(m[5]));
}

function readWidget(container: Element | null): WidgetMatch[] | undefined {
  const doc = container?.querySelector('iframe')?.contentDocument;
  const cards = doc ? [...doc.querySelectorAll('li.spls_lsmatch')] : [];
  if (cards.length === 0) return undefined;

  // Karuzela Genius dokleja kopie kart do przewijania w kółko — zostawiamy po jednej na mecz.
  const byHref = new Map<string, WidgetMatch>();
  for (const card of cards) {
    const href = card.querySelector('a')?.getAttribute('href') ?? '';
    if (!href || byHref.has(href)) continue;
    const competition = card.querySelector('.spls_matchcomp')?.textContent?.trim() ?? '';
    const timeText = card.querySelector('.spls_timefield')?.textContent?.trim() || undefined;
    byHref.set(href, {
      id: href.match(/\/(\d+)\/?$/)?.[1] ?? href,
      href,
      competition,
      league: leagueOf(competition),
      status: statusOf(card.querySelector('.spls_matchstatus')?.textContent ?? ''),
      date: parseWidgetDate(card.querySelector('.spls_datefield')?.textContent?.trim() ?? '', timeText),
      hasTime: Boolean(timeText),
      teams: [...card.querySelectorAll('.spteam')].map((team) => ({
        id: [...team.classList].find((c) => c.startsWith('tid'))?.slice(3) ?? '',
        code: team.querySelector('.teamname')?.textContent?.trim() ?? '',
        logo: team.querySelector('img')?.getAttribute('src') ?? undefined,
        score: team.querySelector('.score')?.textContent?.trim() || undefined,
      })),
    });
  }
  return [...byHref.values()];
}

// Odczyt terminarza Genius: numer meczu (id "extfix_<numer>"), termin, hala i to, czy mecz trwa.
function readSchedule(root: HTMLElement): Map<string, ScheduleInfo> {
  const info = new Map<string, ScheduleInfo>();
  root.querySelectorAll<HTMLElement>('.match-wrap[id^="extfix_"]').forEach((wrap) => {
    info.set(wrap.id.replace('extfix_', ''), {
      date: parseScheduleDate(wrap.querySelector('.match-time span')?.textContent ?? ''),
      venue: wrap.querySelector('.match-venue a, .match-venue span')?.textContent?.trim() || undefined,
      live: !wrap.classList.contains('STATUS_SCHEDULED') && !wrap.classList.contains('STATUS_COMPLETE'),
    });
  });
  return info;
}

// Ustawienia osadzenia terminarza (te same przy osadzaniu i przy szukaniu w pamięci — wspólny klucz).
const scheduleOptions = (cid: number) => ({ page: `/competition/${cid}/schedule`, showSubMenus: false, showMatchFilter: false });

const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

function MatchCard({ match, schedule }: { match: WidgetMatch; schedule?: ScheduleInfo }) {
  const status: MatchStatus = schedule?.live && match.status !== 'final' ? 'live' : match.status;
  const date = schedule?.date ?? match.date;
  const hasTime = Boolean(schedule?.date) || match.hasTime;
  const scores = match.teams.map((t) => Number(t.score));
  const winner = status === 'final' ? Math.max(...scores) : undefined;
  const showScores = status !== 'upcoming';

  // Cały kafelek prowadzi do relacji meczu w FIBA LiveStats (nowa karta); drużyny nie są osobnymi linkami.
  return (
    <a
      href={match.href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      aria-label={`${match.teams.map((t) => t.code).join(' – ')}, ${statusLabel[status].toLowerCase()}, relacja w FIBA LiveStats`}
      className="flex w-60 shrink-0 flex-col rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-orange-400/60"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate rounded bg-orange-500/20 px-1.5 py-0.5 font-semibold text-orange-300" title={match.competition}>
          {match.league ? leagueBadge[match.league] : match.competition}
          {match.league === 'jun' && ` · ${match.competition.match(/U\d+/)?.[0] ?? ''}`}
        </span>
        <span className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${statusClass[status]}`}>
          {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" aria-hidden="true" />}
          {statusLabel[status]}
        </span>
      </div>
      <ul className="space-y-1.5">
        {match.teams.map((team) => {
          const won = status === 'final' && Number(team.score) === winner;
          return (
            <li key={team.id || team.code} className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-white">
                {/* Brak logo w Genius (albo nie wczytało się) — zastępcze z inicjałami drużyny (geniusLogo). */}
                <img
                  src={team.logo || placeholderLogo(team.code)}
                  alt=""
                  onError={(e) => (e.currentTarget.src = placeholderLogo(team.code))}
                  className="h-5 w-5 object-contain"
                  draggable={false}
                />
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${won ? 'font-bold text-white' : 'text-slate-300'}`}>{team.code}</span>
              {showScores && <span className={`text-sm tabular-nums ${won ? 'font-bold text-white' : 'text-slate-400'}`}>{team.score}</span>}
            </li>
          );
        })}
      </ul>
      {/* Termin i hala na dole kafelka, jak w widgecie Genius — także po zakończeniu meczu. */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px] text-slate-400">
        <span className="shrink-0">
          {dayFormat.format(date)}
          {hasTime && ` · ${timeFormat.format(date)}`}
        </span>
        {schedule?.venue && (
          <span className="truncate text-right text-slate-500" title={schedule.venue}>
            {schedule.venue}
          </span>
        )}
      </div>
    </a>
  );
}

// Oznaczenie źródła jak w widgecie Genius: logo FIBA LiveStats i "powered by Genius Sports".
// Obrazki pochodzą z widgetu Genius (te same adresy, których używa ich pasek).
const fibaLogo = 'https://widget.wh.geniussports.com/resources/images/fibaH.png';
const geniusLogo = 'https://widget.wh.geniussports.com/resources/images/gs_widget.png';

function SourceLogos() {
  return (
    <a
      href="https://www.geniussports.com"
      target="_blank"
      rel="noreferrer"
      aria-label="FIBA LiveStats, powered by Genius Sports"
      className="my-1 hidden w-36 shrink-0 items-center justify-center gap-2.5 self-stretch rounded-xl bg-white px-3 md:flex"
    >
      <img src={fibaLogo} alt="FIBA LiveStats" className="h-10 w-auto object-contain" />
      <span className="h-10 w-px bg-slate-200" aria-hidden="true" />
      <img src={geniusLogo} alt="powered by Genius Sports" className="h-10 w-auto object-contain" />
    </a>
  );
}

function GeniusMatchBar({ widgetId }: { widgetId: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [matches, setMatches] = useState<WidgetMatch[]>();
  const [failed, setFailed] = useState(false);
  const [schedule, setSchedule] = useState<Map<string, ScheduleInfo>>(new Map());
  // Terminarze (godziny i hale) wczytujemy chwilę po kartach, żeby nie spowalniały tabeli i Top 10 obok.
  const [loadSchedules, setLoadSchedules] = useState(false);
  useEffect(() => {
    if (!matches) return;
    const timer = window.setTimeout(() => setLoadSchedules(true), 1500);
    return () => window.clearTimeout(timer);
  }, [matches]);

  // Widget wypełnia się asynchronicznie, więc odpytujemy go co pół sekundy (maks. 15 s).
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const found = readWidget(document.getElementById(`spw_${widgetId}`));
      if (found) {
        setMatches(found);
        window.clearInterval(timer);
      } else if (Date.now() - started > 15000) {
        setFailed(true);
        window.clearInterval(timer);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [widgetId]);

  // Terminarze tylko tych rozgrywek, które są na pasku. Te zapamiętane wcześniej w tej wizycie czytamy z pamięci
  // (bez zapytania do Genius), a osadzamy tylko brakujące. Liczone raz po wczytaniu kart, nie przy każdym kliknięciu.
  const { cachedSchedule, scheduleToLoad } = useMemo(() => {
    const competitions = [...new Set((matches ?? []).map((m) => competitionIdByName(m.competition)).filter((cid) => cid !== undefined))];
    const fromCache = new Map<string, ScheduleInfo>();
    const toLoad = competitions.filter((cid) => {
      const html = readGeniusCache(geniusCacheKey(scheduleOptions(cid)));
      if (!html) return true;
      const root = document.createElement('div');
      root.innerHTML = html;
      readSchedule(root).forEach((info, id) => fromCache.set(id, info));
      return false;
    });
    return { cachedSchedule: fromCache, scheduleToLoad: toLoad };
  }, [matches]);

  const mergeSchedule = (root: HTMLElement) => {
    const found = readSchedule(root);
    if (found.size === 0) return;
    setSchedule((prev) => {
      const changed = [...found].some(([id, info]) => JSON.stringify(prev.get(id)) !== JSON.stringify(info));
      return changed ? new Map([...prev, ...found]) : prev;
    });
  };

  const sorted = (matches ?? [])
    .map((match) => ({ match, info: schedule.get(match.id) ?? cachedSchedule.get(match.id) }))
    .sort((a, b) => (a.info?.date ?? a.match.date).getTime() - (b.info?.date ?? b.match.date).getTime());
  const visible = sorted.filter(({ match }) => filter === 'all' || match.league === filter);
  const results = visible.filter(({ match }) => match.status === 'final');
  const upcoming = visible.filter(({ match }) => match.status !== 'final');

  return (
    <section aria-label="Wyniki i najbliższe mecze" className="relative overflow-hidden bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-baseline gap-3 text-sm font-semibold text-slate-200">
            Mecze
            <span className="text-[10px] font-normal uppercase tracking-wider text-slate-500">Dane: FIBA LiveStats · Genius Sports</span>
          </h2>
          {!failed && (
            <select
              aria-label="Liga"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="rounded-lg border border-white/20 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {failed ? (
          <GeniusWidget widgetId={widgetId} />
        ) : !matches ? (
          <p className="py-8 text-sm text-slate-400">Wczytywanie meczów…</p>
        ) : (
          <div className="flex items-stretch gap-3">
            <SourceLogos />
            <DragScroller resetKey={filter}>
              {results.length > 0 && <GroupLabel>Wyniki</GroupLabel>}
              {results.map(({ match, info }) => (
                <MatchCard key={match.href} match={match} schedule={info} />
              ))}
              {results.length > 0 && upcoming.length > 0 && <div data-divider className="w-px shrink-0 bg-white/15" />}
              {upcoming.length > 0 && <GroupLabel>Najbliższe</GroupLabel>}
              {upcoming.map(({ match, info }) => (
                <MatchCard key={match.href} match={match} schedule={info} />
              ))}
              {visible.length === 0 && <p className="py-6 text-sm text-slate-400">Brak meczów w tej lidze.</p>}
            </DragScroller>
          </div>
        )}
      </div>

      {/* Źródła danych poza ekranem (zostają w DOM, żeby skrypty Genius działały): widget i terminarze. */}
      {!failed && (
        <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-0 w-[1200px]">
          <GeniusWidget widgetId={widgetId} />
          {loadSchedules && scheduleToLoad.map((cid) => <GeniusEmbed key={cid} {...scheduleOptions(cid)} onContent={mergeSchedule} />)}
        </div>
      )}
    </section>
  );
}

export default GeniusMatchBar;
