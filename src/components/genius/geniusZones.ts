// Strefy tabeli z panelu administratora (zakładka „Awanse/spadki”): wiersze z miejscami do play-off (od góry)
// i spadkowymi (od dołu) dostają klasę i tło (genius.css), a pod tabelą — legendę; tylko gdy w panelu zaznaczono
// „Pokazuj w tabelach”. Miejsce bierzemy z kolumny pozycji Genius (tabelę można sortować po innych kolumnach).
// Faz bez grup w rozgrywkach z grupami (np. „PLAY OFF” w zakończonych edycjach) nie oznaczamy.
import type { StandingsZone } from '../../data/playoff';
import { readGroups } from './geniusGroups';

const LEGEND_CLASS = 'genius-zone-legend';

export function applyStandingsZones(root: HTMLElement, zone: StandingsZone | undefined) {
  const tables = [...root.querySelectorAll<HTMLTableElement>('table.standings')];
  if (tables.length === 0) return;
  const { names, current } = readGroups(root);
  const groupPhase = names.length === 0 || !names.some((name) => /^grupa\b/i.test(name)) || /^grupa\b/i.test(current);
  const active = zone?.show && groupPhase && (zone.playoff > 0 || zone.relegation > 0) ? zone : undefined;

  tables.forEach((table) => {
    const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')];
    rows.forEach((row) => {
      const position = Number(row.cells[0]?.textContent?.trim()) || 0;
      const playoff = Boolean(active && position > 0 && position <= active.playoff);
      const relegation = Boolean(active && !playoff && position > rows.length - active.relegation);
      row.classList.toggle('zone-playoff', playoff);
      row.classList.toggle('zone-relegation', relegation);
    });
    const wrap = table.closest('.table-wrap') ?? table;
    const legend = wrap.nextElementSibling?.classList.contains(LEGEND_CLASS) ? wrap.nextElementSibling : undefined;
    if (!active) {
      legend?.remove();
      return;
    }
    const html = [
      active.playoff > 0 && '<span class="zone-key zone-key--playoff">Awans do play-off</span>',
      active.relegation > 0 && '<span class="zone-key zone-key--relegation">Spadek</span>',
    ]
      .filter(Boolean)
      .join('');
    if (legend?.innerHTML === html) return;
    const element = legend ?? document.createElement('div');
    element.className = LEGEND_CLASS;
    element.innerHTML = html;
    if (!legend) wrap.after(element);
  });
}
