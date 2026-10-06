import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { geniusCacheKey, readGeniusCache, writeGeniusCache } from './geniusCache';
import { GENIUS_EMBED_URL, isGeniusDomain, mapGeniusPath } from './geniusConfig';
import './genius.css';

interface GeniusEmbedProps {
  // Ścieżka strony Genius, np. "/competition/49970/standings".
  page: string;
  // Pokaż tylko jeden blok strony (np. jedną kategorię liderów).
  blockDisplay?: string;
  showSubMenus?: boolean;
  showMatchFilter?: boolean;
  // Nagłówek strony Genius (np. nazwa i logo drużyny).
  showTitle?: boolean;
  // Wariant do wąskich kolumn (strona główna).
  compact?: boolean;
  // Ukrywa elementy (np. ".playerblock"), których tekst nie zawiera frazy — wyszukiwarka zawodników.
  textFilter?: { selector: string; query: string };
  // Wywoływane po wczytaniu (i każdej zmianie) treści Genius — np. do odczytania nazwy zawodnika.
  onContent?: (root: HTMLElement) => void;
  // Pozwala obsłużyć kliknięcie w link na miejscu (np. zmiana grupy w tabeli na stronie głównej).
  // Zwraca true, gdy kliknięcie zostało obsłużone i nie trzeba przechodzić pod adres linku.
  onLinkClick?: (href: string) => boolean;
  className?: string;
}

// Genius buduje linki na dwa sposoby: na zarejestrowanej domenie jako "<adres>?&WHurl=/competition/..",
// a w pozostałych przypadkach wprost do swoich stron (https://hosted.dcd.shared.geniussports.com/DALK/en/competition/..).
const hostedPrefix = /^https:\/\/hosted\.dcd\.shared\.geniussports\.com\/DALK\/[a-z]{2}(\/.*)$/;

function geniusLinkPath(href: string): string | undefined {
  if (href.includes('WHurl=')) return decodeURIComponent(href.split('WHurl=')[1] ?? '');
  return href.match(hostedPrefix)?.[1];
}

const loadingHtml = '<p class="genius-status">Wczytywanie danych Genius Sports…</p>';

// Serwer Genius zwraca skrypt osadzenia zależny od domeny strony, a przeglądarka zapamiętuje go po samym adresie.
// Kopia pobrana kiedyś z innej domeny (np. localhost) blokowałaby wtedy osadzenie. Znacznik zmieniany przy każdym
// wczytaniu strony trafia do nazwy konfiguracji, a więc i do adresu skryptu — skrypt jest zawsze świeży.
const pageLoadTag = Date.now().toString(36);

// Skrypt Genius pobiera jQuery dopiero, gdy sam się wczyta (i tylko gdy strona go nie ma). Pobieramy je od razu,
// równolegle ze skryptem. Znacznik window._loadingjq sprawia, że skrypt Genius nie dokleja drugiej kopii,
// tylko czeka na naszą (ta sama wersja, której używa Genius).
const JQUERY_URL = 'https://code.jquery.com/jquery-3.2.1.min.js';

function preloadJQuery() {
  if (window.jQuery || window._loadingjq) return;
  window._loadingjq = 1;
  const script = document.createElement('script');
  script.async = true;
  script.src = JQUERY_URL;
  document.head.appendChild(script);
}


function GeniusEmbed({
  page,
  blockDisplay,
  showSubMenus = true,
  showMatchFilter = true,
  showTitle = false,
  compact,
  textFilter,
  onContent,
  onLinkClick,
  className = '',
}: GeniusEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Najnowszy callback w refie, żeby jego zmiana nie restartowała obserwatora treści.
  const onContentRef = useRef(onContent);
  useEffect(() => {
    onContentRef.current = onContent;
  });
  const navigate = useNavigate();
  const allowed = isGeniusDomain();
  // Każde osadzenie ma własną zmienną konfiguracji i element, więc kilka może działać na jednej stronie.
  const instance = useId().replace(/[^a-zA-Z0-9]/g, '');
  const placeholderId = `spil_w_h_${instance}`;
  const configName = `spilWHH_${instance}${pageLoadTag}` as const;
  const filterSelector = textFilter?.selector;
  const filterQuery = textFilter?.query ?? '';
  const cacheKey = geniusCacheKey({ page, blockDisplay, showSubMenus, showMatchFilter, showTitle });
  const expectedCompetition = page.match(/^\/competition\/(\d+)\//)?.[1];

  useEffect(() => {
    const placeholder = ref.current;
    if (!allowed || !placeholder) return;
    preloadJQuery();
    // Zapamiętana kopia (oznaczona klasą genius-cached) albo komunikat o wczytywaniu.
    const cached = readGeniusCache(cacheKey);
    placeholder.innerHTML = cached ? `<div class="genius-cached">${cached}</div>` : loadingHtml;

    window[configName] = {
      placeHolder: placeholderId,
      page,
      raw: true,
      // Linki Genius kierujemy na /genius, a potem przepisujemy je na nasze adresy (poniżej).
      internalURL: `${window.location.origin}/genius`,
      showNavBar: false,
      showLinks: true,
      showTitle,
      showSubMenus,
      showLanguageChooser: false,
      // Rozgrywki wybieramy naszymi filtrami.
      showCompetitionChooser: false,
      showMatchFilter,
      // Wygląd nadajemy własnym CSS (genius.css), zostawiamy skrypty Genius (sortowanie, zakładki).
      rawEnableCSS: false,
      rawEnableJS: true,
      blockDisplay: blockDisplay ?? '',
      language: 'en',
    };

    // Skrypt czyta konfigurację w chwili wykonania, więc przy każdej zmianie wstawiamy go ponownie
    // (przeglądarka bierze go z pamięci podręcznej). Nazwa zmiennej idzie po "|", jak na dalk.pl.
    const script = document.createElement('script');
    script.async = true;
    script.src = `${GENIUS_EMBED_URL}|${configName}`;
    // Wstawiamy z opóźnieniem: React w trybie deweloperskim uruchamia efekt dwa razy, a pierwsze uruchomienie
    // jest od razu sprzątane — wtedy jego skrypt nie trafia na stronę i treść nie wstawia się podwójnie.
    const insert = window.setTimeout(() => document.body.appendChild(script), 0);

    // Gdy Genius nie zarejestrował domeny, serwer zwraca stronę "invalidreferrer" (404) i nic się nie wstawia.
    const timeout = window.setTimeout(() => {
      if (placeholder.children.length > 1 || !placeholder.querySelector('.genius-status')) return;
      placeholder.innerHTML = `<p class="genius-status"><strong>Genius Sports nie zwrócił danych.</strong><br>
        Domena ${window.location.host} nie jest zarejestrowana dla organizacji DALK w Genius Sports
        albo serwis jest chwilowo niedostępny.</p>`;
    }, 12000);

    return () => {
      window.clearTimeout(insert);
      window.clearTimeout(timeout);
      script.remove();
      delete window[configName];
      placeholder.innerHTML = '';
    };
  }, [allowed, page, blockDisplay, showSubMenus, showMatchFilter, showTitle, placeholderId, configName, cacheKey]);

  // Przepisuje linki Genius (".../genius?&WHurl=/competition/..") na nasze adresy i stosuje filtr tekstowy.
  // Treść dochodzi asynchronicznie, więc obserwujemy zmiany w elemencie.
  useEffect(() => {
    const placeholder = ref.current;
    if (!allowed || !placeholder) return;

    let saveTimer: number | undefined;

    const apply = () => {
      // Genius dokleja treść obok komunikatu o wczytywaniu (albo zapamiętanej kopii), więc po jej nadejściu
      // usuwamy komunikat i kopię.
      const fresh = [...placeholder.children].some((child) => !child.classList.contains('genius-status') && !child.classList.contains('genius-cached'));
      const status = placeholder.querySelector(':scope > .genius-status');
      if (status && placeholder.children.length > 1) status.remove();
      if (fresh) placeholder.querySelector(':scope > .genius-cached')?.remove();
      // Razem z HTML Genius wstawia blok kolorów swojego motywu; zastępują go nasze style (genius.css).
      placeholder.querySelectorAll('style').forEach((style) => style.remove());
      // Nagłówek drużyny przychodzi z pustą nazwą, ale logo ma ją w opisie (alt) — uzupełniamy.
      const teamTitle = placeholder.querySelector('.team-header .team-title');
      const teamLogo = placeholder.querySelector<HTMLImageElement>('.team-header img');
      if (teamTitle && !teamTitle.textContent?.trim() && teamLogo?.alt) teamTitle.textContent = teamLogo.alt;
      placeholder.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
        const target = geniusLinkPath(link.getAttribute('href')!);
        if (target !== undefined) link.setAttribute('href', mapGeniusPath(target));
      });
      if (filterSelector) {
        const query = filterQuery.trim().toLowerCase();
        placeholder.querySelectorAll<HTMLElement>(filterSelector).forEach((item) => {
          item.classList.toggle('genius-hidden', Boolean(query) && !item.textContent?.toLowerCase().includes(query));
        });
      }
      if (placeholder.querySelector('.hs-embed')) onContentRef.current?.(placeholder);
      // Świeżą treść (już po naszych poprawkach) zapamiętujemy, gdy przestanie się zmieniać — ale tylko gdy dotyczy
      // tych rozgrywek, o które prosiliśmy (klasa _comp_<numer>). Przy kilku osadzeniach wczytywanych naraz
      // skrypty Genius potrafią pomylić miejsce wstawienia, a taka treść nie może trafić do pamięci pod złym kluczem.
      const freshRoot = [...placeholder.children].find((child) => child.classList.contains('hs-embed'));
      const compClass = freshRoot && [...freshRoot.classList].find((c) => c.startsWith('_comp_'));
      const matchesPage = !expectedCompetition || !compClass || compClass === `_comp_${expectedCompetition}`;
      if (fresh && freshRoot && matchesPage) {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => writeGeniusCache(cacheKey, placeholder.innerHTML), 500);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(placeholder, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(saveTimer);
    };
  }, [allowed, filterSelector, filterQuery, cacheKey, expectedCompetition]);

  // Kliknięcia w przepisane linki obsługuje router, bez przeładowania strony.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!href || !href.startsWith('/') || link!.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (onLinkClick?.(href)) return;
    navigate(href);
  };

  if (!allowed) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Dane Genius Sports są dostępne tylko na domenie ligi.</p>
        <p className="mt-2">
          Genius Sports wyświetla statystyki DALK wyłącznie na domenach zarejestrowanych dla ligi (np.{' '}
          <code className="rounded bg-slate-100 px-1">dalk.pl</code>). Na tej domenie (
          <code className="rounded bg-slate-100 px-1">{window.location.hostname}</code>) osadzenie zwróciłoby tylko komunikat o niedozwolonej domenie.
        </p>
      </div>
    );
  }

  return (
    <div
      id={placeholderId}
      ref={ref}
      onClick={onClick}
      className={`genius-embed ${compact ? 'genius-compact' : ''} ${className} min-h-24 overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200`}
    />
  );
}

export default GeniusEmbed;
