import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Tabele', path: '/tabele' },
  { label: 'Terminarz', path: '/terminarz' },
  { label: 'Drużyny', path: '/druzyny' },
  { label: 'Zawodnicy', path: '/zawodnicy' },
  { label: 'Statystyki', path: '/statystyki' },
  { label: 'Regulamin', path: '/regulamin' },
];

const youtubeUrl = 'https://www.youtube.com/@dalk';

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-950 text-slate-50 shadow-lg shadow-slate-900/20">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex shrink-0 items-center gap-3 font-semibold text-white" onClick={() => setOpen(false)}>
          <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-orange-400 bg-gradient-to-br from-orange-500 to-red-600 text-xs font-black tracking-tight text-white">
            LKA
          </span>
          <span className="hidden text-sm leading-tight sm:block">
            Liga koszykówki
            <br />
            <span className="text-slate-400">amatorskiej</span>
          </span>
        </NavLink>

        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
          aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        <nav
          aria-label="Główna nawigacja"
          className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 border-t border-white/10 bg-slate-950 px-4 pb-4 pt-2 lg:static lg:ml-auto lg:flex lg:flex-row lg:items-center lg:border-0 lg:p-0`}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-full px-3 py-2 text-sm transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z" />
            </svg>
            YouTube
          </a>
          <NavLink
            to="/rejestracja"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-full bg-orange-500 px-4 py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-orange-400 lg:ml-2 lg:mt-0"
          >
            Zgłoś zespół
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
