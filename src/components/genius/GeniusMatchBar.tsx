import { useEffect, useMemo, useRef, useState } from 'react';
import { leagues, type LeagueId } from '../../data/league';
import { DragScroller, GroupLabel } from '../common/DragScroller';
import GeniusWidget from './GeniusWidget';
import { competitionIdByName, geniusSnapshot } from './geniusConfig';
import { fetchGeniusPage } from './geniusFetch';
import { placeholderLogo } from './geniusLogo';
import { loadSnapshot, widgetSnapshotKey } from './geniusSnapshot';
import { findStream, loadYoutubeVideos, type YoutubeVideo } from './youtubeStreams';

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
  // Kwarta i czas gry trwającego meczu, np. "2. kw. 08:15" (z karty widgetu).
  liveTime?: string;
  href: string;
  competition: string;
  league?: BarLeague;
  status: MatchStatus;
  // Termin z karty; bez rozpoznanej daty (hasDate = false) bieżąca chwila — tylko do kolejności kart.
  date: Date;
  hasDate: boolean;
  hasTime: boolean;
  teams: WidgetTeam[];
}

interface ScheduleInfo {
  date?: Date;
  venue?: string;
  live: boolean;
  // Pełne nazwy drużyn (karty widgetu mają tylko skróty) — do dopasowania transmisji na YouTube.
  home?: string;
  away?: string;
}

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Wszystkie ligi' },
  ...leagues.map((league) => ({ value: league.id as Filter, label: league.name })),
  { value: 'jun', label: 'Juniorzy' },
];

const leagueBadge: Record<BarLeague, string> = { eks: 'EKS', '1': '1L', '2': '2L', '3': '3L', jun: 'JUN' };

// Co ile ponownie czytamy karty widgetu (wyniki meczów na żywo).
const LIVE_REFRESH_MS = 20000;
// Widget Genius odpowiada z pamięci podręcznej przez minutę, więc wtedy odtwarzamy jego skrypt —
// tylko gdy karta przeglądarki jest widoczna, a na pasku coś trwa albo zaraz się zaczyna (REFRESH_AHEAD_MS).
const WIDGET_SOURCE_REFRESH_MS = 65 * 1000;
const REFRESH_AHEAD_MS = 15 * 60 * 1000;
// Po ponownym pobraniu widgetu wystarczy krótki odczyt jego iframe — nie wysyłamy przy tym dodatkowych zapytań.
const WIDGET_READ_MS = 500;

// Transmisja przypięta na stałe do "trwającego" meczu w wersji demonstracyjnej (Care Bears II - Łobuzersi).
const DEMO_STREAM_URL = 'https://www.youtube.com/watch?v=i_5gLSnPotY';

// Wersja demonstracyjna (migawka): kolejne stany "trwającego" meczu (wynik, kwarta i czas gry),
// zmieniane co LIVE_REFRESH_MS, w pętli.
const DEMO_LIVE_STEPS: { score: [number, number]; time: string }[] = [
  { score: [12, 9], time: '1. kw. 02:41' },
  { score: [17, 15], time: '2. kw. 08:12' },
  { score: [21, 22], time: '2. kw. 03:05' },
  { score: [26, 24], time: '3. kw. 07:36' },
  { score: [31, 30], time: '3. kw. 01:58' },
  { score: [35, 33], time: '4. kw. 06:20' },
];

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
// Kwarta i czas gry trwającego meczu (np. "Q2 08:15", "P2 8:15", "OT 02:00"). Widget podaje je w polu daty karty
// ("Per 4 00:00"), a status ma wtedy samo "Live" — sprawdzamy oba teksty. Kwarta powyżej 4. to dogrywka.
// Gdy nie da się ich rozpoznać, zostaje sam status "Na żywo".
function liveTimeOf(text: string): string | undefined {
  if (statusOf(text) !== 'live') return undefined;
  const clock = text.match(/\b(\d{1,2}:\d{2})\b/)?.[1];
  const overtime = /\bOT\d?\b|overtime/i.test(text);
  const period = text.match(/\b[QPK](\d)\b|\b(\d)(?:st|nd|rd|th)\b|\bper(?:iod)?\.?\s*(\d)/i);
  const periodNumber = period ? Number(period[1] ?? period[2] ?? period[3]) : undefined;
  const periodText = overtime || (periodNumber ?? 0) > 4 ? 'dogr.' : periodNumber ? `${periodNumber}. kw.` : undefined;
  if (/half|przerwa/i.test(text)) return 'przerwa';
  return [periodText, clock].filter(Boolean).join(' ') || undefined;
}

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
  return doc ? readWidgetCards(doc) : undefined;
}

// Karty meczów (li.spls_lsmatch) z dokumentu widgetu albo z zapisanego HTML kart (migawka danych).
function readWidgetCards(root: ParentNode): WidgetMatch[] | undefined {
  const cards = [...root.querySelectorAll('li.spls_lsmatch')];
  if (cards.length === 0) return undefined;

  // Karuzela Genius dokleja kopie kart do przewijania w kółko — zostawiamy po jednej na mecz.
  const byHref = new Map<string, WidgetMatch>();
  for (const card of cards) {
    const href = card.querySelector('a')?.getAttribute('href') ?? '';
    if (!href || byHref.has(href)) continue;
    const competition = card.querySelector('.spls_matchcomp')?.textContent?.trim() ?? '';
    const timeText = card.querySelector('.spls_timefield')?.textContent?.trim() || undefined;
    // Karta meczu w trakcie potrafi mieć w polu daty inny tekst niż "03/10/2026" — wtedy daty nie pokazujemy
    // (nieprawidłowa data wywracała formatowanie, a z nim całą stronę).
    const parsed = parseWidgetDate(card.querySelector('.spls_datefield')?.textContent?.trim() ?? '', timeText);
    const hasDate = !Number.isNaN(parsed.getTime());
    byHref.set(href, {
      id: href.match(/\/(\d+)\/?$/)?.[1] ?? href,
      href,
      competition,
      league: leagueOf(competition),
      status: statusOf(card.querySelector('.spls_matchstatus')?.textContent ?? ''),
      liveTime: liveTimeOf(`${card.querySelector('.spls_matchstatus')?.textContent ?? ''} ${hasDate ? '' : (card.querySelector('.spls_datefield')?.textContent ?? '')}`),
      date: hasDate ? parsed : new Date(),
      hasDate,
      hasTime: hasDate && Boolean(timeText),
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
      home: wrap.querySelector('.home-team .team-name-full')?.textContent?.trim() || undefined,
      away: wrap.querySelector('.away-team .team-name-full')?.textContent?.trim() || undefined,
    });
  });
  return info;
}

// Terminarze rozgrywek są duże (Genius wysyła je bez kompresji: 0,1–0,75 MB na rozgrywki, razem ok. 3 MB), a pasek
// potrzebuje z nich tylko godziny, hali i pełnych nazw drużyn, które prawie się nie zmieniają. Odczytane dane
// trzymamy więc w localStorage (kilka KB na rozgrywki) do 6 godzin i pobieramy terminarz ponownie dopiero, gdy
// zapis ma ponad 30 minut albo na pasku jest mecz, którego w nim nie ma. Wynik i status meczów dają karty widgetu.
const SCHEDULE_CACHE_PREFIX = 'genius-bar-schedule-v2:';
const SCHEDULE_CACHE_MS = 6 * 60 * 60 * 1000;
const SCHEDULE_REFRESH_MS = 30 * 60 * 1000;

function loadCachedSchedule(cid: number): { savedAt: number; info: Map<string, ScheduleInfo> } | undefined {
  try {
    const stored = JSON.parse(localStorage.getItem(SCHEDULE_CACHE_PREFIX + cid) ?? 'null') as {
      savedAt: number;
      entries: [string, Omit<ScheduleInfo, 'date'> & { date?: string }][];
    } | null;
    if (!stored || Date.now() - stored.savedAt > SCHEDULE_CACHE_MS) return undefined;
    return { savedAt: stored.savedAt, info: new Map(stored.entries.map(([id, info]) => [id, { ...info, date: info.date ? new Date(info.date) : undefined }])) };
  } catch {
    return undefined;
  }
}

function saveCachedSchedule(cid: number, info: Map<string, ScheduleInfo>) {
  try {
    localStorage.setItem(SCHEDULE_CACHE_PREFIX + cid, JSON.stringify({ savedAt: Date.now(), entries: [...info] }));
  } catch {
    // Brak miejsca albo zablokowany storage — terminarz zostaje tylko w stanie paska.
  }
}

// Terminarze w trakcie pobierania (kolejny odczyt kart w tym czasie nie wysyła drugiego zapytania).
const schedulesInFlight = new Set<number>();

// Mecz, który w Genius wisi jako trwający, choć dawno się skończył: przy stoliku nie zawsze zamyka się protokół
// (na dalk.pl taki mecz też zostaje "Live"). Uznajemy go za zakończony, gdy w tej samej hali zaczął się już
// późniejszy mecz (trwa albo jest zakończony) albo od jego początku minęły 3 godziny.
const STALE_LIVE_MS = 3 * 60 * 60 * 1000;

interface BarItem {
  match: WidgetMatch;
  info?: ScheduleInfo;
}

const startOf = ({ match, info }: BarItem) => (info?.date ?? match.date).getTime();
const reportedStatus = ({ match, info }: BarItem): MatchStatus => (info?.live && match.status !== 'final' ? 'live' : match.status);

function displayStatus(item: BarItem, all: BarItem[], now: number): MatchStatus {
  const status = reportedStatus(item);
  if (status !== 'live') return status;
  const start = startOf(item);
  if (now - start > STALE_LIVE_MS) return 'final';
  const venue = item.info?.venue;
  const laterStarted =
    Boolean(venue) &&
    all.some((other) => other !== item && other.info?.venue === venue && startOf(other) > start && startOf(other) <= now && reportedStatus(other) !== 'upcoming');
  return laterStarted ? 'final' : 'live';
}

const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

function MatchCard({ match, status, schedule, streamUrl }: { match: WidgetMatch; status: MatchStatus; schedule?: ScheduleInfo; streamUrl?: string }) {
  const date = schedule?.date ?? match.date;
  const hasDate = Boolean(schedule?.date) || match.hasDate;
  const hasTime = Boolean(schedule?.date) || match.hasTime;
  const scores = match.teams.map((t) => Number(t.score));
  const winner = status === 'final' ? Math.max(...scores) : undefined;
  const showScores = status !== 'upcoming';

  // Cały kafelek prowadzi do relacji meczu w FIBA LiveStats (nowa karta) — link rozciągnięty na kafelek pod treścią.
  // Mecz w trakcie z odnalezioną transmisją ma dodatkowo przycisk YouTube (osobny link nad nim).
  return (
    <div className="relative flex w-60 shrink-0 flex-col rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-orange-400/60">
      <a
        href={match.href}
        target="_blank"
        rel="noreferrer"
        draggable={false}
        aria-label={`${match.teams.map((t) => t.code).join(' – ')}, ${statusLabel[status].toLowerCase()}, relacja w FIBA LiveStats`}
        className="absolute inset-0 rounded-xl"
      />
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate rounded bg-orange-500/20 px-1.5 py-0.5 font-semibold text-orange-300" title={match.competition}>
            {/* Juniorzy: sama kategoria wiekowa ("U17") — z "JUN · " etykieta nie mieściła się obok statusu meczu w trakcie. */}
            {match.league === 'jun'
              ? (match.competition.match(/U\d+/)?.[0] ?? leagueBadge.jun)
              : match.league
                ? leagueBadge[match.league]
                : match.competition}
          </span>
          {status === 'live' && streamUrl && (
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              aria-label="Transmisja meczu na YouTube"
              title="Oglądaj transmisję na YouTube"
              className="relative z-10 grid h-5 w-7 shrink-0 place-items-center rounded bg-red-600 text-white transition hover:bg-red-500"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </a>
          )}
        </span>
        <span className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${statusClass[status]}`}>
          {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" aria-hidden="true" />}
          {statusLabel[status]}
          {status === 'live' && match.liveTime && <span className="font-normal opacity-90">· {match.liveTime}</span>}
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
          {hasDate && dayFormat.format(date)}
          {hasTime && ` · ${timeFormat.format(date)}`}
        </span>
        {schedule?.venue && (
          <span className="truncate text-right text-slate-500" title={schedule.venue}>
            {schedule.venue}
          </span>
        )}
      </div>
    </div>
  );
}

// Oznaczenie źródła jak w widgecie Genius: logo FIBA LiveStats i "powered by Genius Sports".
// Obrazki pochodzą z widgetu Genius (te same adresy, których używa ich pasek). Mają tylko 65 px, więc stoją jeden
// pod drugim w prawie naturalnej wielkości — obok siebie w kafelku musiałyby być małe i nieczytelne.
const fibaLogo = 'https://widget.wh.geniussports.com/resources/images/fibaH.png';
const geniusLogo = 'https://widget.wh.geniussports.com/resources/images/gs_widget.png';

function SourceLogos() {
  return (
    <a
      href="https://www.geniussports.com"
      target="_blank"
      rel="noreferrer"
      aria-label="FIBA LiveStats, powered by Genius Sports"
      className="my-1 hidden w-36 shrink-0 flex-col items-center justify-center gap-1.5 self-stretch rounded-xl bg-white px-3 md:flex"
    >
      <img src={fibaLogo} alt="FIBA LiveStats" className="h-[58px] w-auto object-contain" />
      <span className="h-px w-16 bg-slate-200" aria-hidden="true" />
      <img src={geniusLogo} alt="powered by Genius Sports" className="h-[58px] w-auto object-contain" />
    </a>
  );
}

function GeniusMatchBar({ widgetId }: { widgetId: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [matches, setMatches] = useState<WidgetMatch[]>();
  const [failed, setFailed] = useState(false);
  // Widget Genius jest statyczną migawką, więc w trakcie wizyty odtwarzamy go po wygaśnięciu cache'u serwera.
  const [widgetRefresh, setWidgetRefresh] = useState(0);
  // Ostatnio odczytane karty (JSON) — zmieniamy stan tylko przy zmianie; undefined, dopóki nic nie odczytano.
  const lastCards = useRef<string>(undefined);
  // Czy warto odświeżać widget: aktualizowane przy każdym renderze (patrz niżej), czytane przez licznik.
  const needsRefresh = useRef<() => boolean>(() => false);
  const [schedule, setSchedule] = useState<Map<string, ScheduleInfo>>(new Map());

  // Widget wypełnia się asynchronicznie, więc czytamy go co pół sekundy. Po każdym odświeżeniu źródła
  // nowe wyniki i czas gry trafiają do paska od razu po wstawieniu iframe.
  // W migawce danych karty są zapisanym HTML widgetu.
  useEffect(() => {
    if (geniusSnapshot) {
      let active = true;
      let demoTimer: number | undefined;
      loadSnapshot(widgetSnapshotKey(widgetId)).then((html) => {
        if (!active) return;
        const root = document.createElement('div');
        root.innerHTML = html ?? '';
        const cards = readWidgetCards(root) ?? [];
        setMatches(cards);
        // Pokaz wyników na żywo w wersji demonstracyjnej: najbliższy mecz "trwa", a wynik zmienia się co 20 s
        // (tak jak przy odczycie widgetu na żywo) i po ok. 2 minutach zaczyna od nowa.
        const nearest = cards.filter((m) => m.status !== 'final').sort((a, b) => a.date.getTime() - b.date.getTime())[0];
        if (!nearest) return;
        let step = 0;
        const showStep = () => {
          const { score, time } = DEMO_LIVE_STEPS[step % DEMO_LIVE_STEPS.length];
          const [home, away] = score;
          step++;
          setMatches((prev) =>
            prev?.map((m) =>
              m.href === nearest.href ? { ...m, status: 'live', liveTime: time, teams: m.teams.map((t, i) => ({ ...t, score: String(i === 0 ? home : away) })) } : m,
            ),
          );
        };
        showStep();
        demoTimer = window.setInterval(showStep, LIVE_REFRESH_MS);
      });
      return () => {
        active = false;
        window.clearInterval(demoTimer);
      };
    }
    const started = Date.now();
    // Odczyt tylko do znalezienia kart — kolejne odświeżenie źródła (widgetRefresh) uruchamia go od nowa.
    const read = () => {
      const found = readWidget(document.getElementById(`spw_${widgetId}`));
      if (found) {
        window.clearInterval(timer);
        const text = JSON.stringify(found);
        if (text !== lastCards.current) {
          lastCards.current = text;
          setMatches(found);
        }
        setFailed(false);
      } else if (Date.now() - started > 15000 && lastCards.current === undefined) {
        // Wolna odpowiedź przy odświeżeniu nie psuje paska — zostają karty z poprzedniego odczytu.
        // Na widget Genius przechodzimy tylko wtedy, gdy kart nie udało się odczytać ani razu.
        window.clearInterval(timer);
        setFailed(true);
      }
    };
    const timer = window.setInterval(read, WIDGET_READ_MS);
    read();
    return () => {
      window.clearInterval(timer);
    };
  }, [widgetId, widgetRefresh]);

  useEffect(() => {
    if (geniusSnapshot) return;
    const refresh = () => {
      if (document.visibilityState === 'visible' && needsRefresh.current()) setWidgetRefresh((previous) => previous + 1);
    };
    const timer = window.setInterval(refresh, WIDGET_SOURCE_REFRESH_MS);
    // Powrót do karty po dłuższej przerwie: od razu świeże wyniki zamiast czekania na kolejny takt.
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > WIDGET_SOURCE_REFRESH_MS) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Terminarze rozgrywek z paska: godzina i hala (karta trwającego meczu ma w miejscu daty czas gry), pełne nazwy
  // drużyn (dopasowanie transmisji) i to, czy mecz trwa. Pobierane wprost z Genius, wszystkie naraz, zaraz po
  // kartach; zapamiętane (patrz SCHEDULE_CACHE_MS) pokazujemy od razu.
  const competitionsKey = [...new Set((matches ?? []).map((m) => competitionIdByName(m.competition)).filter((cid) => cid !== undefined))]
    .sort()
    .join(',');
  const cachedSchedule = useMemo(() => {
    const fromCache = new Map<string, ScheduleInfo>();
    competitionsKey
      .split(',')
      .filter(Boolean)
      .forEach((cid) => loadCachedSchedule(Number(cid))?.info.forEach((info, id) => fromCache.set(id, info)));
    return fromCache;
  }, [competitionsKey]);

  // Po każdym odczycie kart (także przy odświeżaniu wyników) sprawdzamy, czy któryś terminarz trzeba pobrać:
  // brak zapisu, zapis starszy niż 30 minut albo mecz z paska, którego w zapisie nie ma (np. nowa kolejka).
  // Wynik trafia do stanu paska także wtedy, gdy w międzyczasie przyszły nowe karty (efekt uruchomił się ponownie).
  useEffect(() => {
    const byCompetition = new Map<number, string[]>();
    for (const match of matches ?? []) {
      const cid = competitionIdByName(match.competition);
      if (cid !== undefined) byCompetition.set(cid, [...(byCompetition.get(cid) ?? []), match.id]);
    }
    for (const [cid, ids] of byCompetition) {
      const cached = loadCachedSchedule(cid);
      const fresh = cached && Date.now() - cached.savedAt < SCHEDULE_REFRESH_MS && ids.every((id) => cached.info.has(id));
      if (fresh || schedulesInFlight.has(cid)) continue;
      schedulesInFlight.add(cid);
      fetchGeniusPage(`/competition/${cid}/schedule`)
        .then((root) => {
          const found = root && readSchedule(root);
          if (!found || found.size === 0) return;
          saveCachedSchedule(cid, found);
          setSchedule((prev) => {
            const changed = [...found].some(([id, info]) => JSON.stringify(prev.get(id)) !== JSON.stringify(info));
            return changed ? new Map([...prev, ...found]) : prev;
          });
        })
        .catch(() => undefined)
        .finally(() => schedulesInFlight.delete(cid));
    }
  }, [matches]);

  // Bieżąca chwila do oceny "wiszących" meczów — co minutę (wystarczy przy progach liczonych w godzinach).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const items: BarItem[] = (matches ?? []).map((match) => ({ match, info: schedule.get(match.id) ?? cachedSchedule.get(match.id) }));
  // W migawce (demo) "trwający" mecz jest symulowany na meczu sprzed kilku dni — bez reguły wiszących meczów.
  const statusOf = new Map(items.map((item) => [item.match.href, geniusSnapshot ? reportedStatus(item) : displayStatus(item, items, now)]));

  // Transmisje na YouTube — tylko dla meczów w trakcie: listę filmów kanału pobieramy, gdy jakiś mecz trwa,
  // i odświeżamy co 2 minuty. W migawce (demo) "trwający" mecz ma przypiętą transmisję.
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const anyLive = [...statusOf.values()].includes('live');
  useEffect(() => {
    if (!anyLive || geniusSnapshot) return;
    const refresh = () => loadYoutubeVideos().then(setVideos);
    refresh();
    const timer = window.setInterval(refresh, 2 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [anyLive]);
  const streamFor = (match: WidgetMatch, info?: ScheduleInfo) => {
    if (geniusSnapshot) return DEMO_STREAM_URL;
    if (!info?.home || !info.away) return undefined;
    return findStream(videos, info.home, info.away, info.date ?? match.date);
  };

  // Odświeżamy, gdy jakiś mecz trwa albo powinien się zaczynać (od kwadransa przed do 3 godzin po terminie —
  // nie każdy mecz od razu zmienia status w Genius).
  useEffect(() => {
    needsRefresh.current = () =>
      items.some((item) => {
        const status = displayStatus(item, items, Date.now());
        if (status !== 'upcoming') return status === 'live';
        const start = startOf(item);
        return start - Date.now() < REFRESH_AHEAD_MS && Date.now() - start < STALE_LIVE_MS;
      });
  });

  const sorted = [...items].sort((a, b) => startOf(a) - startOf(b));
  const visible = sorted.filter(({ match }) => filter === 'all' || match.league === filter);
  const results = visible.filter(({ match }) => statusOf.get(match.href) === 'final');
  const upcoming = visible.filter(({ match }) => statusOf.get(match.href) !== 'final');

  return (
    <section aria-label="Wyniki i najbliższe mecze" className="keep-dark relative overflow-hidden bg-slate-900 text-white">
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
          <GeniusWidget widgetId={widgetId} refreshKey={widgetRefresh} />
        ) : !matches ? (
          <p className="py-8 text-sm text-slate-400">Wczytywanie meczów…</p>
        ) : (
          <div className="flex items-stretch gap-3">
            <SourceLogos />
            <DragScroller resetKey={filter}>
              {results.length > 0 && <GroupLabel>Wyniki</GroupLabel>}
              {results.map(({ match, info }) => (
                <MatchCard key={match.href} match={match} status={statusOf.get(match.href)!} schedule={info} streamUrl={streamFor(match, info)} />
              ))}
              {results.length > 0 && upcoming.length > 0 && <div data-divider className="w-px shrink-0 bg-white/15" />}
              {upcoming.length > 0 && <GroupLabel>Najbliższe</GroupLabel>}
              {upcoming.map(({ match, info }) => (
                <MatchCard key={match.href} match={match} status={statusOf.get(match.href)!} schedule={info} streamUrl={streamFor(match, info)} />
              ))}
              {visible.length === 0 && <p className="py-6 text-sm text-slate-400">Brak meczów w tej lidze.</p>}
            </DragScroller>
          </div>
        )}
      </div>

      {/* Źródła danych poza ekranem (zostają w DOM, żeby skrypty Genius działały): widget i terminarze. */}
      {!failed && (
        <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-0 w-[1200px]">
          {!geniusSnapshot && <GeniusWidget widgetId={widgetId} refreshKey={widgetRefresh} />}
        </div>
      )}
    </section>
  );
}

export default GeniusMatchBar;
