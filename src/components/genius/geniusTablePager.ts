// Stronicowanie długich tabel Genius (np. statystyki zawodników mają ponad 100 wierszy) i list zawodników
// (pełna baza ligi to ponad 6 tys. nazwisk). Genius podaje całość naraz, więc dzielimy ją na strony po stronie
// przeglądarki: pozycje spoza bieżącej strony dostają klasę genius-row-hidden, a pod tabelą (listą) stoi pasek
// z wyborem liczby pozycji i zmianą strony. Stan (strona, liczba pozycji) trzymamy w atrybutach tabeli (listy),
// więc przetrwa sortowanie kolumn przez Genius (sortowanie przestawia wiersze, a obserwator treści w GeniusEmbed
// wywołuje wtedy ponownie applyPagination).

export const PAGE_SIZES = [10, 20, 50, 100];
// Lista zawodników to siatka kilku nazwisk w wierszu, więc strony są dłuższe.
const LIST_PAGE_SIZES = [50, 100, 200];

const pagerHtml = (sizes: number[]) => `
  <label class="genius-pager-size">Pozycji na stronie
    <select data-pager-size>
      ${sizes.map((size) => `<option value="${size}">${size}</option>`).join('')}
      <option value="0">Wszystkie</option>
    </select>
  </label>
  <span class="genius-pager-info" data-pager-info></span>
  <span class="genius-pager-nav">
    <button type="button" data-pager-go="first" aria-label="Pierwsza strona">«</button>
    <button type="button" data-pager-go="prev" aria-label="Poprzednia strona">‹</button>
    <span data-pager-page></span>
    <button type="button" data-pager-go="next" aria-label="Następna strona">›</button>
    <button type="button" data-pager-go="last" aria-label="Ostatnia strona">»</button>
  </span>`;

// Zmiana tekstu tylko wtedy, gdy jest inny — każda zmiana treści wywołuje obserwator, więc bez tego byłaby pętla.
function setText(element: Element | null, text: string) {
  if (element && element.textContent !== text) element.textContent = text;
}

// Element dzielony na strony: tabela (wiersze) albo lista zawodników (bloki .playerblock). Pasek stoi za
// elementem `anchor` (tabela bywa opakowana w .table-wrap).
interface Pageable {
  holder: HTMLElement;
  anchor: Element;
  // Wszystkie pozycje i te, które przeszły filtr (wyszukiwarka, litera) — tylko one idą na strony.
  items: HTMLElement[];
  shown: HTMLElement[];
  sizes: number[];
}

function pageables(root: HTMLElement): Pageable[] {
  const tables = [...root.querySelectorAll<HTMLTableElement>('table')].map((table) => {
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
    return { holder: table, anchor: table.closest('.table-wrap') ?? table, items: rows, shown: rows, sizes: PAGE_SIZES };
  });
  const lists = new Set([...root.querySelectorAll('.playerblock')].map((block) => block.parentElement!));
  return [
    ...tables,
    ...[...lists].map((list) => {
      const blocks = [...list.children].filter((child): child is HTMLElement => child.classList.contains('playerblock'));
      return { holder: list, anchor: list, items: blocks, shown: blocks.filter((block) => !block.classList.contains('genius-hidden')), sizes: LIST_PAGE_SIZES };
    }),
  ];
}

function pagerFor(anchor: Element) {
  const next = anchor.nextElementSibling;
  return next?.classList.contains('genius-pager') ? (next as HTMLElement) : undefined;
}

export function applyPagination(root: HTMLElement, defaultSize: number) {
  pageables(root).forEach(({ holder, anchor, items, shown, sizes }) => {
    holder.dataset.pageable = '';
    let pager = pagerFor(anchor);
    // Krótkie tabele i listy (np. drużyny jednej ligi) zostają bez paska.
    if (shown.length <= sizes[0]) {
      items.forEach((item) => item.classList.remove('genius-row-hidden'));
      pager?.remove();
      return;
    }
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'genius-pager';
      pager.innerHTML = pagerHtml(sizes);
      anchor.after(pager);
    }

    // Inna liczba pozycji (zmiana filtra) — od pierwszej strony.
    if (holder.dataset.pageCount !== String(shown.length)) {
      holder.dataset.pageCount = String(shown.length);
      holder.dataset.page = '1';
    }
    const size = Number(holder.dataset.pageSize ?? (sizes.includes(defaultSize) ? defaultSize : sizes[0]));
    const pages = size > 0 ? Math.ceil(shown.length / size) : 1;
    const page = Math.min(Math.max(Number(holder.dataset.page ?? 1), 1), pages);
    holder.dataset.page = String(page);
    const from = size > 0 ? (page - 1) * size : 0;
    const to = size > 0 ? Math.min(from + size, shown.length) : shown.length;
    const visible = new Set(shown.slice(from, to));
    items.forEach((item) => {
      const hidden = !visible.has(item);
      if (item.classList.contains('genius-row-hidden') !== hidden) item.classList.toggle('genius-row-hidden', hidden);
    });

    const select = pager.querySelector<HTMLSelectElement>('[data-pager-size]');
    if (select && select.value !== String(size)) select.value = String(size);
    setText(pager.querySelector('[data-pager-info]'), `${from + 1}–${to} z ${shown.length}`);
    setText(pager.querySelector('[data-pager-page]'), `Strona ${page} z ${pages}`);
    pager.querySelectorAll<HTMLButtonElement>('[data-pager-go]').forEach((button) => {
      const back = button.dataset.pagerGo === 'first' || button.dataset.pagerGo === 'prev';
      const disabled = back ? page <= 1 : page >= pages;
      if (button.disabled !== disabled) button.disabled = disabled;
    });
    if (pager.classList.contains('genius-pager--single') !== pages <= 1) pager.classList.toggle('genius-pager--single', pages <= 1);
  });
}

function holderOf(pager: Element) {
  const anchor = pager.previousElementSibling as HTMLElement | null;
  return anchor?.matches('[data-pageable]') ? anchor : anchor?.querySelector<HTMLElement>('[data-pageable]');
}

// Obsługa paska (kliknięcia i zmiana liczby pozycji); zwraca true, gdy zdarzenie dotyczyło paska.
export function handlePagerEvent(event: Event, root: HTMLElement, defaultSize: number): boolean {
  const target = event.target as HTMLElement;
  // Sortowanie (kliknięcie w nagłówek kolumny) wraca na pierwszą stronę, żeby od razu widać było czołówkę.
  const sortedTable = event.type === 'click' ? target.closest('thead')?.closest('table') : null;
  if (sortedTable && root.contains(sortedTable)) {
    sortedTable.dataset.page = '1';
    applyPagination(root, defaultSize);
    return true;
  }
  const pager = target.closest('.genius-pager');
  const holder = pager && holderOf(pager);
  if (!holder) return false;

  if (event.type === 'change' && target.matches('[data-pager-size]')) {
    holder.dataset.pageSize = (target as HTMLSelectElement).value;
    holder.dataset.page = '1';
  } else if (event.type === 'click') {
    const go = target.closest<HTMLElement>('[data-pager-go]')?.dataset.pagerGo;
    if (!go) return false;
    const page = Number(holder.dataset.page ?? 1);
    holder.dataset.page = String({ first: 1, prev: page - 1, next: page + 1, last: Number.MAX_SAFE_INTEGER }[go] ?? page);
  } else {
    return false;
  }
  applyPagination(root, defaultSize);
  // Strona najczęściej zmienia się z paska pod tabelą — przewijamy do początku tabeli (listy).
  if (event.type === 'click') {
    const top = holder.getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top: top - 96, behavior: 'smooth' });
  }
  return true;
}
