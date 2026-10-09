import { Link } from 'react-router-dom';
import { useNews } from '../../data/siteContent';
import NewsCard from './NewsCard';

// Najnowsze aktualności na stronie głównej; pełna lista na /aktualnosci.
const HOME_NEWS_COUNT = 8;

const NewsSection = () => {
  const news = useNews();
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-slate-900">Aktualności</h2>
        <Link to="/aktualnosci" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          Wszystkie →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {news.slice(0, HOME_NEWS_COUNT).map((item, index) => (
          <NewsCard key={item.slug} item={item} featured={index === 0} />
        ))}
      </div>
    </section>
  );
};

export default NewsSection;
