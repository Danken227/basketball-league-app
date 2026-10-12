// Grupy (fazy) tabel Genius. Bez wybranej grupy Genius pokazuje swoją domyślną — nie zawsze pierwszą (np. w 2. lidze
// grupę B, w 3. lidze grupę D). Domyślnie chcemy grupę A: pierwszą fazę, której nazwa zaczyna się od "Grupa"
// (w zakończonych edycjach przed grupami jest jeszcze "PLAY OFF"). Rozgrywki bez grup (np. sam sezon zasadniczy
// i play-off) zostają przy domyślnym widoku Genius. Pierwszą grupę znamy z góry (FIRST_GROUPS z konfiguracji klienta —
// podział na grupy ustala się na początku sezonu), a dla nowych rozgrywek zapamiętujemy ją w przeglądarce
// z menu grup w tabeli; "" = bez grup.
import client from '@client/client';
import { useState } from 'react';

const STORAGE_KEY = 'genius-first-group-v2';

// Numer rozgrywek → pierwsza grupa (konfiguracja klienta; tylko rozgrywki z grupami).
const FIRST_GROUPS: Record<string, string> = client.genius.firstGroups;

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

const known: Record<string, string> = { ...FIRST_GROUPS, ...load() };

export const firstGroup = (cid: number): string | undefined => known[cid];

// Grupa sezonu zasadniczego ("Grupa A"); inne fazy to np. "PLAY OFF" w zakończonych edycjach.
export const isGroupName = (name: string) => /^grupa\b/i.test(name);

// Fazy spoza grup (np. "PLAY OFF") chowamy w menu tabel: tabela tej fazy w Genius jest pusta, a drabinkę play-off
// pokazuje nasz przełącznik Tabela / Play-off. Rozgrywki bez grup zostają bez zmian.
export function hideNonGroupPhases(root: HTMLElement) {
  const links = [...root.querySelectorAll<HTMLElement>('.selection-scroll a.menuoption')];
  const hasGroups = links.some((link) => isGroupName(link.textContent?.trim() ?? ''));
  links.forEach((link) => link.classList.toggle('genius-phase-hidden', hasGroups && !isGroupName(link.textContent?.trim() ?? '')));
}

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
