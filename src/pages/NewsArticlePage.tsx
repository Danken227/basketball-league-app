import { Link, useParams } from 'react-router-dom';
import { NewsCover } from '../components/NewsSection/NewsCard';
import { formatNewsDate, news, newsBySlug, newsCategory, newsPath, withExternalLinks } from '../data/news';
import Placeholder from './Placeholder';

// Style treści wpisu (oczyszczony HTML z dalk.pl): akapity, listy, linki, obrazy i tabele.
const contentClass = [
  'text-[15px] leading-relaxed text-slate-700',
  '[&_p]:my-2 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-900 [&_h4]:mt-4 [&_h4]:font-bold [&_h4]:text-slate-900',
  '[&_strong]:font-semibold [&_strong]:text-slate-900',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  '[&_a]:font-medium [&_a]:break-words [&_a]:text-orange-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-orange-700',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl',
  '[&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1',
].join(' ');

// Treść aktualności; pod nią przejście do nowszego i starszego wpisu.
function NewsArticlePage() {
  const { slug = '' } = useParams();
  const item = newsBySlug(slug);
  if (!item) return <Placeholder title="Nie znaleziono aktualności" />;

  const index = news.indexOf(item);
  const newer = news[index - 1];
  const older = news[index + 1];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/aktualnosci" className="text-sm font-medium text-orange-600 hover:text-orange-700">
        ← Wszystkie aktualności
      </Link>
      <article className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <NewsCover item={item} className="aspect-video" />
        <div className="p-5 sm:p-8">
          <p className="text-xs text-slate-500">
            <time dateTime={item.date}>{formatNewsDate(item.date)}</time> · {newsCategory(item).label}
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{item.title}</h1>
          <div className={`mt-5 ${contentClass}`} dangerouslySetInnerHTML={{ __html: withExternalLinks(item.html) }} />
        </div>
      </article>
      <nav className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Inne aktualności">
        {newer ? (
          <Link to={newsPath(newer)} className="rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-orange-300">
            <span className="text-xs text-slate-500">← Nowsza</span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">{newer.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {older && (
          <Link to={newsPath(older)} className="rounded-xl bg-white p-4 text-right ring-1 ring-slate-200 transition hover:ring-orange-300">
            <span className="text-xs text-slate-500">Starsza →</span>
            <span className="mt-1 block text-sm font-semibold text-slate-900">{older.title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

export default NewsArticlePage;
