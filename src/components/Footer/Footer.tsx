// Belka partnerów, jak na dalk.pl: partner danych (statystyki ligi prowadzone są w systemie Genius Sports)
// i patron medialny.
function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-6 sm:flex-row sm:justify-center sm:gap-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
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
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Patron medialny</span>
          <a href="https://strefabasketu.pl" target="_blank" rel="noreferrer" className="transition hover:opacity-80">
            {/* Logo z dalk.pl; ciemny napis na przezroczystym tle, więc w trybie ciemnym dostaje białe podłoże. */}
            <img
              src="https://dalk.pl/images/PARTNERZY/logo-strefabasketu-_pl.png"
              alt="Strefa Basketu.pl"
              width={80}
              height={80}
              className="h-20 w-20 rounded-lg dark:bg-[#fff]"
            />
          </a>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Liga koszykówki amatorskiej</div>
    </footer>
  );
}

export default Footer;
