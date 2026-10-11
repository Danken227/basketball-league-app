// Klient: DALK — Dolnośląska Liga Koszykówki (dalk.pl). Wszystko, co dotyczy tej ligi; reszta strony to produkt (src/).
// Pliki: content/ (aktualności i regulamin przeniesione z dalk.pl), public/ (logo, banery, loga partnerów, migawka
// danych demo — public/snapshot, poza repozytorium), scripts/ (pobieranie treści z dalk.pl), server.js (api/).
import type { ClientConfig } from '../../src/clientConfig';
import site from './site.json';

// Pierwsza grupa tabel z grupami (stan z 11.10.2026 — podział na grupy ustala się na początku sezonu).
const groupA = [
  '36964', '36965', '36966', '38003', '38004', '38006', '38007', '39634', '39635', '39636', '39639', '39640', '40640', '40642',
  '40666', '40667', '40710', '40713', '42323', '42324', '42326', '42329', '42459', '42460', '42461', '48291', '48292', '48293',
  '48296', '48375', '48376', '49972', '49974', '49982', '50006', '50016',
];

const client: ClientConfig = {
  site,
  brand: {
    shortName: 'DALK',
    nameLines: ['Dolnośląska', 'Liga Koszykówki'],
    copyrightName: 'Dolnośląska Liga Koszykówki',
    // Logo ligi z dalk.pl, zmniejszone do 112 px (ikona strony to logo.png, 180 px).
    logo: '/logo.webp',
  },
  genius: {
    organization: 'DALK',
    allowedDomains: ['dalk.pl', 'sportlivepolska.pl'],
    // Edycja jesienna (np. 2025/26) i wiosenna (np. 2026), każda z osobnymi rozgrywkami.
    editions: [
      { id: '2026-27', name: '2026/27', competitions: { eks: 49970, '1': 49974, '2': 50006, '3': 50016 } },
      { id: '2026', name: '2026', competitions: { eks: 48294, '1': 48292, '2': 48291, '3': 48293 } },
      { id: '2025-26', name: '2025/26', competitions: { eks: 42328, '1': 42459, '2': 42460, '3': 42461 } },
      { id: '2025', name: '2025', competitions: { eks: 40641, '1': 40640, '2': 40642, '3': 40666 } },
      { id: '2024-25', name: '2024/25', competitions: { eks: 39633, '1': 39634, '2': 39635, '3': 39636 } },
      { id: '2024', name: '2024', competitions: { eks: 38002, '1': 38003, '2': 38004, '3': 38007 } },
      { id: '2023-24', name: '2023/24', competitions: { eks: 36963, '1': 36964, '2': 36965, '3': 36966 } },
    ],
    // Numery z listy rozgrywek DALK w Genius (wybór rozgrywek: parametr _cc=1). W edycji 2023/24 juniorzy grali
    // we wspólnych rozgrywkach bez podziału na kategorie, a U13 jest od 2025.
    juniorCompetitions: {
      '2026-27': { U13: 49971, U15: 49972, U17: 49975, U19: 49982 },
      '2026': { U13: 48295, U15: 48296, U17: 48376, U19: 48375 },
      '2025-26': { U13: 42329, U15: 42326, U17: 42324, U19: 42323 },
      '2025': { U13: 40711, U15: 40710, U17: 40713, U19: 40667 },
      '2024-25': { U15: 39640, U17: 39639, U19: 39638 },
      '2024': { U15: 38021, U17: 38006, U19: 38005 },
    },
    // Ten sam widget co na dalk.pl, obejmuje wszystkie ligi.
    resultsWidgets: { all: 'L65TRHI9J4MAGUYV9HYOQO094QLVMS' },
    firstGroups: { ...Object.fromEntries(groupA.map((cid) => [cid, 'Grupa A'])), '48295': 'GRUPA A' },
  },
  links: {
    youtube: 'https://www.youtube.com/@Liga_DALK',
    // Ten sam plik co przycisk „Zgłoś team” na dalk.pl.
    registrationForm: 'https://dalk.pl/images/PLIKI-DO-POBRANIA/formularz-18-edycja.doc',
  },
  // Jak na dalk.pl: partner danych (statystyki prowadzone w Genius Sports) i patron medialny. Loga z dalk.pl,
  // zmniejszone (WebP).
  partners: [
    {
      label: 'Partner danych',
      name: 'Genius Sports',
      href: 'https://www.geniussports.com/',
      logo: '/partners/genius-sports.webp',
      width: 133,
      height: 80,
      imgClassName: 'h-20 w-auto rounded-lg dark:bg-[#fff]',
    },
    {
      label: 'Patron medialny',
      name: 'Strefa Basketu.pl',
      href: 'https://strefabasketu.pl',
      logo: '/partners/strefabasketu.webp',
      width: 110,
      height: 110,
      // Logo ma szeroki przezroczysty margines (rysunek to ok. 70% wysokości obrazka), więc jest powiększone
      // i przycięte w ramce: rysunek ma wtedy tę samą wysokość co logo Genius Sports (78 px).
      frameClassName: 'block h-20 w-[106px] overflow-hidden rounded-lg dark:bg-[#fff]',
      imgClassName: '-mt-[14px] -ml-[1px] h-[110px] w-[110px] max-w-none',
    },
  ],
  news: {
    sourceSite: 'dalk.pl',
    // Banery wpisów z dalk.pl (oryginał PNG ważył 860 KB) — u nas zmniejszone kopie.
    imageRewrites: {
      'https://dalk.pl/images/aktualnosci-foto/baner18edycja.png': '/news/baner18edycja.webp',
      'https://dalk.pl/images/aktualnosci-foto/baner-dalk.jpg': '/news/baner-dalk.webp',
    },
  },
  // Care Bears II - Łobuzersi.
  demo: { streamUrl: 'https://www.youtube.com/watch?v=i_5gLSnPotY' },
  storagePrefix: 'dalk',
};

export default client;
