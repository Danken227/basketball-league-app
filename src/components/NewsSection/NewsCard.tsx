import { Link } from 'react-router-dom';
import { newsCategory, newsDateLabel, newsImage, newsPath, type NewsItem } from '../../data/news';

// Okładka: baner wpisu z dalk.pl (te same tła co tam). Kolor kategorii widać do wczytania obrazka
// (i zamiast niego, gdy wpis dodany w panelu nie ma okładki). priority: okładka widoczna od razu po wejściu (największy
// element strony) — wczytywana od razu i przed innymi obrazkami, a nie dopiero po zbudowaniu strony.
export function NewsCover({ item, className, priority = false }: { item: NewsItem; className: string; priority?: boolean }) {
  const category = newsCategory(item);
  return (
    <div className={`keep-dark relative overflow-hidden bg-gradient-to-br ${category.gradient} ${className}`}>
      {/* Wpisy dodane w panelu mogą mieć jeszcze adres banera z dalk.pl — też podmieniamy na lokalny. */}
      {item.image && (
        <img
          src={newsImage(item.image)}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{category.label}</span>
    </div>
  );
}

// Karta aktualności; cała karta prowadzi do treści wpisu.
function NewsCard({ item, featured = false, priority = false }: { item: NewsItem; featured?: boolean; priority?: boolean }) {
  return (
    <Link
      to={newsPath(item)}
      className={`group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <article>
        <NewsCover item={item} className={featured ? 'aspect-[5/2]' : 'aspect-[2/1]'} priority={priority} />
        <div className="p-4">
          <time dateTime={item.publishedAt ?? item.date} className="text-[11px] text-slate-500">
            {newsDateLabel(item)}
          </time>
          <h3 className={`mt-1 font-bold text-slate-900 group-hover:text-orange-600 ${featured ? 'text-lg' : 'text-sm'}`}>{item.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-slate-600">{item.excerpt}</p>
        </div>
      </article>
    </Link>
  );
}

// Miejsce na kartę, dopóki nie znamy listy wpisów (wpisy z panelu przychodzą z serwera i wskakują na górę listy) —
// karty pojawiają się od razu w docelowej kolejności, bez przesuwania strony.
export function NewsCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${featured ? 'sm:col-span-2' : ''}`} aria-hidden="true">
      <div className={`animate-pulse bg-slate-200 ${featured ? 'aspect-[5/2]' : 'aspect-[2/1]'}`} />
      <div className="space-y-2 p-4">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className={`rounded bg-slate-200 ${featured ? 'h-6' : 'h-4'}`} />
        <div className="h-14 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default NewsCard;
