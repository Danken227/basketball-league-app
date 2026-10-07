import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

interface NavLinkItem {
  label: string;
  path: string;
}

interface NavGroupItem {
  label: string;
  // Wspólny początek adresów podstron — po nim podświetlamy pozycję w menu.
  basePath: string;
  children: NavLinkItem[];
}

const navItems: (NavLinkItem | NavGroupItem)[] = [
  { label: 'Home', path: '/' },
  { label: 'Tabele', path: '/tabele' },
  { label: 'Terminarz', path: '/terminarz' },
  { label: 'Drużyny', path: '/druzyny' },
  { label: 'Zawodnicy', path: '/zawodnicy' },
  {
    label: 'Statystyki',
    basePath: '/statystyki',
    children: [
      { label: 'Statystyki drużyn', path: '/statystyki/druzyny' },
      { label: 'Statystyki zawodników', path: '/statystyki/zawodnicy' },
      { label: 'Liderzy', path: '/statystyki/liderzy' },
      { label: 'Rekordy', path: '/statystyki/rekordy' },
    ],
  },
  { label: 'Regulamin', path: '/regulamin' },
];

const youtubeUrl = 'https://www.youtube.com/@dalk';

const itemClass = (active: boolean) =>
  `rounded-full px-3 py-2 text-sm transition ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`;

// Pozycja menu z rozwijaną listą podstron. Na komputerze lista wysuwa się pod przyciskiem,
// w menu mobilnym rozwija się w miejscu. Zamyka się po wyborze, kliknięciu obok i klawiszem Esc.
function NavDropdown({ item, onNavigate }: { item: NavGroupItem; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const active = pathname.startsWith(item.basePath);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-1 ${itemClass(active)}`}
      >
        {item.label}
        <svg className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-3 lg:absolute lg:left-0 lg:top-full lg:z-40 lg:mt-2 lg:min-w-56 lg:rounded-xl lg:bg-slate-900 lg:p-2 lg:shadow-xl lg:ring-1 lg:ring-white/10">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              onClick={() => {
                setOpen(false);
                onNavigate();
              }}
              className={({ isActive }) => `block whitespace-nowrap ${itemClass(isActive)} lg:rounded-lg`}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="keep-dark sticky top-0 z-30 bg-slate-950 text-slate-50 shadow-lg shadow-slate-900/20">
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
          {navItems.map((item) =>
            'children' in item ? (
              <NavDropdown key={item.basePath} item={item} onNavigate={() => setOpen(false)} />
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => itemClass(isActive)}
              >
                {item.label}
              </NavLink>
            ),
          )}
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
        {/* Na telefonie obok przycisku menu, na komputerze na końcu menu (prawy górny róg). */}
        <ThemeToggle />
      </div>
    </header>
  );
}

export default Header;
