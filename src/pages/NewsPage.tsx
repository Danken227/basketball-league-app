import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { icons } from '../components/common/icons';
import PageHeader from '../components/common/PageHeader';
import NewsCard from '../components/NewsSection/NewsCard';
import { newsPage, newsPageCount } from '../data/news';
import { useNews } from '../data/siteContent';

// Lista aktualności po 10 na stronę; numer strony w adresie (?strona=2), żeby dało się do niej wrócić.
function NewsPage() {
  const [params] = useSearchParams();
  const news = useNews();
  const pageCount = newsPageCount(news);
  const page = Math.min(Math.max(Number(params.get('strona')) || 1, 1), pageCount);
  const pageLink = (target: number) => (target === 1 ? '/aktualnosci' : `/aktualnosci?strona=${target}`);
  // Zmiana strony zmienia tylko parametr adresu (ScrollToTop reaguje na ścieżkę), więc przewijamy tutaj.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const navClass = 'rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-slate-200 transition';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Aktualności" icon={icons.news} />
      <div className="grid gap-4 sm:grid-cols-2">
        {newsPage(news, page).map((item) => (
          <NewsCard key={item.slug} item={item} />
        ))}
      </div>
      <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Strony aktualności">
        {page > 1 ? (
          <Link to={pageLink(page - 1)} className={`${navClass} bg-white text-slate-700 hover:text-orange-600`}>
            ← Nowsze
          </Link>
        ) : (
          <span className={`${navClass} text-slate-400`} aria-disabled="true">
            ← Nowsze
          </span>
        )}
        <span className="text-sm text-slate-500">
          Strona {page} z {pageCount}
        </span>
        {page < pageCount ? (
          <Link to={pageLink(page + 1)} className={`${navClass} bg-white text-slate-700 hover:text-orange-600`}>
            Starsze →
          </Link>
        ) : (
          <span className={`${navClass} text-slate-400`} aria-disabled="true">
            Starsze →
          </span>
        )}
      </nav>
    </div>
  );
}

export default NewsPage;
