import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import MatchSummary from '../../components/genius/MatchSummary';
import { findCompetition, geniusSnapshot, isGeniusDomain } from '../../components/genius/geniusConfig';
import { geniusCacheKey } from '../../components/genius/geniusCache';
import { fetchGeniusJson, fetchGeniusPage, prefetchGeniusJson } from '../../components/genius/geniusFetch';
import { inSnapshot } from '../../components/genius/geniusSnapshot';
import { parseScheduleDate } from '../../components/genius/geniusUnfinished';
import { readPlayByPlay, readSummary, type PlayByPlayStats, type SummaryData } from '../../components/genius/matchSummaryData';
import { findStreamVideo, loadYoutubeVideos, youtubeWatchUrl } from '../../components/genius/youtubeStreams';
import { adminRequest } from '../../data/siteContent';

// Strona meczu z Genius pod naszym adresem (/mecze/2900159?rozgrywki=49970&sekcja=summary).
// Sekcje (Summary, Box Score, Play by play, Shot chart, Team Analysis) to podmenu Genius — jego linki
// przekładają się na parametr "sekcja". Shot chart i play by play potrzebują arkusza Genius (boisko,
// znaczniki rzutów, kolory drużyn), więc ta strona korzysta z ich wyglądu z naszymi poprawkami (genius.css).

// Poprawki treści Genius: po zakończonym meczu przygaszamy wynik przegranego (klasa is-loser, styl w genius.css),
// a czas akcji w play by play skracamy z "09:59:00" (setne części sekundy zawsze zerowe) do "09:59".
// W migawce chowamy zakładki, których w niej nie ma (z poprzedniej edycji są tylko Summary i Box Score).
function polishMatch(root: HTMLElement) {
  if (geniusSnapshot) {
    root.querySelectorAll<HTMLAnchorElement>('a.menuoption[href*="sekcja="]').forEach((link) => {
      const url = new URL(link.href, window.location.origin);
      const id = url.pathname.match(/^\/mecze\/(\d+)/)?.[1];
      const section = url.searchParams.get('sekcja');
      if (id && section && !inSnapshot(geniusCacheKey({ page: matchPage(id, url.searchParams.get('rozgrywki'), section) }))) link.style.display = 'none';
    });
  }
  const boxes = [...root.querySelectorAll<HTMLElement>('.match-header .team-box')];
  const scores = boxes.map((box) => Number(box.querySelector('.score')?.textContent?.trim()));
  const finished = Boolean(root.querySelector('.match-header .status.notlive'));
  boxes.forEach((box, i) => box.classList.toggle('is-loser', finished && boxes.length === 2 && scores[i] < scores[1 - i]));
  root.querySelectorAll('#playbyplay .pbp-time').forEach((time) => {
    time.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) node.textContent = node.textContent.replace(/(\d{2}:\d{2}):00\b/, '$1');
    });
  });
}

// Wyniki kwart w nagłówku meczu (pod wynikiem), np. "29:19 · 20:24 · 14:23 · 22:26".
function showPeriodScores(root: HTMLElement | null, pbp: PlayByPlayStats | undefined) {
  const status = root?.querySelector('.match-header .vs-label');
  if (!status) return;
  const text = pbp?.periods.map(([home, away]) => `${home}:${away}`).join(' · ') ?? '';
  let line = status.querySelector<HTMLElement>('.period-scores');
  if (!text) {
    line?.remove();
    return;
  }
  if (!line) {
    line = document.createElement('div');
    line.className = 'period-scores';
    status.append(line);
  }
  if (line.textContent !== text) line.textContent = text;
}

// Nagrania meczów zapisane w panelu (numer meczu → film na YouTube); raz na wizytę.
let matchVideos: Promise<Record<string, string>> | undefined;
const loadMatchVideos = () =>
  (matchVideos ??= adminRequest<{ videos: Record<string, string> }>('match-videos')
    .then((data) => data.videos ?? {})
    .catch((): Record<string, string> => ({})));

// Zakładki meczu (podmenu Genius).
const MATCH_SECTIONS = ['summary', 'boxscore', 'playbyplay', 'shotchart', 'analysis'];

const matchPage = (id: string | undefined, cid: string | null, section: string) =>
  cid ? `/competition/${cid}/match/${id}/${section}` : `/match/${id}/${section}`;

function GeniusMatchPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const cid = params.get('rozgrywki');
  const section = params.get('sekcja') ?? 'summary';
  const page = matchPage(id, cid, section);
  const found = cid ? findCompetition(Number(cid)) : undefined;
  const isSummary = section === 'summary';

  // Nasza zakładka Summary (MatchSummary): dane z treści Genius, z zapisu akcji i link do nagrania.
  const [summary, setSummary] = useState<{ page: string; data: SummaryData }>();
  const summaryData = isSummary && summary?.page === page ? summary.data : undefined;
  const [pbp, setPbp] = useState<{ id?: string; stats?: PlayByPlayStats }>();
  const pbpStats = pbp && pbp.id === id ? pbp.stats : undefined;
  const [video, setVideo] = useState<{ id?: string; url?: string }>();
  const videoUrl = video && video.id === id ? video.url : undefined;
  const embedRef = useRef<HTMLDivElement>(null);
  // Najnowsze wyniki kwart dla onContent (treść Genius potrafi się podmienić po wstawieniu ich do nagłówka).
  const pbpRef = useRef(pbpStats);
  useEffect(() => {
    pbpRef.current = pbpStats;
  });

  const onContent = (root: HTMLElement) => {
    polishMatch(root);
    showPeriodScores(root, pbpRef.current);
    if (!isSummary) return;
    const data = readSummary(root);
    if (data && JSON.stringify(data) !== JSON.stringify(summaryData)) setSummary({ page, data });
  };

  // Zapis akcji: po treści bieżącej zakładki (to samo zapytanie co pobieranie zakładek na zapas poniżej, więc bez
  // dodatkowego wczytywania); w migawce z migawki.
  useEffect(() => {
    let active = true;
    const pbpPage = matchPage(id, cid, 'playbyplay');
    const ready = geniusSnapshot || !isGeniusDomain() ? Promise.resolve(undefined) : fetchGeniusJson(page).catch(() => undefined);
    ready
      .then(() => fetchGeniusPage(pbpPage))
      .then((root) => {
        if (active) setPbp({ id, stats: root ? readPlayByPlay(root) : undefined });
      });
    return () => {
      active = false;
    };
  }, [id, cid, page]);

  // Wyniki kwart w nagłówku Genius (na każdej zakładce meczu).
  useEffect(() => {
    showPeriodScores(embedRef.current, pbpStats);
  });

  // Nagranie meczu: zapisane w panelu, a bez wpisu — dopasowane do najnowszych filmów kanału po nazwach drużyn i dacie.
  const teamsKey = summaryData ? `${summaryData.teams[0].name}|${summaryData.teams[1].name}|${summaryData.date ?? ''}` : '';
  useEffect(() => {
    if (!id || !teamsKey) return;
    let active = true;
    loadMatchVideos()
      .then(async (videos) => {
        if (videos[id]) return youtubeWatchUrl(videos[id]);
        const [home, away, dateText] = teamsKey.split('|');
        const date = parseScheduleDate(dateText);
        const found = date && findStreamVideo(await loadYoutubeVideos(), home, away, date);
        return found ? youtubeWatchUrl(found.id) : undefined;
      })
      .then((url) => {
        if (active) setVideo({ id, url });
      });
    return () => {
      active = false;
    };
  }, [id, teamsKey]);

  // Po wczytaniu bieżącej zakładki pobieramy naraz pozostałe (geniusFetch trzyma je przez minutę), żeby przejście
  // między zakładkami nie czekało na Genius — pierwsza odpowiedź na adres trwa u nich 3–15 s. Bieżąca zakładka
  // idzie pierwsza, bo zapytania o pozostałe opóźniałyby ją.
  useEffect(() => {
    if (geniusSnapshot || !isGeniusDomain()) return;
    let active = true;
    fetchGeniusJson(page)
      .catch(() => undefined)
      .then(() => {
        if (active) MATCH_SECTIONS.forEach((other) => prefetchGeniusJson(matchPage(id, cid, other)));
      });
    return () => {
      active = false;
    };
  }, [id, cid, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to={found ? `/terminarz?edycja=${found.editionId}&liga=${found.leagueId}` : '/terminarz'}
        className="text-sm font-medium text-orange-600 hover:text-orange-700"
      >
        ← Terminarz
      </Link>
      {/* Z naszym widokiem Summary chowamy bloki Genius (skrócone tabele, porównanie, liderzy) — genius.css. */}
      <div ref={embedRef} className={`mt-4 ${summaryData ? 'genius-match--summary' : ''}`}>
        <GeniusEmbed key={page} page={page} nativeStyle className="genius-match" onContent={onContent} />
      </div>
      {summaryData && <MatchSummary data={summaryData} pbp={pbpStats} videoUrl={videoUrl} />}
    </div>
  );
}

export default GeniusMatchPage;
