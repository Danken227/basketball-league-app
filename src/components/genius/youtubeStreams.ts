// Transmisje meczów z kanału YouTube ligi (lista z /api/youtube-feed — funkcja Vercela albo serwer Vite).
// Tytuły transmisji mają postać "Gospodarz - Gość", np. "4us Basket Maślice - Delta Szwadron"; dopasowujemy je
// do pełnych nazw drużyn z terminarza Genius, z tolerancją na drobne różnice, i do daty meczu.

export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@Liga_DALK';

export interface YoutubeVideo {
  id: string;
  title: string;
  published?: string;
}

// Lista pobierana najwyżej co 2 minuty (transmisja może zostać utworzona już w trakcie meczu).
const FEED_MAX_AGE_MS = 2 * 60 * 1000;
let feed: { at: number; videos: Promise<YoutubeVideo[]> } | undefined;

export function loadYoutubeVideos() {
  if (!feed || Date.now() - feed.at > FEED_MAX_AGE_MS) {
    feed = {
      at: Date.now(),
      videos: fetch('/api/youtube-feed')
        .then((response) => (response.ok ? (response.json() as Promise<YoutubeVideo[]>) : []))
        .catch(() => []),
    };
  }
  return feed.videos;
}

// Słowa nazwy bez wielkości liter, polskich znaków i interpunkcji ("Łobuzersi II" → ["lobuzersi", "ii"]).
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);

// Część wspólna słów względem krótszej z nazw: 1 = jedna nazwa zawiera się w drugiej ("4us Pio Studio" ↔ "4us Basket Pio Studio").
function similarity(a: string, b: string) {
  const x = words(a);
  const y = new Set(words(b));
  if (x.length === 0 || y.size === 0) return 0;
  return x.filter((word) => y.has(word)).length / Math.min(x.length, y.size);
}

const MAX_DAYS_APART = 3;

// Transmisja meczu: tytuł z obiema drużynami (w dowolnej kolejności), opublikowana najbliżej daty meczu.
export function findStream(videos: YoutubeVideo[], home: string, away: string, date: Date): string | undefined {
  const candidates = videos.flatMap((video) => {
    const [first, second] = video.title.split(/\s+[-–—]\s+|\s+vs\.?\s+/i);
    if (!first || !second) return [];
    const straight = Math.min(similarity(first, home), similarity(second, away));
    const swapped = Math.min(similarity(first, away), similarity(second, home));
    if (Math.max(straight, swapped) < 0.5) return [];
    const daysApart = video.published ? Math.abs(new Date(video.published).getTime() - date.getTime()) / 86400000 : 0;
    return daysApart <= MAX_DAYS_APART ? [{ video, daysApart }] : [];
  });
  const best = candidates.sort((a, b) => a.daysApart - b.daysApart)[0];
  return best && `https://www.youtube.com/watch?v=${best.video.id}`;
}
