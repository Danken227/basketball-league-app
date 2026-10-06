// Zastępcze logo drużyny, gdy liga nie wgrała go do Genius (Genius nie podaje wtedy obrazka wcale)
// albo gdy obrazek się nie wczyta: ciemny kwadrat z pomarańczowymi liniami piłki i inicjałami drużyny.

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Inicjały z pierwszych liter dwóch pierwszych słów nazwy (bez cyfr i znaków), a przy jednym słowie jego dwie
// pierwsze litery, np. "Hoop Monkeys" → "HM", "Łomiarze" → "ŁO".
function initials(name: string) {
  const [first = '?', second] = name.match(/\p{L}+/gu) ?? [];
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}

const cache = new Map<string, string>();

export function placeholderLogo(name: string) {
  const text = initials(name);
  const cached = cache.get(text);
  if (cached) return cached;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
<rect width="120" height="120" rx="26" fill="url(#g)"/>
<g fill="none" stroke="#f97316" stroke-width="3" opacity=".45"><circle cx="60" cy="60" r="44"/><path d="M16 60h88M60 16v88M30 28c17 18 17 46 0 64M90 28c-17 18-17 46 0 64"/></g>
<text x="60" y="61" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="${text.length > 1 ? 38 : 46}" font-weight="800" fill="#ffffff">${escapeXml(text)}</text>
</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(text, url);
  return url;
}

const logoImg = (name: string) => {
  const img = document.createElement('img');
  img.src = placeholderLogo(name);
  img.alt = name;
  img.className = 'logo genius-logo-placeholder';
  return img;
};

// Uzupełnia brakujące loga w treści Genius. Dodaje elementy tylko tam, gdzie obrazka nie ma, więc kolejne
// wywołanie (obserwator treści w GeniusEmbed reaguje na te zmiany) niczego już nie zmienia.
export function fillMissingLogos(root: HTMLElement) {
  // Lista drużyn: kafelek z samym linkiem z nazwą.
  root.querySelectorAll('.team-link').forEach((tile) => {
    if (tile.querySelector('img')) return;
    const link = tile.querySelector('a');
    const name = link?.textContent?.trim() ?? '';
    const logoLink = document.createElement('a');
    if (link) logoLink.href = link.getAttribute('href') ?? '';
    logoLink.append(logoImg(name));
    tile.prepend(logoLink);
  });
  // Nagłówek drużyny i nagłówek meczu (logo przy nazwie), tabela ligowa (kolumna logo).
  const containers: [string, (el: Element) => string][] = [
    ['.team-header .logo', (el) => el.closest('.team-header')?.querySelector('.team-title, h1')?.textContent?.trim() ?? ''],
    ['.match-header .team', (el) => el.closest('.team-box')?.querySelector('.name')?.textContent?.trim() ?? ''],
    ['td.team-logo', (el) => el.closest('tr')?.querySelector('td.team-name')?.textContent?.trim() ?? ''],
  ];
  // Rywal w meczach drużyny (podsumowanie): logo przed nazwą, bez dopisku gospodarz/gość.
  root.querySelectorAll('td.matchOpponent').forEach((cell) => {
    if (cell.querySelector('img')) return;
    const name = (cell.textContent ?? '').trim().replace(/\s*\((H|A|dom|wyjazd)\)$/, '');
    if (name) cell.prepend(logoImg(name));
  });
  for (const [selector, nameOf] of containers) {
    root.querySelectorAll(selector).forEach((el) => {
      if (el.querySelector('img')) return;
      const name = nameOf(el);
      if (!name) return;
      const target = el.querySelector('a') ?? el;
      target.append(logoImg(name));
    });
  }
}

// Logo drużyny, które się nie wczytało (błąd sieci, usunięty plik) — podmieniamy na zastępcze.
const teamLogoContext = '.team-link, .team-header, .match-header, td.team-logo, .matchOpponent, .pbp-team';

export function replaceBrokenLogo(event: Event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || img.src.startsWith('data:') || !img.closest(teamLogoContext)) return;
  img.src = placeholderLogo(img.alt || '?');
}
