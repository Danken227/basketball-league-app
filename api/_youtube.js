// Lista ostatnich filmów i transmisji kanału YouTube ligi (kanał RSS YouTube, bez klucza API).
// YouTube nie pozwala pobrać RSS ze strony w przeglądarce (brak nagłówków CORS), więc robi to serwer:
// funkcja Vercela api/youtube-feed.js albo serwer deweloperski Vite (vite.config.ts). Plik z "_" na początku
// Vercel traktuje jako pomocniczy, nie jako osobną funkcję.

export const YOUTUBE_CHANNEL_ID = 'UCAPNMcSyuqGYAzFEg3qL_wA'; // @Liga_DALK

const decode = (text) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export async function fetchYoutubeFeed() {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
  if (!response.ok) throw new Error(`YouTube RSS: ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    return id && title ? [{ id, title: decode(title), published }] : [];
  });
}
