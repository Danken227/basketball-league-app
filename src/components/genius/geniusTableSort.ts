// Sortowanie tabel Genius (footable): oznaczenie posortowanej kolumny, kolumny tekstowe bez sortowania
// i powrót do kolejności z Genius trzecim kliknięciem (rosnąco → malejąco → domyślnie).
// Zmieniamy tu tylko klasy i atrybuty (obserwator treści w GeniusEmbed ich nie śledzi, więc nie ma pętli),
// poza przywróceniem kolejności wierszy, które samo w sobie ma wywołać ponowne poprawki treści.

// Kolumny tekstowe (zawodnik, drużyna, rozgrywki) Genius oznacza data-sort-use="text" — footable ich nie sortuje,
// więc nie pokazujemy przy nich strzałki ani kursora sortowania.
const isTextColumn = (th: HTMLElement) => th.dataset.sortUse === 'text';

export function markSortedColumns(root: HTMLElement) {
  root.querySelectorAll('table').forEach((table) => {
    const headers = [...(table.tHead?.rows[0]?.cells ?? [])];
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
    // Kolejność z Genius zapamiętujemy przy pierwszym wczytaniu (przed jakimkolwiek sortowaniem).
    if (rows.some((row) => !row.dataset.geniusOrder)) {
      rows.forEach((row, index) => {
        if (!row.dataset.geniusOrder) row.dataset.geniusOrder = String(index);
      });
    }
    const sorted = headers.findIndex((th) => th.classList.contains('footable-asc') || th.classList.contains('footable-desc'));
    headers.forEach((th, index) => {
      if (isTextColumn(th)) {
        th.classList.remove('footable-sortable');
        return;
      }
      if (!th.classList.contains('footable-sortable')) return;
      const sort = index === sorted ? (th.classList.contains('footable-asc') ? 'ascending' : 'descending') : 'none';
      if (th.getAttribute('aria-sort') !== sort) th.setAttribute('aria-sort', sort);
    });
    for (const row of rows) {
      [...row.cells].forEach((cell, index) => cell.classList.toggle('genius-sorted-col', index === sorted));
    }
  });
}

// Kliknięcie w nagłówek, obsłużone przed footable (nasłuch w fazie przechwytywania): kolumna tekstowa nic nie robi,
// a trzecie kliknięcie (kolumna już posortowana malejąco) przywraca kolejność z Genius zamiast znów sortować rosnąco.
// Zwraca true, gdy kliknięcie zostało obsłużone tutaj (footable ma go wtedy nie dostać).
export function handleSortClick(event: Event): boolean {
  const th = (event.target as HTMLElement).closest<HTMLTableCellElement>('thead th');
  const table = th?.closest('table');
  if (!th || !table) return false;
  if (isTextColumn(th)) return true;
  if (!th.classList.contains('footable-desc')) return false;

  th.classList.remove('footable-desc', 'footable-asc');
  th.querySelector('.fooicon')?.classList.replace('fooicon-sort-desc', 'fooicon-sort');
  for (const body of table.tBodies) {
    const rows = [...body.rows].sort((a, b) => Number(a.dataset.geniusOrder ?? 0) - Number(b.dataset.geniusOrder ?? 0));
    body.append(...rows);
  }
  return true;
}
