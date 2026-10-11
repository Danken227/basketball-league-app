import { geniusCacheKey } from './geniusCache';
import { GENIUS_ORGANIZATION, geniusSnapshot } from './geniusConfig';
import { loadSnapshot } from './geniusSnapshot';

// Treści stron Genius pobieramy wprost z serwera Genius — tak samo, jak robi to jego skrypt osadzenia
// (hosted.dcd.shared.geniussports.com/embed/?DALK), tylko bez wczytywania tego skryptu przy każdej treści.
// Serwer odpowiada JSON-em: gotowy HTML w polu "html" oraz arkusze (css) i skrypty (js), których treść używa.

export interface GeniusPageOptions {
  // Nagłówek strony Genius (np. nazwa i logo drużyny).
  showTitle?: boolean;
  showSubMenus?: boolean;
  showMatchFilter?: boolean;
  // Tylko jeden blok strony (np. jedna kategoria liderów).
  blockDisplay?: string;
}

export interface GeniusPageJson {
  html?: string;
  css?: string[];
  js?: string[];
}

// Adres treści z tymi samymi parametrami co w skrypcie osadzenia: iurl — adres, na który Genius kieruje linki
// (przepisujemy je potem na nasze), _ht — bez nagłówka, _hsm — bez podmenu, _mf — filtr meczów, _bl — jeden blok.
export function geniusPageUrl(page: string, { showTitle = false, showSubMenus = true, showMatchFilter = true, blockDisplay }: GeniusPageOptions = {}) {
  let url = `https://hosted.dcd.shared.geniussports.com/embednf/${GENIUS_ORGANIZATION}/en${page.startsWith('/') ? page : `/${page}`}`;
  if (!url.includes('?')) url += '?';
  url += `&iurl=${encodeURIComponent(`${window.location.origin}/genius`)}`;
  if (blockDisplay) url += `&_bl=${blockDisplay}`;
  if (!showTitle) url += '&_ht=1';
  if (!showSubMenus) url += '&_hsm=1';
  if (showMatchFilter) url += '&_mf=1';
  return url;
}

// Odpowiedzi Genius (także jeszcze pobierane) przez minutę na adres: kolejne osadzenie tej samej treści i treść
// pobrana z wyprzedzeniem (prefetchGeniusJson) nie czekają drugi raz na serwer. Pierwsza odpowiedź na adres trwa
// u Genius 3–7 s (potem ich CloudFront oddaje ją w 0,15 s), więc zapytania nie przerywamy, gdy osadzenie zniknie —
// dokończone przyda się przy powrocie. Odpowiedzi bez treści (błąd, pusta strona przy przeciążeniu) nie zostają.
const RESPONSE_CACHE_MS = 60_000;
const responses = new Map<string, { at: number; json: Promise<GeniusPageJson> }>();

function requestGeniusJson(url: string): Promise<GeniusPageJson> {
  const now = Date.now();
  for (const [key, entry] of responses) if (now - entry.at > RESPONSE_CACHE_MS) responses.delete(key);
  const cached = responses.get(url);
  if (cached) return cached.json;
  const entry = {
    at: now,
    json: fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Genius: ${response.status}`);
      return (await response.json()) as GeniusPageJson;
    }),
  };
  const forget = () => {
    if (responses.get(url) === entry) responses.delete(url);
  };
  entry.json.then((json) => json.html?.includes('hs-embed') || forget(), forget);
  responses.set(url, entry);
  return entry.json;
}

export function fetchGeniusJson(page: string, options?: GeniusPageOptions, signal?: AbortSignal): Promise<GeniusPageJson> {
  const json = requestGeniusJson(geniusPageUrl(page, options));
  if (!signal) return json;
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    json.then(resolve, reject);
  });
}

// Pobranie treści z wyprzedzeniem (np. pozostałych zakładek meczu), żeby przejście do niej nie czekało na Genius.
export function prefetchGeniusJson(page: string, options?: GeniusPageOptions): Promise<void> {
  return requestGeniusJson(geniusPageUrl(page, options)).then(
    () => undefined,
    () => undefined,
  );
}

// Treść strony Genius jako element (poza dokumentem) — do odczytu danych (terminarz, statystyki meczów, listy).
// Linki prowadzą wtedy na stronę Genius ("…/genius?&WHurl=/competition/…"), nie nasze. W wersji demonstracyjnej
// treść z migawki (z linkami już przepisanymi na nasze adresy); undefined, gdy strony w niej nie ma.
export async function fetchGeniusPage(page: string): Promise<HTMLElement | undefined> {
  const html = geniusSnapshot ? await loadSnapshot(geniusCacheKey({ page })) : (await fetchGeniusJson(page).catch(() => undefined))?.html;
  return html ? new DOMParser().parseFromString(html, 'text/html').body : undefined;
}
