// Nazwy drużyn w edycjach (panel administratora): Genius pokazuje we wszystkich edycjach najnowszą nazwę drużyny,
// więc w treści stron danej edycji (tabele, terminarz, mecze, strona drużyny) zamieniamy ją na nazwę z tamtego
// sezonu. Zamieniamy tekst (nazwa stoi też poza linkami, np. w nagłówkach statystyk meczu) i opisy logo.
import type { TeamNameEntry } from '../../data/siteContent';

const replaceIn = (value: string, { geniusName, name }: TeamNameEntry) =>
  // Nowa nazwa może zawierać starą ("Elite" → "Elite Mosquitos") — wtedy nie zamieniamy drugi raz.
  value.includes(geniusName) && !(name.includes(geniusName) && value.includes(name)) ? value.split(geniusName).join(name) : value;

export function applyTeamRenames(root: HTMLElement, renames: TeamNameEntry[]) {
  if (renames.length === 0) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    const next = renames.reduce(replaceIn, text);
    if (next !== text) node.nodeValue = next;
  }
  root.querySelectorAll<HTMLImageElement>('img[alt]').forEach((img) => {
    const next = renames.reduce(replaceIn, img.alt);
    if (next !== img.alt) img.alt = next;
  });
}
