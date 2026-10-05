import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from './components/Header/Header';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';

const placeholderPages = [
  { path: '/tabele', title: 'Tabele' },
  { path: '/terminarz', title: 'Terminarz' },
  { path: '/druzyny', title: 'Drużyny' },
  { path: '/zawodnicy', title: 'Zawodnicy' },
  { path: '/statystyki', title: 'Statystyki' },
  { path: '/regulamin', title: 'Regulamin' },
  { path: '/rejestracja', title: 'Rejestracja zespołu' },
];

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            {placeholderPages.map((page) => (
              <Route key={page.path} path={page.path} element={<Placeholder title={page.title} />} />
            ))}
            <Route path="*" element={<Placeholder title="Nie znaleziono strony" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
