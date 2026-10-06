// Pamięć ostatnio wczytanych treści Genius: przy ponownym wyświetleniu (np. po zmianie filtra) pokazujemy je
// od razu, a świeże dane podmieniają je w tle. W pamięci strony trzymamy wszystko, a w sessionStorage
// (przetrwa odświeżenie strony, do końca wizyty) tylko mniejsze treści, żeby nie przekroczyć limitu przeglądarki.

export interface GeniusEmbedOptions {
  page: string;
  blockDisplay?: string;
  showSubMenus?: boolean;
  showMatchFilter?: boolean;
  showTitle?: boolean;
}

// Klucz musi uwzględniać wszystko, co zmienia treść zwracaną przez Genius (wartości domyślne jak w GeniusEmbed).
export const geniusCacheKey = ({ page, blockDisplay, showSubMenus = true, showMatchFilter = true, showTitle = false }: GeniusEmbedOptions) =>
  [page, blockDisplay ?? '', showSubMenus, showMatchFilter, showTitle].join('|');

const memoryCache = new Map<string, string>();
const STORAGE_PREFIX = 'genius:';
const STORAGE_MAX_LENGTH = 300_000;

export function readGeniusCache(key: string): string | undefined {
  const fromMemory = memoryCache.get(key);
  if (fromMemory) return fromMemory;
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeGeniusCache(key: string, html: string) {
  memoryCache.set(key, html);
  if (html.length > STORAGE_MAX_LENGTH) return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, html);
  } catch {
    // Brak miejsca albo zablokowany sessionStorage — wystarczy pamięć strony.
  }
}

export const isGeniusCached = (key: string) => readGeniusCache(key) !== undefined;
