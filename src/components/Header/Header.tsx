import './Header.css';

const navItems = [
  {
    label: 'Aktualności',
    path: '/news',
  },
  {
    label: 'Drużyny',
    path: '/teams',
  },
  {
    label: 'Terminarz',
    path: '/schedule',
  },
  {
    label: 'Statystyki',
    path: '/stats',
  },
  {
    label: 'Zawodnicy',
    path: '/players',
  },
];

function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#">
          <span className="site-header__logo">B</span>
          <span>Basketball League</span>
        </a>

        <nav className="site-header__nav" aria-label="Główna nawigacja">
          {navItems.map((item) => (
            <a key={item.path} className="site-header__link" href={item.path}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-header__actions">
          <a className="site-header__button site-header__button--ghost" href="#">
            Zaloguj się
          </a>
          <a className="site-header__button" href="#">
            Dołącz do ligi
          </a>
        </div>
      </div>
    </header>
  );
}

export default Header;