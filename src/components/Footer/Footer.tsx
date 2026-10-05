import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      {/* Belka partnera danych, jak na dalk.pl: statystyki ligi prowadzone są w systemie Genius Sports. */}
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 sm:flex-row sm:justify-center sm:gap-6 sm:px-6 lg:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Partner danych</span>
        <a
          href="https://www.geniussports.com/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900 transition hover:text-orange-600"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-700 text-xs font-bold text-white" aria-hidden="true">
            GS
          </span>
          genius sports
        </a>
        <Link to="/statystyki" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          Oficjalne statystyki →
        </Link>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Liga koszykówki amatorskiej</div>
    </footer>
  );
}

export default Footer;
