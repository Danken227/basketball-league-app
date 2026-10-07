// Aktualności i regulamin przeniesione z dalk.pl na potrzeby prezentacji (20 ostatnich wpisów, stan z 8.10.2026).
// Pliki JSON tworzy scripts/scrape-dalk.mjs; treść to oczyszczony HTML (akapity, pogrubienia, linki,
// listy, obrazy) — bez stylów z Worda i edytora strony.
import newsData from './dalkNews.json';
import regulationsData from './dalkRegulations.json';

export interface NewsItem {
  slug: string;
  title: string;
  // Data publikacji, RRRR-MM-DD.
  date: string;
  excerpt: string;
  html: string;
  // Adres wpisu na dalk.pl.
  source: string;
}

export interface NewsCategory {
  label: string;
  gradient: string;
}

export interface RegulationsSection {
  label: string;
  title: string;
  // level 2 to podpunkty (a., b. albo numeracja pod punktem); numer punktu w label, treść bez numeru.
  items: { level: number; label: string; html: string }[];
}

export const news: NewsItem[] = newsData;
export const regulations: RegulationsSection[] = regulationsData;

export const NEWS_PER_PAGE = 10;

// Wpisy na dalk.pl nie mają kategorii (wszystkie to "Aktualności"), więc ustalamy ją z tytułu — kolor okładki karty.
const categories: { pattern: RegExp; category: NewsCategory }[] = [
  { pattern: /terminarz/i, category: { label: 'Terminarz', gradient: 'from-violet-600 to-purple-700' } },
  { pattern: /zapisy/i, category: { label: 'Zapisy', gradient: 'from-amber-500 to-orange-600' } },
  { pattern: /play-off|finał/i, category: { label: 'Play-off', gradient: 'from-orange-500 to-red-600' } },
  { pattern: /grupy|system rozgrywek/i, category: { label: 'Rozgrywki', gradient: 'from-cyan-600 to-sky-700' } },
  { pattern: /przepis|regulamin|sędzi/i, category: { label: 'Przepisy', gradient: 'from-slate-600 to-slate-800' } },
  { pattern: /sponsor/i, category: { label: 'Partnerzy', gradient: 'from-emerald-600 to-teal-700' } },
];
const defaultCategory: NewsCategory = { label: 'Wydarzenia', gradient: 'from-rose-600 to-pink-700' };

export const newsCategory = (item: NewsItem) => categories.find(({ pattern }) => pattern.test(item.title))?.category ?? defaultCategory;

const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

// "2026-10-02" → "2 października 2026"
export function formatNewsDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

export const newsPageCount = Math.ceil(news.length / NEWS_PER_PAGE);

// Strona listy aktualności, numerowana od 1.
export const newsPage = (page: number) => news.slice((page - 1) * NEWS_PER_PAGE, page * NEWS_PER_PAGE);

export const newsBySlug = (slug: string) => news.find((item) => item.slug === slug);

export const newsPath = (item: NewsItem) => `/aktualnosci/${item.slug}`;

// Linki w treści prowadzą poza naszą stronę (dalk.pl, pliki do pobrania, YouTube) — otwieramy je w nowej karcie.
export const withExternalLinks = (html: string) => html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
