import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import GeniusEmbed from '../../components/genius/GeniusEmbed';
import { findCompetition, geniusSnapshot, isGeniusDomain } from '../../components/genius/geniusConfig';
import { geniusCacheKey } from '../../components/genius/geniusCache';
import { fetchGeniusJson, prefetchGeniusJson } from '../../components/genius/geniusFetch';
import { inSnapshot } from '../../components/genius/geniusSnapshot';

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
      <div className="mt-4">
        <GeniusEmbed key={page} page={page} nativeStyle className="genius-match" onContent={polishMatch} />
      </div>
    </div>
  );
}

export default GeniusMatchPage;
