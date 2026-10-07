import { fetchYoutubeFeed } from './_youtube.js';

// Funkcja Vercela: /api/youtube-feed → [{ id, title, published }] z kanału YouTube ligi.
// Odpowiedź zapamiętuje serwer Vercela na 5 minut, więc YouTube dostaje najwyżej kilka zapytań na godzinę.
export default async function handler(req, res) {
  try {
    const videos = await fetchYoutubeFeed();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(videos);
  } catch (error) {
    res.status(502).json({ error: String(error) });
  }
}
