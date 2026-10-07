import { geniusTranslation } from './geniusConfig';

// Polskie teksty w treści Genius (pełne tłumaczenie włącza zmienna VITE_GENIUS_TRANSLATION=pl, patrz geniusConfig).
// Genius ma wersję polską, ale niepełną (w miejscu wielu nazw zwraca surowe klucze,
// np. "STAT_PERSONCOMP_BASKETBALL_sTwoPointersMade_NAME"), więc pobieramy wersję angielską i tłumaczymy ją sami:
// nagłówki, zakładki, opisy kolumn (atrybut title), skróty statystyk, relację play by play i daty.
// Tłumaczymy tylko całe teksty z poniższych słowników (oraz kilka wzorców), więc nazwiska i nazwy drużyn zostają.
// Zmieniamy dane węzłów tekstowych i atrybuty — obserwator treści w GeniusEmbed ich nie śledzi, więc nie ma pętli.

// Nazwy, nagłówki i opisy (klucze małymi literami — Genius pisze te same nazwy raz małą, raz wielką literą).
const phrases: Record<string, string> = {
  // Zakładki i nagłówki
  summary: 'Podsumowanie',
  roster: 'Skład',
  schedule: 'Terminarz',
  statistics: 'Statystyki',
  'box score': 'Statystyki meczu',
  'play by play': 'Relacja',
  'shot chart': 'Mapa rzutów',
  'team analysis': 'Analiza drużyn',
  'game log': 'Mecze',
  'shooting statistics': 'Rzuty',
  averages: 'Średnie',
  'fouls summary': 'Faule',
  'last 5 matches': 'Ostatnie 5 meczów',
  'next 5 matches': 'Najbliższe 5 meczów',
  'player list': 'Zawodnicy',
  legend: 'Legenda',
  totals: 'Razem',
  'team averages': 'Średnie drużyny',
  'contact details': 'Kontakt',
  'no results': 'Brak wyników',
  // Nagłówki kolumn ze słowami
  player: 'Zawodnik',
  'player name': 'Zawodnik',
  'shirt number': 'Nr',
  team: 'Drużyna',
  competition: 'Rozgrywki',
  date: 'Data',
  opposition: 'Rywal',
  venue: 'Hala',
  result: 'Wynik',
  position: 'Poz.',
  // Mecz: nagłówek, status, filtry
  final: 'Koniec',
  'live now': 'Na żywo',
  'half-time': 'Przerwa',
  period: 'Kwarta',
  preview: 'Zapowiedź',
  'vs.': 'vs',
  'date / time:': 'Termin:',
  'venue:': 'Hala:',
  'tip off:': 'Początek:',
  'team:': 'Drużyna:',
  'period:': 'Kwarta:',
  'made:': 'Celne:',
  'missed:': 'Niecelne:',
  both: 'Obie',
  all: 'Wszystkie',
  overtime: 'Dogrywka',
  // Statystyki (opisy kolumn, liderzy, porównanie drużyn)
  minutes: 'Minuty',
  points: 'Punkty',
  games: 'Mecze',
  'games played': 'Rozegrane mecze',
  'games started': 'Mecze w pierwszej piątce',
  won: 'Wygrane',
  lost: 'Przegrane',
  'score difference': 'Różnica punktów',
  assists: 'Asysty',
  blocks: 'Bloki',
  'blocks received': 'Bloki otrzymane',
  steals: 'Przechwyty',
  turnovers: 'Straty',
  rebounds: 'Zbiórki',
  'total rebounds': 'Zbiórki',
  'defensive rebounds': 'Zbiórki w obronie',
  'offensive rebounds': 'Zbiórki w ataku',
  'rebounds percentage': 'Skuteczność zbiórek',
  'rebounds offensive percentage': 'Skuteczność zbiórek w ataku',
  'defensive rebound percentage': 'Skuteczność zbiórek w obronie',
  'field goals attempted': 'Rzuty z gry oddane',
  'field goals made': 'Rzuty z gry celne',
  'field goal percentage': 'Skuteczność rzutów z gry',
  '2 points attempted': 'Rzuty za 2 oddane',
  '2 point attempted': 'Rzuty za 2 oddane',
  '2 points made': 'Rzuty za 2 celne',
  '2 point made': 'Rzuty za 2 celne',
  '2 points percentage': 'Skuteczność rzutów za 2',
  '2 point percentage': 'Skuteczność rzutów za 2',
  '3 points attempted': 'Rzuty za 3 oddane',
  '3 points atttempted': 'Rzuty za 3 oddane',
  '3 point attempted': 'Rzuty za 3 oddane',
  '3 points made': 'Rzuty za 3 celne',
  '3 point made': 'Rzuty za 3 celne',
  '3 pointers made': 'Rzuty za 3 celne',
  '3 points percentage': 'Skuteczność rzutów za 3',
  '3 point percentage': 'Skuteczność rzutów za 3',
  'free throws attempted': 'Rzuty wolne oddane',
  'free throw attempted': 'Rzuty wolne oddane',
  'free throws made': 'Rzuty wolne celne',
  'free throw made': 'Rzuty wolne celne',
  'free throw percentage': 'Skuteczność rzutów wolnych',
  'personal foul': 'Faule osobiste',
  'personal fouls': 'Faule osobiste',
  'offensive foul': 'Faule w ataku',
  'offensive fouls': 'Faule w ataku',
  'technical foul': 'Faule techniczne',
  'technical fouls': 'Faule techniczne',
  'unsportsmanlike fouls': 'Faule niesportowe',
  'disqualifying foul': 'Faule dyskwalifikujące',
  'fouls on': 'Faule wymuszone',
  'total fouls': 'Faule łącznie',
  'team fouls': 'Faule drużyny',
  'team rebounds': 'Zbiórki drużyny',
  'team turnovers': 'Straty drużyny',
  efficiency: 'Ewaluacja',
  'plus/minus': 'Plus/minus',
  'bench points': 'Punkty z ławki',
  'fast break points': 'Punkty z kontry',
  'points in paint': 'Punkty spod kosza',
  'second chance points': 'Punkty z drugiej szansy',
  'points from turnovers': 'Punkty ze strat rywala',
  'points per possession': 'Punkty na posiadanie',
  possessions: 'Posiadania',
  'opponent possessions': 'Posiadania rywala',
  'biggest lead': 'Najwyższe prowadzenie',
  'biggest scoring run': 'Najdłuższa seria punktowa',
  // Opisy (title) kolumn składu drużyny
  playername: 'Zawodnik',
  shirtnumber: 'Numer',
};

// Relacja play by play (po nazwisku zawodnika: ", 2pt jump shot made" — tłumaczymy część po przecinku).
const actions: Record<string, string> = {
  'game start': 'Początek meczu',
  'game end': 'Koniec meczu',
  'period start': 'Początek kwarty',
  'period end': 'Koniec kwarty',
  'possession arrow - start period': 'Strzałka posiadania – początek kwarty',
  'timeout - full': 'Czas na żądanie',
  'jump ball - held ball': 'Rzut sędziowski – piłka przetrzymana',
  'jump ball - won': 'Rzut sędziowski – wygrany',
  'jump ball - lost': 'Rzut sędziowski – przegrany',
  assist: 'Asysta',
  block: 'Blok',
  steal: 'Przechwyt',
  'defensive rebound': 'Zbiórka w obronie',
  'offensive rebound': 'Zbiórka w ataku',
  'foul on': 'Faul wymuszony',
  'personal foul': 'Faul osobisty',
  'offensive foul': 'Faul w ataku',
  'technical foul': 'Faul techniczny',
  'unsportsmanlike foul': 'Faul niesportowy',
  'substitution in': 'Zmiana – wchodzi',
  'substitution out': 'Zmiana – schodzi',
  made: 'Celny',
  'turnover - bad pass': 'Strata – złe podanie',
  'turnover - ball handling': 'Strata – błąd kozłowania',
  'turnover - travel': 'Strata – kroki',
  'turnover - double dribble': 'Strata – podwójny kozioł',
  'turnover - 3 seconds': 'Strata – 3 sekundy',
  'turnover - 5 seconds': 'Strata – 5 sekund',
  'turnover - 8 seconds': 'Strata – 8 sekund',
  'turnover - offensive': 'Strata – faul w ataku',
  'turnover - out of bounds': 'Strata – aut',
  'turnover - shot clock violation': 'Strata – 24 sekundy',
  'turnover - other': 'Strata',
};

const shotTypes: Record<string, string> = {
  'jump shot': 'z wyskoku',
  'lay up': 'lay-up',
  'turn around jump shot': 'z obrotu',
  'tip in': 'dobitka',
  dunk: 'wsad',
  'hook shot': 'hak',
  'fade away': 'z odchylenia',
  'step back jump shot': 'step back',
  'pull up jump shot': 'z zatrzymania',
  'driving lay up': 'lay-up po wejściu',
  'alley oop': 'alley-oop',
  floating: 'floater',
};

// Skróty statystyk (nagłówki kolumn, liderzy, legenda box score). Średnie na mecz (końcówka "PG") dostają "/M".
const abbreviations: Record<string, string> = {
  PTS: 'PKT',
  REB: 'ZB',
  OFF: 'ZA',
  DEF: 'ZO',
  OR: 'ZA',
  DR: 'ZO',
  AST: 'AS',
  STL: 'PRZ',
  ST: 'PRZ',
  BLK: 'BL',
  BLKR: 'BLO',
  TO: 'STR',
  TTO: 'STR.DR',
  PF: 'FO',
  OF: 'FA',
  FO: 'FW',
  TF: 'FT',
  DF: 'FD',
  'FLS ON': 'FW',
  'TOT FOULS': 'F',
  'TEAM FOULS': 'F.DR',
  'UNS. FOUL': 'FN',
  FGA: 'RZO',
  FGM: 'RZC',
  'FG%': 'RZ%',
  '2PA': '2PO',
  '2PM': '2PC',
  '3PA': '3PO',
  '3PM': '3PC',
  FTA: 'OSO',
  FTM: 'OSC',
  'FT%': 'OS%',
  'OR%': 'ZA%',
  'DR%': 'ZO%',
  'REB%': 'ZB%',
  EFF: 'EVAL',
  MINS: 'MIN',
  G: 'M',
  GP: 'M',
  GS: 'M5',
  W: 'W',
  L: 'P',
  GD: '+/-',
  NO: 'Nr',
  BP: 'PŁ',
  FBP: 'PK',
  PIP: 'PPK',
  '2CP': 'P2S',
  PFT: 'PZS',
  'PTS/POSS': 'PKT/POS',
  'AVG POSS': 'POS/M',
  'AVG OPP POSS': 'POS.R/M',
  'PERSONAL REB': 'ZB.IND',
  'AV TEAM REB': 'ZB.DR/M',
  // Średnie, których nie da się złożyć z "skrót + PG"
  PPG: 'PKT/M',
  RPG: 'ZB/M',
  APG: 'AS/M',
  MPG: 'MIN/M',
  BLKRPG: 'BLO/M',
};

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number | string) => String(n).padStart(2, '0');

function translateAbbreviation(text: string): string | undefined {
  const key = text.toUpperCase();
  if (abbreviations[key]) return abbreviations[key];
  const average = key.match(/^(.+?)\s?PG$/);
  if (average && abbreviations[average[1]]) return `${abbreviations[average[1]]}/M`;
  return undefined;
}

function translateShot(text: string): string | undefined {
  const shot = text.match(/^(2|3)pt (.+?)( made)?$/i);
  if (!shot) return undefined;
  const type = shotTypes[shot[2].toLowerCase()] ?? shot[2];
  return `Rzut za ${shot[1]} ${type} – ${shot[3] ? 'celny' : 'niecelny'}`;
}

function translateAction(text: string): string | undefined {
  const known = actions[text.toLowerCase()];
  if (known) return known;
  const freeThrow = text.match(/^free throw (\d) of (\d)( made)?$/i);
  if (freeThrow) return `Rzut wolny ${freeThrow[1]} z ${freeThrow[2]} – ${freeThrow[3] ? 'celny' : 'niecelny'}`;
  const turnover = text.match(/^turnover - (.+)$/i);
  if (turnover) return `Strata – ${turnover[1].toLowerCase()}`;
  return translateShot(text);
}

// Średnia na mecz w opisie ("Average points") — "Punkty – średnio na mecz".
function translatePhrase(text: string): string | undefined {
  const key = text.toLowerCase();
  if (phrases[key]) return phrases[key];
  const average = key.match(/^average (.+)$/);
  if (average && phrases[average[1]]) return `${phrases[average[1]]} – średnio na mecz`;
  const period = text.match(/^Period (\d)$/i);
  if (period) return `Kwarta ${period[1]}`;
  return undefined;
}

// Dymki na mapie rzutów: "10, Adam Jachimowicz, 2pt jumpshot 1" (1 = celny, 0 = niecelny).
const chartShots: Record<string, string> = {
  jumpshot: 'z wyskoku',
  layup: 'lay-up',
  tipinlayup: 'dobitka',
  turnaroundjumpshot: 'z obrotu',
  dunk: 'wsad',
  hookshot: 'hak',
  fadeaway: 'z odchylenia',
  stepbackjumpshot: 'step back',
  pullupjumpshot: 'z zatrzymania',
  drivinglayup: 'lay-up po wejściu',
  alleyoop: 'alley-oop',
  floatingjumpshot: 'floater',
};

function translateChartTitle(title: string): string | undefined {
  const shot = title.match(/^(.*), (2|3)pt (\w+) ([01])$/);
  if (shot) return `${shot[1]}, rzut za ${shot[2]} ${chartShots[shot[3]] ?? shot[3]} – ${shot[4] === '1' ? 'celny' : 'niecelny'}`;
  return undefined;
}

export function translateDate(text: string): string | undefined {
  // "Sep 20, 2026, 6:00 PM" → "20.09.2026, 18:00"
  const long = text.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4})(?:,? (\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
  if (long && months.includes(long[1].toLowerCase())) {
    const date = `${pad(long[2])}.${pad(months.indexOf(long[1].toLowerCase()) + 1)}.${long[3]}`;
    if (!long[4]) return date;
    const hours = (Number(long[4]) % 12) + (long[6].toUpperCase() === 'PM' ? 12 : 0);
    return `${date}, ${pad(hours)}:${long[5]}`;
  }
  // "10/4/26" (miesiąc/dzień/rok) → "04.10.2026"
  const short = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (short) return `${pad(short[2])}.${pad(short[1])}.20${short[3]}`;
  return undefined;
}

const abbreviationContext = 'th, .ld-statname, .boxscore-legend-abbreviation';

function translateText(text: string, parent: Element): string | undefined {
  if (parent.closest('.pbp-action')) {
    // Akcja zawodnika: ", 2pt jump shot made" (po nazwisku) albo akcja bez zawodnika ("Period start").
    const afterName = text.match(/^,\s*(.+)$/);
    if (afterName) {
      const action = translateAction(afterName[1]);
      return action && `, ${action.charAt(0).toLowerCase()}${action.slice(1)}`;
    }
    return translateAction(text);
  }
  if (parent.matches('.pbp-period')) return text.replace(/^P(\d)$/, 'K$1');
  if (parent.closest(abbreviationContext)) {
    const abbreviation = translateAbbreviation(text);
    if (abbreviation) return abbreviation;
  }
  return translatePhrase(text) ?? translateDate(text) ?? text.replace(/ \(H\)$/, ' (dom)').replace(/ \(A\)$/, ' (wyjazd)');
}

// Bez pełnego tłumaczenia (geniusTranslation) zostaje to, co strona miała wcześniej: polskie nazwy tabel
// na stronie Statystyki i polskie daty meczów w podsumowaniu drużyny.
const baseTitles: Record<string, string> = {
  'Shooting Statistics': 'Rzuty',
  Averages: 'Średnie',
  'Fouls Summary': 'Faule',
};

function translateBase(root: HTMLElement) {
  root.querySelectorAll('.stats-list h4').forEach((heading) => {
    const title = baseTitles[heading.textContent?.trim() ?? ''];
    if (title) heading.textContent = title;
  });
  root.querySelectorAll('td.matchTime').forEach((cell) => {
    const date = translateDate(cell.textContent?.trim() ?? '');
    if (date) cell.textContent = date;
  });
}

export function translateGenius(root: HTMLElement) {
  if (!geniusTranslation) {
    translateBase(root);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const raw = node.textContent ?? '';
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!parent || !/[A-Za-z]/.test(text) || parent.closest('script, style')) continue;
    // Już przetłumaczone (także w kopii z pamięci podręcznej) — część polskich skrótów to angielskie klucze
    // (np. PF → "FO", a "FO" w Genius to faule wymuszone), więc drugi raz nie tłumaczymy.
    const th = parent.closest('th');
    if (th?.dataset.geniusLabel !== undefined || parent.closest('[data-genius-tr]')) continue;
    const translated = translateText(text, parent);
    if (!translated || translated === text) continue;
    // Nagłówek kolumny zapamiętuje oryginał — z niego GeniusEmbed rozpoznaje średnie i sumy (statColumnKind).
    if (th) th.dataset.geniusLabel = th.textContent?.trim() ?? '';
    else if (parent.closest(abbreviationContext)) (parent as HTMLElement).dataset.geniusTr = '';
    node.textContent = raw.includes(text) ? raw.replace(text, translated) : translated;
  }
  root.querySelectorAll('[title]').forEach((element) => {
    const title = element.getAttribute('title') ?? '';
    const translated = translatePhrase(title.trim()) ?? translateChartTitle(title.trim());
    if (!translated) return;
    if (element instanceof HTMLElement && element.dataset.geniusTitle === undefined) element.dataset.geniusTitle = title;
    element.setAttribute('title', translated);
  });
}
