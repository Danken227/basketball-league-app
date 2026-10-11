// Grupy (fazy) tabel Genius. Bez wybranej grupy Genius pokazuje swoją domyślną — nie zawsze pierwszą (np. w 2. lidze
// grupę B, w 3. lidze grupę D). Domyślnie chcemy grupę A: pierwszą fazę, której nazwa zaczyna się od "Grupa"
// (w zakończonych edycjach przed grupami jest jeszcze "PLAY OFF"). Rozgrywki bez grup (np. sam sezon zasadniczy
// i play-off) zostają przy domyślnym widoku Genius. Pierwszą grupę znamy z góry (FIRST_GROUPS, stan z 11.10.2026 —
// podział na grupy ustala się na początku sezonu), a dla nowych rozgrywek zapamiętujemy ją w przeglądarce
// z menu grup w tabeli; "" = bez grup.
import { useState } from 'react';

const STORAGE_KEY = 'genius-first-group-v2';

// Numer rozgrywek → pierwsza grupa (tylko rozgrywki z grupami; pozostałe znane rozgrywki są bez grup).
const FIRST_GROUPS: Record<string, string> = {
  ...Object.fromEntries(
    ['36964', '36965', '36966', '38003', '38004', '38006', '38007', '39634', '39635', '39636', '39639', '39640', '40640', '40642', '40666', '40667', '40710', '40713', '42323', '42324', '42326', '42329', '42459', '42460', '42461', '48291', '48292', '48293', '48296', '48375', '48376', '49972', '49974', '49982', '50006', '50016'].map((cid) => [cid, 'Grupa A']),
  ),
  '48295': 'GRUPA A',
};

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

const known: Record<string, string> = { ...FIRST_GROUPS, ...load() };

export const firstGroup = (cid: number): string | undefined => known[cid];

// Menu grup w treści tabeli Genius (chowamy je w genius.css na stronie głównej, na rzecz naszego przełącznika).
export function readGroups(root: HTMLElement) {
  const links = [...root.querySelectorAll('.selection-scroll a.menuoption')];
  return {
    names: links.map((link) => link.textContent?.trim() ?? '').filter(Boolean),
    current: links.find((link) => link.classList.contains('currentoption'))?.textContent?.trim() ?? '',
  };
}

function remember(cid: number, first: string) {
  if (known[cid] === first) return;
  known[cid] = first;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(known));
  } catch {
    // Zablokowany storage — pamiętamy do końca wizyty.
  }
}

// Grupa do pokazania: wybrana albo pierwsza z rozgrywek. onGroups (z treści tabeli) zapamiętuje pierwszą grupę;
// gdy przyszła inna niż pierwsza (pierwsze wejście do tych rozgrywek), komponent prosi o pierwszą.
export function useDefaultGroup(cid: number | undefined, chosen: string) {
  const [, setVersion] = useState(0);
  const phase = chosen || (cid ? (firstGroup(cid) ?? '') : '');
  const onGroups = (root: HTMLElement) => {
    if (!cid) return;
    const { names, current } = readGroups(root);
    // Treść bez menu grup (np. jeszcze z pamięci albo inne rozgrywki w trakcie przełączania) — bez zmian.
    if (!root.querySelector(`.hs-embed._comp_${cid}`)) return;
    const first = names.find((name) => /^grupa\b/i.test(name)) ?? '';
    if (firstGroup(cid) === first) return;
    remember(cid, first);
    if (!chosen && first && current !== first) setVersion((version) => version + 1);
  };
  return { phase, onGroups };
}
