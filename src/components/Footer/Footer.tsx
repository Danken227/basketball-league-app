import client from '@client/client';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../data/siteContent';

// Belka partnerów ligi (konfiguracja klienta, np. partner danych i patron medialny). Na dole wejście do panelu
// administratora.
function Footer() {
  const admin = useAdmin();
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-6 sm:flex-row sm:justify-center sm:gap-12 sm:px-6 lg:px-8">
        {client.partners.map((partner) => (
          <div key={partner.href} className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{partner.label}</span>
            {/* Loga mają zwykle ciemne napisy na przezroczystym tle, więc w trybie ciemnym dostają białe podłoże
                (klasy w konfiguracji klienta; logo z dużym marginesem przycina ramka). */}
            <a href={partner.href} target="_blank" rel="noreferrer" className={`${partner.frameClassName ?? ''} transition hover:opacity-80`}>
              <img src={partner.logo} alt={partner.name} width={partner.width} height={partner.height} className={partner.imgClassName} />
            </a>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
        <span>
          © {new Date().getFullYear()} {client.brand.copyrightName}
        </span>
        <Link to="/admin" className="inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-orange-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
              clipRule="evenodd"
            />
          </svg>
          {admin ? 'Panel administratora' : 'Logowanie administratora'}
        </Link>
      </div>
    </footer>
  );
}

export default Footer;
