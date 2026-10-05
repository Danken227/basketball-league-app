import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { icons } from './components/common/icons';
import Footer from './components/Footer/Footer';
import BySource from './components/genius/BySource';
import Header from './components/Header/Header';
import GeniusEntityPage from './pages/genius/GeniusEntityPage';
import GeniusLinkPage from './pages/genius/GeniusLinkPage';
import GeniusListPage from './pages/genius/GeniusListPage';
import GeniusPlayersPage from './pages/genius/GeniusPlayersPage';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';
import PlayerPage from './pages/PlayerPage';
import PlayersPage from './pages/PlayersPage';
import SchedulePage from './pages/SchedulePage';
import StatisticsPage from './pages/StatisticsPage';
import TablesPage from './pages/TablesPage';
import TeamPage from './pages/TeamPage';
import TeamsPage from './pages/TeamsPage';

const placeholderPages = [
  { path: '/regulamin', title: 'Regulamin' },
  { path: '/rejestracja', title: 'Rejestracja zespołu' },
];

// Po przejściu na inną stronę (np. z linku w tabeli) zaczynamy od góry; zmiana filtrów w adresie nie przewija.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <main className="flex-1">
          {/* Na domenie ligi podstrony pokazują dane Genius Sports, poza nią nasze dane testowe. */}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tabele" element={<BySource genius={<GeniusListPage title="Tabele" icon={icons.table} path="standings" />} mock={<TablesPage />} />} />
            <Route
              path="/terminarz"
              element={<BySource genius={<GeniusListPage title="Terminarz" icon={icons.calendar} path="schedule" showMatchFilter />} mock={<SchedulePage />} />}
            />
            <Route path="/druzyny" element={<BySource genius={<GeniusListPage title="Drużyny" icon={icons.teams} path="teams" />} mock={<TeamsPage />} />} />
            <Route path="/druzyny/:id" element={<BySource genius={<GeniusEntityPage kind="team" />} mock={<TeamPage />} />} />
            <Route path="/zawodnicy" element={<BySource genius={<GeniusPlayersPage />} mock={<PlayersPage />} />} />
            <Route path="/zawodnicy/:id" element={<BySource genius={<GeniusEntityPage kind="person" />} mock={<PlayerPage />} />} />
            <Route path="/statystyki" element={<StatisticsPage />} />
            <Route path="/statystyki/:section" element={<StatisticsPage />} />
            <Route path="/genius" element={<GeniusLinkPage />} />
            {placeholderPages.map((page) => (
              <Route key={page.path} path={page.path} element={<Placeholder title={page.title} />} />
            ))}
            <Route path="*" element={<Placeholder title="Nie znaleziono strony" />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
