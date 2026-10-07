// Migawka danych Genius do wersji demonstracyjnej poza domeną ligi (np. na Vercelu): treści osadzeń zapisane
// na dev.dalk.pl przez stronę /__snapshot (SnapshotCrawler) leżą w public/snapshot jako pliki HTML, a manifest
// index.json wiąże je z kluczami osadzeń (geniusCacheKey). GeniusEmbed w trybie migawki czyta je zamiast Genius.

export interface SnapshotManifest {
  // Data zapisu (ISO) — pokazujemy ją w pasku wersji demonstracyjnej.
  createdAt: string;
  // Nazwa pliku → klucz osadzenia.
  files: Record<string, string>;
}

export const SNAPSHOT_DIR = '/snapshot';

// Klucz bez języka na końcu: migawka jest po angielsku, a tłumaczenie (geniusI18n) działa na niej tak samo.
export const snapshotKey = (cacheKey: string) => cacheKey.replace(/\|(pl|en)$/, '');

// Nazwa pliku z klucza (53-bitowy skrót cyrb53 w zapisie base36) — klucze zawierają "/", "?" i spacje.
export function snapshotFile(key: string) {
  const text = snapshotKey(key);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}.html`;
}

let manifest: Promise<SnapshotManifest | undefined> | undefined;

export function loadManifest() {
  manifest ??= fetch(`${SNAPSHOT_DIR}/index.json`)
    .then((response) => (response.ok ? (response.json() as Promise<SnapshotManifest>) : undefined))
    .catch(() => undefined);
  return manifest;
}

const contents = new Map<string, Promise<string | undefined>>();

// Treść osadzenia z migawki albo undefined, gdy tej strony w migawce nie ma.
export function loadSnapshot(cacheKey: string): Promise<string | undefined> {
  const file = snapshotFile(cacheKey);
  let content = contents.get(file);
  if (!content) {
    content = loadManifest().then((m) =>
      m?.files[file]
        ? fetch(`${SNAPSHOT_DIR}/${file}`)
            .then((response) => (response.ok ? response.text() : undefined))
            .catch(() => undefined)
        : undefined,
    );
    contents.set(file, content);
  }
  return content;
}

// Komunikat w miejscu treści, której nie ma w migawce. Ma klasę hs-embed (i rozgrywki), żeby strony traktowały
// go jak wczytaną, pustą treść (np. blok ligi zawodnika bez występów się chowa) zamiast czekać w nieskończoność.
export const snapshotMissingHtml = (competition?: string) =>
  `<div class="hs-embed genius-snapshot-missing${competition ? ` _comp_${competition}` : ''}"><p class="genius-status">` +
  'Ta część nie jest dostępna w wersji demonstracyjnej (zapisane dane Genius Sports z bieżącej edycji).</p></div>';

declare global {
  interface Window {
    toggleclasses?: (container: string, mustHaveClass: string, filterClass: string, show: number) => void;
  }
}

// Skrypty Genius, które w żywej wersji przychodzą razem z treścią (filtry w relacji meczu), w migawce
// nie istnieją — linki w treści wołają je z atrybutu onclick, więc zakładamy własne odpowiedniki.
let scriptsInstalled = false;

export function installSnapshotScripts() {
  if (scriptsInstalled) return;
  scriptsInstalled = true;
  // Relacja meczu: pokaż elementy z klasą filterClass, schowaj pozostałe (albo odwrotnie przy show = 0).
  window.toggleclasses ??= (container, mustHaveClass, filterClass, show) => {
    const classes = filterClass.split(' ');
    document.querySelectorAll<HTMLElement>(`#${container} .${mustHaveClass}`).forEach((element) => {
      const matches = classes.every((name) => element.classList.contains(name));
      element.style.display = matches === Boolean(show) ? '' : 'none';
    });
  };
}

// Klucz zapisanych kart widgetu paska meczów (GeniusMatchBar).
export const widgetSnapshotKey = (widgetId: string) => `widget|${widgetId}`;
