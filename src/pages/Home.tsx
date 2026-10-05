import LeagueTable from '../components/LeagueTable/LeagueTable';
import NewsSection from '../components/NewsSection/NewsSection';
import ResultsBar from '../components/ResultsBar/ResultsBar';
import StatsTable from '../components/StatsTable/StatsTable';

const Home = () => {
  return (
    <>
      <ResultsBar />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[340px_1fr] lg:px-8">
        <aside className="flex flex-col gap-6">
          <LeagueTable />
          <StatsTable />
        </aside>
        <NewsSection />
      </div>
    </>
  );
};

export default Home;
