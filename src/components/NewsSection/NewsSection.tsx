import { currentSeason, getPlacement, getStandings, getTopPlayers, lastPlayedRound, leagues } from '../../data/league';

interface NewsItem {
  id: string;
  category: string;
  date: string;
  title: string;
  excerpt: string;
  gradient: string;
}

// Testowe aktualności; część z nich korzysta z wygenerowanych wyników.
function buildNews(): NewsItem[] {
  const leader = getStandings('eks')[0];
  const scorer = getTopPlayers('points', 'eks', 1)[0];
  const assister = getTopPlayers('assists', 'eks', 1)[0];
  const groupCount = leagues.reduce((sum, league) => sum + league.groups.length, 0);

  return [
    {
      id: 'round-summary',
      category: 'Podsumowanie',
      date: '05.10.2026',
      title: `Podsumowanie ${lastPlayedRound('eks')}. kolejki we wszystkich ligach`,
      excerpt: `${leader.team.name} prowadzi w Ekstralidze z bilansem ${leader.wins}-${leader.losses}. Sprawdź wyniki i najciekawsze akcje weekendu.`,
      gradient: 'from-orange-500 to-red-600',
    },
    {
      id: 'top-scorer',
      category: 'Zawodnik',
      date: '04.10.2026',
      title: `${scorer.player.firstName} ${scorer.player.lastName} liderem strzelców Ekstraligi`,
      excerpt: `Zawodnik ${scorer.team.name} notuje średnio ${scorer.average.toFixed(1)} pkt na mecz.`,
      gradient: 'from-blue-600 to-indigo-700',
    },
    {
      id: 'youtube',
      category: 'Media',
      date: '03.10.2026',
      title: 'Transmisje meczów na kanale YouTube',
      excerpt: 'Od tej kolejki wybrane spotkania Ekstraligi transmitujemy na żywo. Subskrybuj kanał, żeby nie przegapić meczu.',
      gradient: 'from-rose-600 to-pink-700',
    },
    {
      id: 'assists',
      category: 'Statystyki',
      date: '02.10.2026',
      title: 'Kto najlepiej rozgrywa?',
      excerpt: `${assister.player.firstName} ${assister.player.lastName} (${assister.team.name}) prowadzi w asystach Ekstraligi: ${assister.average.toFixed(1)} na mecz.`,
      gradient: 'from-emerald-600 to-teal-700',
    },
    {
      id: 'rules',
      category: 'Regulamin',
      date: '28.09.2026',
      title: 'Zmiany w regulaminie rozgrywek',
      excerpt: 'Od 6. kolejki obowiązuje nowy limit fauli drużynowych i zasady zgłaszania zawodników w trakcie sezonu.',
      gradient: 'from-slate-600 to-slate-800',
    },
    {
      id: 'registration',
      category: 'Zapisy',
      date: '20.09.2026',
      title: 'Ruszyły zapisy do rundy wiosennej',
      excerpt: `Zgłoś swój zespół do jednej z ${leagues.length} lig. Liczba miejsc ograniczona.`,
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      id: 'schedule',
      category: 'Terminarz',
      date: '15.09.2026',
      title: 'Terminarz fazy grupowej opublikowany',
      excerpt: 'W 1., 2. i 3. Lidze zespoły grają każdy z każdym w swojej grupie. Sprawdź daty i hale w zakładce Terminarz.',
      gradient: 'from-violet-600 to-purple-700',
    },
    {
      id: 'season-start',
      category: 'Liga',
      date: '05.09.2026',
      title: `Wystartował sezon ${currentSeason.name}`,
      excerpt: `${getPlacement(currentSeason.id).length} zespołów gra w Ekstralidze i ${leagues.length - 1} ligach podzielonych łącznie na ${groupCount} grup.`,
      gradient: 'from-cyan-600 to-sky-700',
    },
  ];
}

const NewsSection = () => {
  const news = buildNews();

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-slate-900">Aktualności</h2>
        <a href="#" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          Wszystkie →
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {news.map((item, index) => (
          <article
            key={item.id}
            className={`group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md ${
              index === 0 ? 'sm:col-span-2' : ''
            }`}
          >
            <div className={`relative bg-gradient-to-br ${item.gradient} ${index === 0 ? 'h-48' : 'h-32'}`}>
              <svg className="absolute -right-6 -bottom-6 h-32 w-32 text-white/15" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden="true">
                <circle cx="50" cy="50" r="46" />
                <path d="M4 50h92M50 4v92M18 18c18 18 18 46 0 64M82 18c-18 18-18 46 0 64" />
              </svg>
              <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                {item.category}
              </span>
            </div>
            <div className="p-4">
              <time className="text-[11px] text-slate-500">{item.date}</time>
              <h3 className={`mt-1 font-bold text-slate-900 group-hover:text-orange-600 ${index === 0 ? 'text-lg' : 'text-sm'}`}>
                <a href="#">{item.title}</a>
              </h3>
              <p className="mt-1 text-sm text-slate-600">{item.excerpt}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default NewsSection;
