import { useEffect, useState } from 'react';
import NewsCard from '../components/NewsSection/NewsCard';
import type { NewsItem } from '../data/news';
import { adminRequest, useAdmin } from '../data/siteContent';
import { NewsArticle } from './NewsArticlePage';
import { readNewsDraft, NEWS_DRAFT_KEY, type NewsDraft } from './newsDraft';

// Podgląd aktualności przed publikacją (przycisk „Podgląd” w panelu administratora, nowe okno): wpis zbudowany
// przez serwer tak jak przy publikacji, ale bez zapisu. Ponowne kliknięcie „Podgląd” odświeża to okno.
function NewsPreviewPage() {
  const admin = useAdmin();
  const [draft, setDraft] = useState<NewsDraft | undefined>(readNewsDraft);
  const [result, setResult] = useState<{ draft: NewsDraft; item?: NewsItem; error?: string }>();

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === NEWS_DRAFT_KEY) setDraft(readNewsDraft());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!admin || !draft) return;
    let active = true;
    adminRequest<{ item: NewsItem }>('news-preview', draft)
      .then(({ item }) => active && setResult({ draft, item }))
      .catch((e: unknown) => active && setResult({ draft, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      active = false;
    };
  }, [admin, draft]);

  const item = result && result.draft === draft ? result.item : undefined;
  const status =
    admin === false
      ? 'Podgląd jest dostępny po zalogowaniu do panelu administratora.'
      : !draft
        ? 'Brak wpisu do podglądu — otwórz go przyciskiem „Podgląd” w panelu administratora.'
        : result && result.draft === draft && result.error
          ? result.error
          : !item
            ? 'Wczytywanie podglądu…'
            : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800 ring-1 ring-orange-200">
        Podgląd — wpis nie jest jeszcze opublikowany. Po zmianach w formularzu kliknij ponownie „Podgląd”, a to okno się odświeży.
      </p>
      {status || !item ? (
        <p className="py-16 text-center text-sm text-slate-500">{status}</p>
      ) : (
        <>
          <NewsArticle item={item} />
          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">Na liście aktualności</h2>
          {/* Karta prowadzi do wpisu, którego jeszcze nie ma — w podglądzie bez klikania. */}
          <div className="pointer-events-none mt-3 max-w-sm" aria-hidden="true">
            <NewsCard item={item} />
          </div>
        </>
      )}
    </div>
  );
}

export default NewsPreviewPage;
