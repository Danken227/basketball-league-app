import { geniusCacheKey } from './geniusCache';
import { GENIUS_ORGANIZATION, geniusSnapshot } from './geniusConfig';
import { loadSnapshot } from './geniusSnapshot';

// Treść strony Genius jako element (poza dokumentem), bez osadzania: to samo zapytanie, które wysyła skrypt
// osadzenia, ale bez wczytywania skryptu (szybciej i kilka stron naraz). Serwer odpowiada JSON-em z gotowym HTML-em
// w polu "html" — linki prowadzą wtedy do stron Genius (".../team/123"), nie naszych. W wersji demonstracyjnej
// treść z migawki (z linkami już przepisanymi na nasze adresy); undefined, gdy strony w niej nie ma.
export async function fetchGeniusPage(page: string): Promise<HTMLElement | undefined> {
  const html = geniusSnapshot
    ? await loadSnapshot(geniusCacheKey({ page }))
    : await fetch(
        `https://hosted.dcd.shared.geniussports.com/embednf/${GENIUS_ORGANIZATION}/en${page}?&iurl=${encodeURIComponent(`${window.location.origin}/genius`)}&_ht=1&_mf=1`,
      )
        .then((response) => (response.ok ? (response.json() as Promise<{ html?: string }>) : undefined))
        .then((data) => data?.html);
  return html ? new DOMParser().parseFromString(html, 'text/html').body : undefined;
}
