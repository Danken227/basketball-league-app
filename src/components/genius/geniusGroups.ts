// Grupy (fazy) tabel Genius. Bez wybranej grupy Genius pokazuje swoją domyślną — nie zawsze pierwszą (np. w 2. lidze
// grupę B, w 3. lidze grupę D). Domyślnie chcemy pierwszą fazę poza play-off: grupę A albo sezon zasadniczy
// (w zakończonych edycjach przed nimi jest jeszcze "PLAY OFF" albo "Faza pucharowa"). Rozgrywki bez grup (np. sam sezon zasadniczy
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

// Grupa sezonu zasadniczego ("Grupa A", w 2018 też "Group A").
export const isGroupName = (name: string) => /^(grupa|group)\b/i.test(name);
// Faza play-off ("PLAY OFF", do 2019 "Faza pucharowa") — w zakończonych edycjach obok grup albo sezonu zasadniczego
// (np. "Ekstraliga 2026").
export const isPlayoffPhase = (name: string) => /play\s*-?\s*off|pucharow/i.test(name);

// Fazy play-off chowamy w menu tabel, gdy jest też inna faza: tabela play-off w Genius jest pusta, a drabinkę
// pokazuje nasz przełącznik Tabela / Play-off.
export function hidePlayoffPhases(root: HTMLElement) {
  const links = [...root.querySelectorAll<HTMLElement>('.selection-scroll a.menuoption')];
  const playoff = (link: HTMLElement) => isPlayoffPhase(link.textContent?.trim() ?? '');
  const hasOther = links.some((link) => !playoff(link));
  links.forEach((link) => link.classList.toggle('genius-phase-hidden', hasOther && playoff(link)));
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
    // Pierwsza faza poza play-off: grupa A albo sezon zasadniczy. W starszych edycjach Genius domyślnie pokazuje
    // fazę pucharową, ostatnią grupę (Ekstraliga 2018/19: "Grupa 5-7" zamiast "Faza Zasadnicza") albo play-off.
    // Sezon zasadniczy bez grup, który Genius i tak pokazuje domyślnie, zostaje bez wyboru ("") — jak dotąd.
    const regular = names.find((name) => !isPlayoffPhase(name)) ?? '';
    const first = !isGroupName(regular) && regular === current && !firstGroup(cid) ? '' : regular;
    if (firstGroup(cid) === first) return;
    remember(cid, first);
    if (!chosen && first && current !== first) setVersion((version) => version + 1);
  };
  return { phase, onGroups };
}
