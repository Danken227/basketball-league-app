// Strefy tabeli z panelu administratora (zakładka „Awanse/spadki”): wiersze z miejscami do play-off (od góry)
// i spadkowymi (od dołu) dostają klasę i tło (genius.css), a pod tabelą — legendę; tylko gdy w panelu zaznaczono
// „Pokazuj w tabelach”. Miejsce to kolejność wiersza w tabeli Genius (tabelę można sortować po innych kolumnach).
// Fazy play-off („PLAY OFF” w zakończonych edycjach) nie oznaczamy.
import { zoneOfGroup, type StandingsZone } from '../../data/playoff';
import { isPlayoffPhase, readGroups } from './geniusGroups';

const LEGEND_CLASS = 'genius-zone-legend';

export function applyStandingsZones(root: HTMLElement, zone: StandingsZone | undefined) {
  const tables = [...root.querySelectorAll<HTMLTableElement>('table.standings')];
  if (tables.length === 0) return;
  const { names, current } = readGroups(root);
  // Tabela fazy play-off (jedyna albo wybrana) nie ma stref.
  const groupPhase = !isPlayoffPhase(current) && !(names.length > 0 && names.every(isPlayoffPhase));
  // Strefy wybranej grupy (osobne ustawienia grup) albo wspólne.
  const counts = zone && zoneOfGroup(zone, current);
  const active = zone?.show && counts && groupPhase && (counts.playoff > 0 || counts.relegation > 0) ? counts : undefined;

  tables.forEach((table) => {
    const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')];
    rows.forEach((row, index) => {
      // Genius daje drużynom z równym bilansem to samo miejsce (np. kilka „6”), a wtedy strefy obejmowały złe
      // wiersze. Numerujemy kolejno w kolejności Genius (jego rozstrzygnięcie remisów): zapamiętanej przy
      // sortowaniu (geniusTableSort), a przed pierwszym sortowaniem — w kolejności wierszy.
      const position = Number(row.dataset.geniusOrder ?? index) + 1;
      const cell = row.cells[0];
      if (cell && /^\d+$/.test(cell.textContent?.trim() ?? '') && cell.textContent !== String(position)) cell.textContent = String(position);
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
