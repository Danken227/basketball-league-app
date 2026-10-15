// Nagrania meczów na YouTube zapisane w bazie panelu (numer meczu → numer filmu). YouTube bez klucza API podaje
// tylko 15 najnowszych filmów kanału, a liga tworzy transmisje z wyprzedzeniem (np. w środę na mecze najbliższych
// weekendów), więc nagranie meczu wypada z tej listy po kilku dniach. Panel administratora przy każdym sprawdzeniu
// terminarzy (przy wejściu do panelu i co godzinę, gdy jest otwarty) dopasowuje filmy do rozegranych i najbliższych meczów i zapisuje
// nowe — wtedy zostają przy meczu na stałe (film transmisji staje się jej nagraniem). Zakładka „Transmisje”
// pozwala je poprawić ręcznie.
import { adminRequest } from '../../data/siteContent';
import type { PlayedMatch } from './geniusUnfinished';
import { findStreamVideo, loadYoutubeVideos } from './youtubeStreams';

export type MatchVideos = Record<string, string>;

export const loadStoredVideos = () => adminRequest<{ videos: MatchVideos }>('match-videos').then((data) => data.videos ?? {});

export const saveMatchVideos = (videos: Record<string, string | null>) =>
  adminRequest<{ videos: MatchVideos }>('match-videos-save', { videos }).then((data) => data.videos);

// Nowe dopasowania: mecze bez zapisanego nagrania, dla których na liście kanału jest film z obiema drużynami
// w tytule (z datą blisko meczu). Film już przypisany innemu meczowi pomijamy.
export async function syncMatchVideos(played: PlayedMatch[]): Promise<{ videos: MatchVideos; added: number }> {
  const [stored, feed] = await Promise.all([loadStoredVideos(), loadYoutubeVideos()]);
  const used = new Set(Object.values(stored));
  const found: Record<string, string> = {};
  for (const match of played) {
    if (stored[match.id]) continue;
    const video = findStreamVideo(feed, match.home, match.away, match.date);
    if (!video || used.has(video.id)) continue;
    found[match.id] = video.id;
    used.add(video.id);
  }
  const added = Object.keys(found).length;
  return { videos: added > 0 ? await saveMatchVideos(found) : stored, added };
}
