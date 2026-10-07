import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { geniusCacheKey, readGeniusCache, writeGeniusCache } from './geniusCache';
import { GENIUS_EMBED_URL, geniusSnapshot, isGeniusDomain, mapGeniusPath } from './geniusConfig';
import { installSnapshotScripts, loadSnapshot, SNAPSHOT_DIR, snapshotMissingHtml } from './geniusSnapshot';
import { translateGenius } from './geniusI18n';
import { fillMissingLogos, replaceBrokenLogo } from './geniusLogo';
import { handleSortClick, markSortedColumns } from './geniusTableSort';
import { applyPagination, handlePagerEvent } from './geniusTablePager';
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
  // Ukrywa elementy (np. ".playerblock"), których tekst nie zawiera frazy albo których nazwisko nie zaczyna się
  // od wybranej litery (Genius oznacza je klasą letter_<litera>) — wyszukiwarka i filtr liter zawodników.
  textFilter?: { selector: string; query: string; letter?: string };
  // Wywoływane po wczytaniu (i każdej zmianie) treści Genius — np. do odczytania nazwy zawodnika.
  onContent?: (root: HTMLElement) => void;
  // Pozwala obsłużyć kliknięcie w link na miejscu (np. zmiana grupy w tabeli na stronie głównej).
  // Zwraca true, gdy kliknięcie zostało obsłużone i nie trzeba przechodzić pod adres linku.
  onLinkClick?: (href: string) => boolean;
  className?: string;
  // Wygląd Genius zamiast naszego (strona meczu: shot chart, play by play i nagłówek meczu potrzebują
  // ich arkusza — boisko, znaczniki rzutów, układ). Arkusz jest usuwany po wyjściu ze strony.
  nativeStyle?: boolean;
  // Tabele statystyk: tylko średnie na mecz ("avg") albo tylko wartości sumaryczne ("tot"). Genius pokazuje
  // jedne i drugie naraz, więc ukrywamy kolumny drugiego rodzaju (patrz statColumnKind).
  statsMode?: StatsMode;
  // Długie tabele dzielone na strony po tyle wierszy (z paskiem zmiany strony i liczby pozycji pod tabelą).
  pageSize?: number;
}

export type StatsMode = 'avg' | 'tot';

const GENIUS_STYLESHEETS = 'link[href*="hosted.dcd.shared.geniussports.com/css"], link[href*="font-awesome"], link[data-genius-snapshot]';

// Arkusz Genius zostawiony w <head> zmieniałby wygląd pozostałych stron — usuwamy go, gdy na stronie
// nie ma już osadzenia w ich stylu (Genius doda go ponownie przy następnym).
function removeGeniusStylesheets() {
  window.setTimeout(() => {
    if (!document.querySelector('.genius-native')) document.querySelectorAll(GENIUS_STYLESHEETS).forEach((link) => link.remove());
  }, 0);
}

// W migawce arkusza nie dodaje skrypt Genius — wczytujemy jego kopię (adresy obrazków wskazują serwer Genius).
function addSnapshotStylesheet() {
  if (document.querySelector('link[data-genius-snapshot]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${SNAPSHOT_DIR}/genius.css`;
  link.dataset.geniusSnapshot = '';
  document.head.appendChild(link);
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

// Rodzaj kolumny tabeli statystyk Genius po nagłówku: średnia ("Average ..." w opisie albo skrót kończący się na PG,
// np. PPG, RPG, TOPG), wspólna (procenty, liczba meczów, kolumny tekstowe jak zawodnik czy drużyna) albo suma.
// Ocena z oryginalnych (angielskich) tekstów — tłumaczenie (geniusI18n) zapamiętuje je w atrybutach data-genius-*.
function statColumnKind(th: HTMLElement, table: HTMLTableElement, index: number): StatsMode | 'both' {
  const title = th.dataset.geniusTitle ?? th.getAttribute('title') ?? '';
  const label = (th.dataset.geniusLabel ?? th.textContent ?? '').replace(/\s+/g, '');
  if (/^average/i.test(title) || /PG$/i.test(label)) return 'avg';
  if (/%|percentage/i.test(title + label) || /^(G|GP|GS|Games)$/i.test(label)) return 'both';
  const values = [...table.tBodies].flatMap((body) => [...body.rows]).map((row) => row.cells[index]?.textContent?.trim() ?? '');
  // Bez wartości (np. wiersze jeszcze niewczytane) nie da się ocenić kolumny — zostaje widoczna.
  if (!values.some((value) => value !== '')) return 'both';
  return values.some((value) => value !== '' && !/^[-+]?[\d.,:]+$/.test(value)) ? 'both' : 'tot';
}

function applyStatsMode(root: HTMLElement, mode: StatsMode | undefined) {
  root.querySelectorAll('table').forEach((table) => {
    const headers = [...(table.tHead?.rows[0]?.cells ?? [])];
    if (headers.some((th) => th.colSpan > 1)) return;
    const kinds = headers.map((th, index) => (mode ? statColumnKind(th, table, index) : 'both'));
    // Tabela bez kolumn wybranego rodzaju (np. same średnie) zostaje cała — inaczej zostałaby tylko nazwa.
    const filtered = kinds.includes(mode!);
    headers.forEach((th, index) => {
      const kind = kinds[index];
      const hidden = filtered && kind !== 'both' && kind !== mode;
      th.classList.toggle('genius-col-hidden', hidden);
      for (const row of [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])].flatMap((section) => [...section.rows])) {
        row.cells[index]?.classList.toggle('genius-col-hidden', hidden);
      }
    });
  });
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
  nativeStyle = false,
  statsMode,
  pageSize,
}: GeniusEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Najnowszy callback w refie, żeby jego zmiana nie restartowała obserwatora treści.
  const onContentRef = useRef(onContent);
  useEffect(() => {
    onContentRef.current = onContent;
  });
  const navigate = useNavigate();
  const allowed = isGeniusDomain() || geniusSnapshot;
  // Każde osadzenie ma własną zmienną konfiguracji i element, więc kilka może działać na jednej stronie.
  const instance = useId().replace(/[^a-zA-Z0-9]/g, '');
  const placeholderId = `spil_w_h_${instance}`;
  const configName = `spilWHH_${instance}${pageLoadTag}` as const;
  const filterSelector = textFilter?.selector;
  const filterQuery = textFilter?.query ?? '';
  const filterLetter = textFilter?.letter ?? '';
  const cacheKey = geniusCacheKey({ page, blockDisplay, showSubMenus, showMatchFilter, showTitle });
  const expectedCompetition = page.match(/^\/competition\/(\d+)\//)?.[1];

  // Ponowienie: serwer Genius bywa przeciążony i pod danym adresem potrafi podawać zapamiętaną, pustą odpowiedź.
  // Gdy poprawna treść nie przyjdzie w 6 s, prosimy jeszcze raz z dodatkowym parametrem "r" (inny adres = świeża
  // odpowiedź). Stan dotyczy konkretnej treści (klucza), więc zmiana filtra zaczyna od zwykłego zapytania.
  const [retry, setRetry] = useState<{ key: string; token: number }>();
  const retryToken = retry?.key === cacheKey ? retry.token : undefined;
  const requestPage = retryToken ? `${page}${page.includes('?') ? (page.endsWith('&') ? '' : '&') : '?'}r=${retryToken}&` : page;

  useEffect(() => {
    const placeholder = ref.current;
    if (!allowed || !placeholder) return;

    // Wersja demonstracyjna: treść z migawki zamiast skryptu Genius (na stronie meczu z kopią arkusza Genius).
    if (geniusSnapshot) {
      let active = true;
      placeholder.innerHTML = loadingHtml;
      if (nativeStyle) addSnapshotStylesheet();
      installSnapshotScripts();
      loadSnapshot(cacheKey).then((html) => {
        if (active) placeholder.innerHTML = html ?? snapshotMissingHtml(expectedCompetition);
      });
      return () => {
        active = false;
        placeholder.innerHTML = '';
        if (nativeStyle) removeGeniusStylesheets();
      };
    }

    preloadJQuery();
    // Zapamiętana kopia (oznaczona klasą genius-cached) albo komunikat o wczytywaniu.
    const cached = readGeniusCache(cacheKey);
    placeholder.innerHTML = cached ? `<div class="genius-cached">${cached}</div>` : loadingHtml;

    window[configName] = {
      placeHolder: placeholderId,
      page: requestPage,
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
      rawEnableCSS: nativeStyle,
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

    // Poprawna świeża treść = blok Genius (.hs-embed) spoza zapamiętanej kopii, dla właściwych rozgrywek.
    const hasValidContent = () =>
      [...placeholder.children].some(
        (child) =>
          child.classList.contains('hs-embed') && (!expectedCompetition || !child.className.includes('_comp_') || child.classList.contains(`_comp_${expectedCompetition}`)),
      );

    // Pierwsza próba: po 6 s bez poprawnej treści ponawiamy zapytanie (raz).
    // Po ponowieniu: komunikat o błędzie, ale tylko gdy nie ma czego pokazać (brak zapamiętanej kopii).
    // Komunikat obejmuje też niezarejestrowaną domenę — wtedy serwer zwraca stronę "invalidreferrer" (404).
    const timeout = retryToken
      ? window.setTimeout(() => {
          if (hasValidContent() || placeholder.querySelector('.genius-cached')) return;
          placeholder.innerHTML = `<p class="genius-status"><strong>Genius Sports nie zwrócił danych.</strong><br>
            Serwis jest chwilowo niedostępny albo domena ${window.location.host} nie jest zarejestrowana
            dla organizacji DALK w Genius Sports. Spróbuj odświeżyć stronę za chwilę.</p>`;
        }, 8000)
      : window.setTimeout(() => {
          if (!hasValidContent()) setRetry({ key: cacheKey, token: Date.now() });
        }, 6000);

    return () => {
      window.clearTimeout(insert);
      window.clearTimeout(timeout);
      script.remove();
      delete window[configName];
      placeholder.innerHTML = '';
      if (nativeStyle) removeGeniusStylesheets();
    };
  }, [allowed, requestPage, retryToken, blockDisplay, showSubMenus, showMatchFilter, showTitle, nativeStyle, placeholderId, configName, cacheKey, expectedCompetition]);

  // Przepisuje linki Genius (".../genius?&WHurl=/competition/..") na nasze adresy i stosuje filtr tekstowy.
  // Treść dochodzi asynchronicznie, więc obserwujemy zmiany w elemencie.
  useEffect(() => {
    const placeholder = ref.current;
    if (!allowed || !placeholder) return;

    let saveTimer: number | undefined;

    const apply = () => {
      // Świeża treść jest poprawna tylko wtedy, gdy to blok Genius (.hs-embed) dla rozgrywek, o które prosiliśmy
      // (klasa _comp_<numer>). Przy przeciążeniu Genius potrafi zwrócić pustą stronę, a przy kilku osadzeniach naraz
      // wstawić treść w złe miejsce — wtedy zostawiamy komunikat/zapamiętaną kopię i nic nie zapisujemy.
      const freshRoot = [...placeholder.children].find((child) => child.classList.contains('hs-embed'));
      const compClass = freshRoot && [...freshRoot.classList].find((c) => c.startsWith('_comp_'));
      const valid = Boolean(freshRoot) && (!expectedCompetition || !compClass || compClass === `_comp_${expectedCompetition}`);
      // Genius dokleja treść obok komunikatu o wczytywaniu (albo zapamiętanej kopii), więc po nadejściu
      // poprawnej treści usuwamy komunikat i kopię.
      if (valid) {
        placeholder.querySelector(':scope > .genius-status')?.remove();
        placeholder.querySelector(':scope > .genius-cached')?.remove();
      }
      // Razem z HTML Genius wstawia blok kolorów swojego motywu; zastępują go nasze style (genius.css).
      if (!nativeStyle) placeholder.querySelectorAll('style').forEach((style) => style.remove());
      // Nagłówek drużyny przychodzi z pustą nazwą, ale logo ma ją w opisie (alt) — uzupełniamy.
      const teamTitle = placeholder.querySelector('.team-header .team-title');
      const teamLogo = placeholder.querySelector<HTMLImageElement>('.team-header img');
      if (teamTitle && !teamTitle.textContent?.trim() && teamLogo?.alt) teamTitle.textContent = teamLogo.alt;
      fillMissingLogos(placeholder);
      placeholder.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
        const target = geniusLinkPath(link.getAttribute('href')!);
        if (target !== undefined) link.setAttribute('href', mapGeniusPath(target));
      });
      if (filterSelector) {
        const query = filterQuery.trim().toLowerCase();
        placeholder.querySelectorAll<HTMLElement>(filterSelector).forEach((item) => {
          const textMismatch = Boolean(query) && !item.textContent?.toLowerCase().includes(query);
          const letterMismatch = Boolean(filterLetter) && !item.classList.contains(`letter_${filterLetter}`);
          item.classList.toggle('genius-hidden', textMismatch || letterMismatch);
        });
      }
      translateGenius(placeholder);
      if (statsMode || placeholder.querySelector('.genius-col-hidden')) applyStatsMode(placeholder, statsMode);
      if (pageSize) applyPagination(placeholder, pageSize);
      markSortedColumns(placeholder);
      if (placeholder.querySelector('.hs-embed')) onContentRef.current?.(placeholder);
      // Poprawną świeżą treść (już po naszych poprawkach) zapamiętujemy, gdy przestanie się zmieniać.
      if (valid) {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => writeGeniusCache(cacheKey, placeholder.innerHTML), 500);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(placeholder, { childList: true, subtree: true });
    // Pasek stronicowania to zwykły HTML w treści Genius, więc jego zdarzenia łapiemy na elemencie osadzenia.
    const onPager = (event: Event) => {
      if (pageSize) handlePagerEvent(event, placeholder, pageSize);
    };
    placeholder.addEventListener('click', onPager);
    placeholder.addEventListener('change', onPager);
    // Przed footable (faza przechwytywania): kolumny tekstowe i trzecie kliknięcie (powrót do kolejności z Genius).
    const onSortClick = (event: Event) => {
      if (!handleSortClick(event, geniusSnapshot)) return;
      event.stopPropagation();
      // Zatrzymane zdarzenie nie dotrze do obsługi paska stron — powrót na pierwszą stronę wywołujemy sami.
      if (pageSize) handlePagerEvent(event, placeholder, pageSize);
    };
    placeholder.addEventListener('click', onSortClick, true);
    // Błąd wczytania obrazka nie przechodzi w górę drzewa, więc łapiemy go w fazie przechwytywania.
    placeholder.addEventListener('error', replaceBrokenLogo, true);
    return () => {
      observer.disconnect();
      window.clearTimeout(saveTimer);
      placeholder.removeEventListener('click', onPager);
      placeholder.removeEventListener('change', onPager);
      placeholder.removeEventListener('click', onSortClick, true);
      placeholder.removeEventListener('error', replaceBrokenLogo, true);
    };
  }, [allowed, filterSelector, filterQuery, filterLetter, nativeStyle, statsMode, pageSize, cacheKey, expectedCompetition]);

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
      className={`${nativeStyle ? 'genius-native' : 'genius-embed'} ${compact ? 'genius-compact' : ''} ${className} min-h-24 overflow-x-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200`}
    />
  );
}

export default GeniusEmbed;
