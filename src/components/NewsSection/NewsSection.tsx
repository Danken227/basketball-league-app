import { Link } from 'react-router-dom';
import { useNews, useSiteContent } from '../../data/siteContent';
import NewsCard, { NewsCardSkeleton } from './NewsCard';

// Najnowsze aktualności na stronie głównej; pełna lista na /aktualnosci.
const HOME_NEWS_COUNT = 8;

const NewsSection = () => {
  const news = useNews();
  const { loaded } = useSiteContent();
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-slate-900">Aktualności</h2>
        <Link to="/aktualnosci" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          Wszystkie →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loaded
          ? news.slice(0, HOME_NEWS_COUNT).map((item, index) => <NewsCard key={item.slug} item={item} featured={index === 0} priority={index === 0} />)
          : Array.from({ length: HOME_NEWS_COUNT }, (_, index) => <NewsCardSkeleton key={index} featured={index === 0} />)}
      </div>
    </section>
  );
};

export default NewsSection;
