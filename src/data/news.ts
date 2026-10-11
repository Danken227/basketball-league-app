// Aktualności i regulamin przeniesione z dalk.pl na potrzeby prezentacji (20 ostatnich wpisów, stan z 8.10.2026).
// Pliki JSON tworzy scripts/scrape-dalk.mjs; treść to oczyszczony HTML (akapity, pogrubienia, linki,
// listy, obrazy) — bez stylów z Worda i edytora strony.
import client from '@client/client';
import newsData from '@client/content/news.json';

export interface NewsItem {
  slug: string;
  title: string;
  // Data publikacji, RRRR-MM-DD.
  date: string;
  excerpt: string;
  html: string;
  // Baner wpisu z dalk.pl (okładka karty i wpisu).
  image: string;
  // Adres wpisu na dalk.pl.
  source: string;
  // Temat wybrany w panelu administratora (etykieta z newsCategories); bez niego temat wynika z tytułu.
  category?: string;
  // Chwila publikacji (ISO) — wpisy dodane w panelu mają też godzinę.
  publishedAt?: string;
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

// Banery wpisów z dalk.pl mamy u siebie, zmniejszone (WebP): oryginał PNG ważył 860 KB, a strona główna pokazuje
// go kilka razy. Inne obrazki (np. w treści wpisów) zostają z dalk.pl.
const localImages: Record<string, string> = client.news.imageRewrites;
export const newsImage = (url: string) => localImages[url] ?? url;

export const news: NewsItem[] = newsData.map((item) => ({ ...item, image: newsImage(item.image) }));

export const NEWS_PER_PAGE = 10;

// Wpisy na dalk.pl nie mają kategorii (wszystkie to "Aktualności"), więc ustalamy ją z tytułu — etykieta na okładce.
const categories: { pattern: RegExp; category: NewsCategory }[] = [
  { pattern: /terminarz/i, category: { label: 'Terminarz', gradient: 'from-violet-600 to-purple-700' } },
  { pattern: /zapisy/i, category: { label: 'Zapisy', gradient: 'from-amber-500 to-orange-600' } },
  { pattern: /play-off|finał/i, category: { label: 'Play-off', gradient: 'from-orange-500 to-red-600' } },
  { pattern: /grupy|system rozgrywek/i, category: { label: 'Rozgrywki', gradient: 'from-cyan-600 to-sky-700' } },
  { pattern: /przepis|regulamin|sędzi/i, category: { label: 'Przepisy', gradient: 'from-slate-600 to-slate-800' } },
  { pattern: /sponsor/i, category: { label: 'Partnerzy', gradient: 'from-emerald-600 to-teal-700' } },
];
const defaultCategory: NewsCategory = { label: 'Wydarzenia', gradient: 'from-rose-600 to-pink-700' };

// Tematy do wyboru w panelu administratora.
export const newsCategories = [...categories.map(({ category }) => category), defaultCategory];

export const newsCategory = (item: NewsItem) =>
  newsCategories.find(({ label }) => label === item.category) ?? categories.find(({ pattern }) => pattern.test(item.title))?.category ?? defaultCategory;

const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

// "2026-10-02" → "2 października 2026"
export function formatNewsDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

// Listy aktualności (wpisy z dalk.pl i dodane w panelu administratora — useNews w siteContent.ts).
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });

// Data wpisu do wyświetlenia: "2 października 2026", a przy wpisach z panelu także godzina ("…, 14:05").
export const newsDateLabel = (item: NewsItem) =>
  item.publishedAt ? `${formatNewsDate(item.date)}, ${timeFormat.format(new Date(item.publishedAt))}` : formatNewsDate(item.date);

export const newsPageCount = (list: NewsItem[]) => Math.max(1, Math.ceil(list.length / NEWS_PER_PAGE));

// Strona listy aktualności, numerowana od 1.
export const newsPage = (list: NewsItem[], page: number) => list.slice((page - 1) * NEWS_PER_PAGE, page * NEWS_PER_PAGE);

export const newsPath = (item: NewsItem) => `/aktualnosci/${item.slug}`;

// Linki w treści prowadzą poza naszą stronę (dalk.pl, pliki do pobrania, YouTube) — otwieramy je w nowej karcie.
export const withExternalLinks = (html: string) => html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
