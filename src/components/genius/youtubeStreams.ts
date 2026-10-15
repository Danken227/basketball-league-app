// Transmisje meczów z kanału YouTube ligi (lista z /api/youtube-feed — funkcja Vercela albo serwer Vite).
// Tytuły transmisji mają postać "Gospodarz - Gość", np. "4us Basket Maślice - Delta Szwadron"; dopasowujemy je
// do pełnych nazw drużyn z terminarza Genius, z tolerancją na drobne różnice, i do daty meczu.
import client from '@client/client';

export const YOUTUBE_CHANNEL_URL = client.links.youtube;

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
    // Numer drużyny cyfrą ("Grube Dziki 2" na YouTube) = rzymską ("Grube Dziki II" w Genius).
    .map((word) => ({ '2': 'ii', '3': 'iii', '4': 'iv' })[word] ?? word)
    .filter((word) => word.length > 1);

// Słowa wspólne dla wielu drużyn ("Basket Team", "UKS", "Wrocław") nie świadczą o tej samej drużynie — bez nich
// "Cosmodisc Team – 2 Hills Basket" pasowało do "FTP Basketball Team – Unterer Logistics Wrocław Basket Team".
const GENERIC_WORDS = new Set(['team', 'basket', 'basketball', 'koszykowka', 'club', 'klub', 'sport', 'ks', 'kk', 'kks', 'uks', 'mks', 'wks', 'sks', 'wroclaw']);
// Oznaczenie kolejnej drużyny klubu ("Grube Dziki II") — musi się zgadzać, bo inaczej pierwsza i druga drużyna
// to dla dopasowania ta sama.
const TEAM_MARKS = new Set(['ii', 'iii', 'iv', 'og']);

// Część wspólna słów względem krótszej z nazw: 1 = jedna nazwa zawiera się w drugiej ("4us Pio Studio" ↔ "4us Basket Pio Studio").
function similarity(a: string, b: string) {
  const marks = (list: string[]) => list.filter((word) => TEAM_MARKS.has(word)).sort().join();
  const [allX, allY] = [words(a), words(b)];
  if (marks(allX) !== marks(allY)) return 0;
  const distinctive = (list: string[]) => {
    const kept = list.filter((word) => !GENERIC_WORDS.has(word) && !TEAM_MARKS.has(word));
    return kept.length > 0 ? kept : list;
  };
  const x = [...new Set(distinctive(allX))];
  const y = new Set(distinctive(allY));
  if (x.length === 0 || y.size === 0) return 0;
  return x.filter((word) => y.has(word)).length / Math.min(x.length, y.size);
}

// Transmisje liga tworzy na YouTube z wyprzedzeniem — nawet 10 dni przed spotkaniem (np. 15.10 na mecze
// 24–25.10), dlatego dopuszczamy dwa tygodnie przed meczem. Po meczu film transmisji już istnieje, więc film
// utworzony ponad 2 dni po meczu to transmisja innego spotkania (np. rewanżu tych samych drużyn). Tytuł nadal
// musi zawierać obie drużyny, a data wybiera najlepszą transmisję, gdy takich materiałów jest więcej.
const MAX_DAYS_BEFORE = 14;
const MAX_DAYS_AFTER = 2;

export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

// Numer filmu z linku YouTube (watch?v=…, youtu.be/…, /live/…, /shorts/…, /embed/…) albo sam numer.
export function youtubeVideoId(text: string): string | undefined {
  const value = text.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  const m = value.match(/(?:[?&]v=|youtu\.be\/|\/(?:live|shorts|embed)\/)([A-Za-z0-9_-]{11})/);
  return m?.[1];
}

// Transmisja meczu: tytuł z obiema drużynami (w dowolnej kolejności), opublikowana najbliżej daty meczu.
export function findStreamVideo(videos: YoutubeVideo[], home: string, away: string, date: Date): YoutubeVideo | undefined {
  const candidates = videos.flatMap((video) => {
    // Nazwa drużyny też bywa z myślnikiem ("Blues Jelcz - Laskowice - Wrofinanse.pl…"), więc sprawdzamy każde
    // miejsce podziału tytułu na dwie drużyny.
    const parts = video.title.split(/\s+[-–—]\s+|\s+vs\.?\s+/i);
    const score = Math.max(
      0,
      ...parts.slice(1).map((_, i) => {
        const first = parts.slice(0, i + 1).join(' - ');
        const second = parts.slice(i + 1).join(' - ');
        return Math.max(Math.min(similarity(first, home), similarity(second, away)), Math.min(similarity(first, away), similarity(second, home)));
      }),
    );
    if (score < 0.5) return [];
    // Dni od meczu do utworzenia filmu (ujemne — przed meczem).
    const offset = video.published ? (new Date(video.published).getTime() - date.getTime()) / 86400000 : 0;
    return offset >= -MAX_DAYS_BEFORE && offset <= MAX_DAYS_AFTER ? [{ video, daysApart: Math.abs(offset) }] : [];
  });
  return candidates.sort((a, b) => a.daysApart - b.daysApart)[0]?.video;
}

export function findStream(videos: YoutubeVideo[], home: string, away: string, date: Date): string | undefined {
  const video = findStreamVideo(videos, home, away, date);
  return video && youtubeWatchUrl(video.id);
}
