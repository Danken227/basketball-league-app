import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { icons } from './components/common/icons';
import DemoBanner from './components/DemoBanner/DemoBanner';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import Footer from './components/Footer/Footer';
import BySource from './components/genius/BySource';
import Header from './components/Header/Header';
import GeniusTeamPage from './pages/genius/GeniusTeamPage';
import GeniusLinkPage from './pages/genius/GeniusLinkPage';
import GeniusListPage from './pages/genius/GeniusListPage';
import GeniusMatchPage from './pages/genius/GeniusMatchPage';
import GeniusPlayerPage from './pages/genius/GeniusPlayerPage';
import GeniusPlayersPage from './pages/genius/GeniusPlayersPage';
import Home from './pages/Home';
import NewsArticlePage from './pages/NewsArticlePage';
import NewsPage from './pages/NewsPage';
import Placeholder from './pages/Placeholder';
import PlayerPage from './pages/PlayerPage';
import PlayersPage from './pages/PlayersPage';
import RegulationsPage from './pages/RegulationsPage';
import SchedulePage from './pages/SchedulePage';
import StatisticsPage from './pages/StatisticsPage';
import TablesPage from './pages/TablesPage';
import TeamPage from './pages/TeamPage';
import TeamsPage from './pages/TeamsPage';

// Zbieranie migawki danych Genius do wersji demonstracyjnej — tylko na serwerze deweloperskim (poza buildem).
const SnapshotCrawler = import.meta.env.DEV ? lazy(() => import('./pages/SnapshotCrawler')) : null;

// Po przejściu na inną stronę (np. z linku w tabeli) zaczynamy od góry; zmiana filtrów w adresie nie przewija.
function ScrollToTop() {
  const { pathname } = useLocation();
  // Klamry są konieczne: wartość zwrócona z efektu to dla Reacta funkcja sprzątająca, a nowsze przeglądarki
  // (np. Chrome 154) zwracają z window.scrollTo obietnicę — React próbował ją wywołać przy następnym przejściu
  // i cała strona znikała (biały ekran do odświeżenia).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Błąd strony zamiast białego ekranu pokazuje komunikat; przejście na inny adres próbuje od nowa.
function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageErrorBoundary>
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Header />
          <DemoBanner />
          <main className="flex-1">
            {/* Na domenie ligi podstrony pokazują dane Genius Sports, poza nią nasze dane testowe. */}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/aktualnosci" element={<NewsPage />} />
              <Route path="/aktualnosci/:slug" element={<NewsArticlePage />} />
              <Route path="/regulamin" element={<RegulationsPage />} />
              <Route path="/tabele" element={<BySource genius={<GeniusListPage title="Tabele" icon={icons.table} path="standings" />} mock={<TablesPage />} />} />
              <Route
                path="/terminarz"
                element={<BySource genius={<GeniusListPage title="Terminarz" icon={icons.calendar} path="schedule" showMatchFilter />} mock={<SchedulePage />} />}
              />
              <Route path="/druzyny" element={<BySource genius={<GeniusListPage title="Drużyny" icon={icons.teams} path="teams" />} mock={<TeamsPage />} />} />
              <Route path="/druzyny/:id" element={<BySource genius={<GeniusTeamPage />} mock={<TeamPage />} />} />
              <Route path="/zawodnicy" element={<BySource genius={<GeniusPlayersPage />} mock={<PlayersPage />} />} />
              <Route path="/zawodnicy/:id" element={<BySource genius={<GeniusPlayerPage />} mock={<PlayerPage />} />} />
              <Route path="/statystyki" element={<StatisticsPage />} />
              <Route path="/statystyki/:section" element={<StatisticsPage />} />
              <Route path="/genius" element={<GeniusLinkPage />} />
              <Route path="/mecze/:id" element={<GeniusMatchPage />} />
              {SnapshotCrawler && (
                <Route
                  path="/__snapshot"
                  element={
                    <Suspense>
                      <SnapshotCrawler />
                    </Suspense>
                  }
                />
              )}
              <Route path="*" element={<Placeholder title="Nie znaleziono strony" />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </PageErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
