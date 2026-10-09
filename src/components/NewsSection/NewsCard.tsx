import { Link } from 'react-router-dom';
import { formatNewsDate, newsCategory, newsPath, type NewsItem } from '../../data/news';

// Okładka: baner wpisu z dalk.pl (te same tła co tam). Kolor kategorii widać do wczytania obrazka
// (i zamiast niego, gdy wpis dodany w panelu nie ma okładki).
export function NewsCover({ item, className }: { item: NewsItem; className: string }) {
  const category = newsCategory(item);
  return (
    <div className={`keep-dark relative overflow-hidden bg-gradient-to-br ${category.gradient} ${className}`}>
      {item.image && <img src={item.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{category.label}</span>
    </div>
  );
}

// Karta aktualności; cała karta prowadzi do treści wpisu.
function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  return (
    <Link
      to={newsPath(item)}
      className={`group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <article>
        <NewsCover item={item} className={featured ? 'aspect-[5/2]' : 'aspect-[2/1]'} />
        <div className="p-4">
          <time dateTime={item.date} className="text-[11px] text-slate-500">
            {formatNewsDate(item.date)}
          </time>
          <h3 className={`mt-1 font-bold text-slate-900 group-hover:text-orange-600 ${featured ? 'text-lg' : 'text-sm'}`}>{item.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-slate-600">{item.excerpt}</p>
        </div>
      </article>
    </Link>
  );
}

export default NewsCard;
