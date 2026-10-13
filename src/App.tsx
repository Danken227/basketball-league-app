import client from '@client/client';
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
import StatisticsPage from './pages/StatisticsPage';

// Strony rzadko odwiedzane (panel administratora, regulamin) i strony danych testowych (tylko poza domeną ligi)
// wczytujemy dopiero przy wejściu na nie — nie powiększają kodu pobieranego przy pierwszym wejściu.
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NewsPreviewPage = lazy(() => import('./pages/NewsPreviewPage'));
const RegulationsPage = lazy(() => import('./pages/RegulationsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));

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

// Licznik odwiedzin (zakładka "Odwiedziny" w panelu administratora): każda podstrona to wyświetlenie, pierwsza
// w karcie przeglądarki — także wizyta. Bez ciasteczek; panel administratora i zbieranie migawki nie są liczone.
function VisitCounter() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/__')) return;
    let visit = false;
    try {
      visit = !sessionStorage.getItem(`${client.storagePrefix}-visit`);
      sessionStorage.setItem(`${client.storagePrefix}-visit`, '1');
    } catch {
      // Zablokowany storage — liczymy samo wyświetlenie.
    }
    fetch('/api/admin?action=hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visit }),
      keepalive: true,
    }).catch(() => undefined);
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
      <VisitCounter />
      <PageErrorBoundary>
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Header />
          <DemoBanner />
          {/* Co najmniej wysokość ekranu: stopka zaczyna poza widokiem i nie zjeżdża w dół, gdy treść się wczyta. */}
          <main className="min-h-screen flex-1">
            {/* Na domenie ligi podstrony pokazują dane Genius Sports, poza nią nasze dane testowe. */}
            <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">Wczytywanie…</p>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/aktualnosci" element={<NewsPage />} />
              <Route path="/aktualnosci/:slug" element={<NewsArticlePage />} />
              <Route path="/regulamin" element={<RegulationsPage />} />
              <Route path="/kontakt" element={<ContactPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/podglad" element={<NewsPreviewPage />} />
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
            </Suspense>
          </main>
          <Footer />
        </div>
      </PageErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
