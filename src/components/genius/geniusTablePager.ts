// Stronicowanie długich tabel Genius (np. statystyki zawodników mają ponad 100 wierszy).
// Genius podaje całą tabelę naraz, więc dzielimy ją na strony po stronie przeglądarki: wiersze spoza bieżącej
// strony dostają klasę genius-row-hidden, a pod tabelą stoi pasek z wyborem liczby pozycji i zmianą strony.
// Stan (strona, liczba pozycji) trzymamy w atrybutach tabeli, więc przetrwa sortowanie kolumn przez Genius
// (sortowanie przestawia wiersze, a obserwator treści w GeniusEmbed wywołuje wtedy ponownie applyPagination).

export const PAGE_SIZES = [10, 20, 50, 100];

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

function pagerFor(table: HTMLTableElement) {
  const wrap = table.closest('.table-wrap') ?? table;
  const next = wrap.nextElementSibling;
  return next?.classList.contains('genius-pager') ? (next as HTMLElement) : undefined;
}

export function applyPagination(root: HTMLElement, defaultSize: number) {
  root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
    let pager = pagerFor(table);
    // Krótkie tabele (np. drużyny jednej ligi) zostają bez paska.
    if (rows.length <= PAGE_SIZES[0]) {
      rows.forEach((row) => row.classList.remove('genius-row-hidden'));
      pager?.remove();
      return;
    }
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'genius-pager';
      pager.innerHTML = pagerHtml(PAGE_SIZES);
      (table.closest('.table-wrap') ?? table).after(pager);
    }

    const size = Number(table.dataset.pageSize ?? defaultSize);
    const pages = size > 0 ? Math.ceil(rows.length / size) : 1;
    const page = Math.min(Math.max(Number(table.dataset.page ?? 1), 1), pages);
    table.dataset.page = String(page);
    const from = size > 0 ? (page - 1) * size : 0;
    const to = size > 0 ? Math.min(from + size, rows.length) : rows.length;
    rows.forEach((row, index) => row.classList.toggle('genius-row-hidden', index < from || index >= to));

    const select = pager.querySelector<HTMLSelectElement>('[data-pager-size]');
    if (select && select.value !== String(size)) select.value = String(size);
    setText(pager.querySelector('[data-pager-info]'), `${from + 1}–${to} z ${rows.length}`);
    setText(pager.querySelector('[data-pager-page]'), `Strona ${page} z ${pages}`);
    pager.querySelectorAll<HTMLButtonElement>('[data-pager-go]').forEach((button) => {
      const back = button.dataset.pagerGo === 'first' || button.dataset.pagerGo === 'prev';
      button.disabled = back ? page <= 1 : page >= pages;
    });
    pager.classList.toggle('genius-pager--single', pages <= 1);
  });
}

function tableOf(pager: Element) {
  return pager.previousElementSibling?.querySelector('table') ?? (pager.previousElementSibling as HTMLTableElement | null);
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
  const table = pager && tableOf(pager);
  if (!table || !(table instanceof HTMLTableElement)) return false;

  if (event.type === 'change' && target.matches('[data-pager-size]')) {
    table.dataset.pageSize = (target as HTMLSelectElement).value;
    table.dataset.page = '1';
  } else if (event.type === 'click') {
    const go = target.closest<HTMLElement>('[data-pager-go]')?.dataset.pagerGo;
    if (!go) return false;
    const page = Number(table.dataset.page ?? 1);
    table.dataset.page = String({ first: 1, prev: page - 1, next: page + 1, last: Number.MAX_SAFE_INTEGER }[go] ?? page);
  } else {
    return false;
  }
  applyPagination(root, defaultSize);
  // Strona najczęściej zmienia się z paska pod tabelą — przewijamy do początku tabeli.
  if (event.type === 'click') {
    const top = table.getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top: top - 96, behavior: 'smooth' });
  }
  return true;
}
