// Panel administratora: logowanie oraz treści dodawane przez administratora (aktualności i nazwy drużyn w edycjach).
// Wspólne dla funkcji Vercela (api/admin.js, zapis w Upstash Redis) i serwera Vite (vite.config.ts, zapis do pliku
// JSON na dysku). Treści czyta każdy (strona je wyświetla), zmieniać może tylko zalogowany administrator.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import client from './_client.js';

// Dane logowania ze zmiennych środowiskowych (repozytorium jest publiczne, więc hasła nie ma w kodzie): na Vercelu
// w ustawieniach projektu, na serwerze deweloperskim w .env.local. Bez ADMIN_PASSWORD logowanie jest wyłączone.
// Czytane przy każdym logowaniu — serwer Vite wczytuje .env.local dopiero po zaimportowaniu tego modułu.
const adminLogin = () => process.env.ADMIN_LOGIN || 'admin';
const adminPassword = () => process.env.ADMIN_PASSWORD;

const COOKIE = `${client.storagePrefix}_admin`;
const SESSION_SECONDS = 12 * 60 * 60;
// "Zapamiętaj mnie": sesja na 30 dni (ciasteczko zostaje po zamknięciu przeglądarki).
const REMEMBER_SECONDS = 30 * 24 * 60 * 60;

const NEWS_KEY = `${client.storagePrefix}:news`;
const TEAM_NAMES_KEY = `${client.storagePrefix}:team-names`;
// Strefy tabel (numer rozgrywek → miejsca do play-off od góry i spadkowe od dołu) i drabinki play-off
// (numer rozgrywek → drabinka). Małe, więc w treści wczytywanej przez każdego odwiedzającego.
const ZONES_KEY = `${client.storagePrefix}:zones`;
const PLAYOFFS_KEY = `${client.storagePrefix}:playoffs`;
const PLAYOFF_SIZES = [2, 4, 8, 16, 32];
// Osiągnięcia (numer rozgrywek → lista: medale drużyn z numerami zawodników, nagrody indywidualne): osobny wpis na
// każdą edycję (lista edycji z wpisami w ACHIEVEMENT_EDITIONS_KEY), żeby żaden wpis nie dochodził do limitu jednego
// zapytania Upstash (1 MB). Pierwsza wersja trzymała wszystko w jednym wpisie (ACHIEVEMENTS_LEGACY_KEY) — czytamy go
// dalej, a rozgrywki przenosimy do wpisu edycji przy ich zapisie.
const ACHIEVEMENTS_LEGACY_KEY = `${client.storagePrefix}:achievements`;
const ACHIEVEMENT_EDITIONS_KEY = `${client.storagePrefix}:achievement-editions`;
const achievementsKey = (editionId) => `${client.storagePrefix}:achievements:${editionId}`;
const ACHIEVEMENT_TYPES = ['medal', 'mvp', 'finalsMvp', 'topScorer', 'topRebounder', 'topAssists'];
const MAX_ACHIEVEMENTS_LENGTH = 900000;
// Nagrania meczów na YouTube (numer meczu Genius → numer filmu): dopasowane w panelu, póki film jest na liście
// kanału (YouTube podaje tylko 15 najnowszych), albo wklejone ręcznie. Strona meczu czyta je przez action=match-videos.
const MATCH_VIDEOS_KEY = `${client.storagePrefix}:match-videos`;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const digits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 15);

// Wszystkie osiągnięcia: stary wspólny wpis i wpisy edycji (wpis edycji ma pierwszeństwo).
async function readAchievements(store) {
  const [legacy, editions] = await Promise.all([store.get(ACHIEVEMENTS_LEGACY_KEY), store.get(ACHIEVEMENT_EDITIONS_KEY)]);
  const perEdition = await Promise.all((editions ?? []).map((editionId) => store.get(achievementsKey(editionId))));
  return Object.assign({}, legacy ?? {}, ...perEdition.map((entry) => entry ?? {}));
}

// Osiągnięcie z przeglądarki administratora: tylko znane pola. Medal ma miejsce i drużynę albo zawodnika (wpis
// ręczny), nagroda — zawodnika.
function achievement(input) {
  const type = ACHIEVEMENT_TYPES.includes(input?.type) ? input.type : undefined;
  if (!type) return undefined;
  const place = [1, 2, 3].includes(input?.place) ? input.place : undefined;
  const teamId = digits(input?.teamId);
  const playerId = digits(input?.playerId);
  if (type === 'medal' ? !place || !(teamId || playerId) : !playerId) return undefined;
  const players = Array.isArray(input?.players) ? [...new Set(input.players.map(digits).filter(Boolean))].slice(0, 60) : [];
  return {
    type,
    ...(place && type === 'medal' ? { place } : {}),
    ...(teamId ? { teamId, teamName: text(input?.teamName, 120) } : {}),
    ...(playerId ? { playerId, playerName: text(input?.playerName, 100) } : {}),
    ...(type === 'medal' && !playerId && players.length > 0 ? { players } : {}),
  };
}

const count = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));

const SERIES_FORMATS = ['single', 'twoLeg', 'bestOf3'];

// Drabinka z przeglądarki administratora: tylko znane pola. Rozstawienie (seeds) to miejsca z tabel grup
// z zapamiętaną drużyną (null — wolny los). Wyniki liczy strona z meczów fazy play-off w Genius (phase), według
// formatu serii w każdej rundzie (formats); results to tylko ręczne wyjątki (np. walkower) po kluczu
// "r<runda>m<mecz>" (albo "third").
function playoffBracket(input) {
  const seeds = Array.isArray(input?.seeds) ? input.seeds : [];
  if (!PLAYOFF_SIZES.includes(seeds.length)) return undefined;
  const results = {};
  for (const [key, result] of Object.entries(input?.results ?? {})) {
    if (!/^(r\d{1,2}m\d{1,2}|third)$/.test(key)) continue;
    const winner = result?.winner === 0 || result?.winner === 1 ? result.winner : undefined;
    const score = text(result?.score, 40);
    if (winner !== undefined || score) results[key] = { ...(winner !== undefined ? { winner } : {}), ...(score ? { score } : {}) };
  }
  return {
    enabled: input?.enabled === true,
    title: text(input?.title, 80) || 'Play-off',
    phase: text(input?.phase, 60) || 'PLAY OFF',
    formats: (Array.isArray(input?.formats) ? input.formats : []).slice(0, 6).map((format) => (SERIES_FORMATS.includes(format) ? format : 'single')),
    thirdPlace: input?.thirdPlace === true,
    seeds: seeds.map((seed) =>
      seed && typeof seed === 'object'
        ? {
            group: text(seed.group, 60),
            position: count(seed.position, 99) || 1,
            teamId: String(seed.teamId ?? '').replace(/\D/g, '').slice(0, 15),
            name: text(seed.name, 120),
            logo: /^https:\/\/[^\s"'<>]+$/.test(String(seed.logo ?? '')) ? String(seed.logo).slice(0, 500) : '',
          }
        : null,
    ),
    results,
    updatedAt: new Date().toISOString(),
  };
}

// Formularz zgłoszenia drużyny wgrany w panelu (przycisk „Zgłoś zespół”): plik (data URL) osobno od opisu (nazwa,
// rozmiar, adres), który trafia do treści wczytywanej przez każdego odwiedzającego.
const FORM_KEY = `${client.storagePrefix}:registration-form`;
const FORM_META_KEY = `${client.storagePrefix}:registration-form-meta`;
// Pojedyncze zapytanie do Upstash ma limit 1 MB, a base64 powiększa plik o 1/3 — plik do ok. 700 KB.
const MAX_FORM_LENGTH = 950000;
const FORM_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
};
// Logo drużyny w edycji wgrane w panelu (data URL) — osobno od listy nazw, żeby lista (wczytywana przez każdego
// odwiedzającego) była lekka. Strona pobiera logo z /api/admin?action=team-logo (z długą pamięcią podręczną).
const teamLogoKey = (teamId, editionId) => `${client.storagePrefix}:team-logo:${teamId}:${editionId}`;
// Odwiedziny strony: hasz na dzień (czas polski) z polami visits (wejście na stronę — pierwsza podstrona w karcie
// przeglądarki) i views (każda podstrona). Bez ciasteczek i danych osobowych — same liczniki. Miesiące to sumy dni.
const visitsKey = (day) => `${client.storagePrefix}:visits:${day}`;
const warsawDay = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: client.timeZone }).format(date);
const VISIT_DAYS = 400;

// Rekordy rozgrywek przeliczone w panelu (GeniusRecords czyta je zamiast liczyć w przeglądarce odwiedzającego).
const recordsKey = (cid) => `${client.storagePrefix}:records:${cid}`;
const RECORD_FIELDS = ['pts', 'reb', 'ast'];
const MAX_RECORDS_LENGTH = 60000;
// Listy drużyn i zawodników zamkniętych edycji Genius (zakładka „Sezony Genius”, czyta je geniusIndex na stronie).
const geniusHistoryKey = () => `${client.storagePrefix}:genius-history`;
const MAX_GENIUS_HISTORY_LENGTH = 900000;

// Wiersz rekordu z przeglądarki administratora: tylko znane pola, przycięte teksty i liczby.
const recordRow = (row) => ({
  playerId: String(row?.playerId ?? '').replace(/\D/g, '').slice(0, 15),
  player: text(row?.player, 100),
  team: text(row?.team, 120),
  opponent: text(row?.opponent, 120),
  matchId: String(row?.matchId ?? '').replace(/\D/g, '').slice(0, 15),
  date: text(row?.date, 40),
  ...Object.fromEntries(RECORD_FIELDS.map((field) => [field, Math.max(0, Math.min(999, Number(row?.[field]) || 0))])),
});

const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_LOGO_LENGTH = 300000;

// Baza Upstash Redis podpięta do projektu Vercela (integracja dodaje zmienne KV_* albo UPSTASH_REDIS_REST_*).
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Klucz podpisu sesji: ADMIN_SECRET, a bez niego skrót tokenu bazy (tajny, znany tylko serwerowi). Bez bazy
// (serwer deweloperski) losowy — sesje kończą się wtedy z restartem serwera.
const sessionSecret =
  process.env.ADMIN_SECRET || (redisToken ? crypto.createHash('sha256').update(`${client.storagePrefix}-admin:${redisToken}`).digest('hex') : crypto.randomBytes(32).toString('hex'));

export function redisStore() {
  if (!redisUrl || !redisToken) return undefined;
  const command = async (args) => {
    const response = await fetch(redisUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`Upstash: ${response.status}`);
    return (await response.json()).result;
  };
  return {
    get: async (key) => {
      const value = await command(['GET', key]);
      return value ? JSON.parse(value) : undefined;
    },
    set: (key, value) => command(['SET', key, JSON.stringify(value)]),
    // Licznik w haszu (odwiedziny dnia: pola visits i views) — jedno polecenie na zdarzenie.
    increment: (key, field) => command(['HINCRBY', key, field, '1']),
    // Wiele haszy jednym zapytaniem (pipeline Upstash) → [{ pole: liczba }].
    readCounters: async (keys) => {
      if (keys.length === 0) return [];
      const response = await fetch(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(keys.map((key) => ['HGETALL', key])),
      });
      if (!response.ok) throw new Error(`Upstash: ${response.status}`);
      return (await response.json()).map(({ result }) => {
        const counters = {};
        for (let i = 0; i + 1 < (result ?? []).length; i += 2) counters[result[i]] = Number(result[i + 1]) || 0;
        return counters;
      });
    },
  };
}

export function fileStore(file) {
  const read = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
  const write = (data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 1));
  };
  return {
    get: async (key) => read()[key],
    set: async (key, value) => {
      const data = read();
      data[key] = value;
      write(data);
    },
    increment: async (key, field) => {
      const data = read();
      data[key] = { ...data[key], [field]: (data[key]?.[field] ?? 0) + 1 };
      write(data);
    },
    readCounters: async (keys) => {
      const data = read();
      return keys.map((key) => data[key] ?? {});
    },
  };
}

// Sesja: "<wygaśnięcie>.<podpis HMAC>" w ciasteczku HttpOnly.
const sign = (value) => crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');

function sessionToken(seconds) {
  const expires = String(Math.floor(Date.now() / 1000) + seconds);
  return `${expires}.${sign(expires)}`;
}

function validSession(cookieHeader) {
  const token = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === COOKIE)?.[1];
  const [expires, signature] = (token ?? '').split('.');
  if (!expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(signature, sign(expires));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Bez maxAge ciasteczko sesyjne — znika po zamknięciu przeglądarki (sam token i tak wygasa po SESSION_SECONDS).
const cookie = (value, maxAge, secure) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${maxAge === undefined ? '' : `; Max-Age=${maxAge}`}${secure ? '; Secure' : ''}`;

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Treść wpisu z tekstu: akapity rozdzielone pustą linią, pojedyncze przejścia do nowej linii, adresy jako linki.
// HTML budujemy sami (tekst jest escapowany), więc administrator nie wstawi do strony skryptu.
function newsHtml(body) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph)
          .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`)
          .replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

const excerptOf = (body) => {
  const plain = body.replace(/\s+/g, ' ').trim();
  return plain.length > 220 ? `${plain.slice(0, 217).replace(/\s+\S*$/, '')}…` : plain;
};

const polish = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => polish[ch])
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'wpis';

const fail = (status, error) => ({ status, body: { error } });

// Obsługa zapytania niezależna od serwera: { method, action, body, cookie, secure } → { status, body, setCookie }.
// Odpowiedź może też być plikiem (binary: { contentType, data }) — logo drużyny.
export async function handleAdmin({ method, action, query = {}, body = {}, cookie: cookieHeader, secure = false, store }) {
  if (action === 'session') return { status: 200, body: { admin: validSession(cookieHeader) } };

  // Licznik odwiedzin (publiczny). Wejścia zalogowanego administratora nie liczymy.
  if (action === 'hit') {
    if (method !== 'POST' || !store?.increment || validSession(cookieHeader)) return { status: 204 };
    const key = visitsKey(warsawDay(new Date()));
    await store.increment(key, 'views');
    if (body.visit === true) await store.increment(key, 'visits');
    return { status: 204 };
  }

  if (action === 'records') {
    const cid = /^\d+$/.test(query.cid ?? '') ? query.cid : undefined;
    const records = store && cid ? await store.get(recordsKey(cid)) : undefined;
    return { status: 200, body: { records: records ?? null } };
  }

  // Osiągnięcia (strony zawodnika i drużyny, panel) — poza treścią wczytywaną przy każdej wizycie, bo rosną z każdą
  // edycją. Odpowiedź leży chwilę w pamięci serwera Vercela: po zapisie strona zobaczy zmiany najpóźniej po 5 minutach.
  if (action === 'achievements') {
    return { status: 200, body: { achievements: store ? await readAchievements(store) : {} }, cacheControl: 'public, max-age=0, s-maxage=300' };
  }

  // Nagrania meczów — zmieniają się rzadko, więc odpowiedź leży chwilę w pamięci serwera Vercela.
  if (action === 'match-videos') {
    const videos = store ? await store.get(MATCH_VIDEOS_KEY) : undefined;
    return { status: 200, body: { videos: videos ?? {} }, cacheControl: 'public, max-age=0, s-maxage=120' };
  }

  // Listy zamkniętych edycji — nie zmieniają się, więc odpowiedź może chwilę poleżeć w pamięci serwera (CDN Vercela,
  // s-maxage): po zapisie w panelu strona zobaczy nowe listy najpóźniej po 5 minutach. Przeglądarka pyta za każdym
  // razem (max-age=0, bez stale-while-revalidate, które przeglądarki też stosują i pokazywały stare listy).
  if (action === 'genius-history') {
    const history = store ? await store.get(geniusHistoryKey()) : undefined;
    return { status: 200, body: { history: history ?? null }, cacheControl: 'public, max-age=0, s-maxage=300' };
  }

  if (action === 'team-logo') {
    const logo = store && /^\d+$/.test(query.team ?? '') && /^[\d-]+$/.test(query.edition ?? '') ? await store.get(teamLogoKey(query.team, query.edition)) : undefined;
    const match = typeof logo === 'string' ? logo.match(/^data:(image\/[a-z+]+);base64,(.+)$/) : null;
    if (!match) return fail(404, 'Brak logo.');
    // Adres logo zawiera znacznik wersji (v), więc przeglądarka może je trzymać bez sprawdzania.
    return { status: 200, binary: { contentType: match[1], data: Buffer.from(match[2], 'base64') }, cacheControl: 'public, max-age=31536000, immutable' };
  }

  if (action === 'registration-form') {
    const form = store ? await store.get(FORM_KEY) : undefined;
    const match = typeof form?.data === 'string' ? form.data.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/) : null;
    if (!match) return fail(404, 'Brak formularza.');
    // Nazwa pliku w nagłówku: wersja ASCII i pełna (RFC 5987) dla polskich znaków.
    const ascii = form.name.replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'formularz';
    return {
      status: 200,
      binary: { contentType: match[1], data: Buffer.from(match[2], 'base64'), disposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(form.name)}` },
      cacheControl: 'public, max-age=31536000, immutable',
    };
  }

  if (action === 'content') {
    if (!store) return { status: 200, body: { news: [], teamNames: [] } };
    const [news, teamNames, registrationForm, zones, playoffs] = await Promise.all([
      store.get(NEWS_KEY),
      store.get(TEAM_NAMES_KEY),
      store.get(FORM_META_KEY),
      store.get(ZONES_KEY),
      store.get(PLAYOFFS_KEY),
    ]);
    return {
      status: 200,
      body: {
        news: news ?? [],
        teamNames: teamNames ?? [],
        registrationForm: registrationForm ?? null,
        zones: zones ?? {},
        playoffs: playoffs ?? {},
      },
    };
  }

  if (action === 'visits') {
    if (!validSession(cookieHeader)) return fail(401, 'Sesja wygasła — zaloguj się ponownie.');
    if (!store?.readCounters) return fail(503, 'Baza nie obsługuje liczników.');
    const days = Array.from({ length: VISIT_DAYS }, (_, i) => warsawDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
    const counters = await store.readCounters(days.map(visitsKey));
    return {
      status: 200,
      body: { today: days[0], days: days.map((day, i) => ({ day, visits: counters[i].visits ?? 0, views: counters[i].views ?? 0 })) },
    };
  }

  if (method !== 'POST') return fail(405, 'Niedozwolona metoda.');

  if (action === 'login') {
    // Oba porównania zawsze (w stałym czasie), żeby czas odpowiedzi nie zdradzał, które pole jest błędne.
    const password = adminPassword();
    if (!password) return fail(503, 'Logowanie wyłączone: brak hasła administratora (ADMIN_PASSWORD) w konfiguracji serwera.');
    const loginOk = safeEqual(text(body.login, 100), adminLogin());
    const passwordOk = safeEqual(typeof body.password === 'string' ? body.password : '', password);
    if (!loginOk || !passwordOk) {
      // Spowolnienie prób zgadywania hasła.
      await new Promise((resolve) => setTimeout(resolve, 600));
      return fail(401, 'Nieprawidłowy login lub hasło.');
    }
    const remember = body.remember === true;
    return {
      status: 200,
      body: { admin: true },
      setCookie: remember ? cookie(sessionToken(REMEMBER_SECONDS), REMEMBER_SECONDS, secure) : cookie(sessionToken(SESSION_SECONDS), undefined, secure),
    };
  }

  if (action === 'logout') return { status: 200, body: { admin: false }, setCookie: cookie('', 0, secure) };

  if (!validSession(cookieHeader)) return fail(401, 'Sesja wygasła — zaloguj się ponownie.');

  // Podgląd aktualności: wpis zbudowany jak przy publikacji, ale bez zapisu (działa też bez bazy).
  if (action === 'news-preview') {
    const title = text(body.title, 200);
    const content = text(body.body, 20000);
    const now = new Date();
    return {
      status: 200,
      body: {
        item: {
          slug: 'podglad',
          title,
          date: warsawDay(now),
          publishedAt: now.toISOString(),
          category: text(body.category, 40),
          excerpt: excerptOf(content),
          html: newsHtml(content),
          image: text(body.image, 500),
          source: '',
        },
      },
    };
  }
  if (!store) return fail(503, 'Brak bazy danych: podłącz Upstash Redis do projektu Vercela.');

  if (action === 'news-add' || action === 'news-update') {
    const title = text(body.title, 200);
    const content = text(body.body, 20000);
    // Data i godzina publikacji — zawsze bieżące (przy dodaniu i przy edycji), nie wybierane w formularzu.
    const now = new Date();
    const date = warsawDay(now);
    const image = text(body.image, 500);
    // Temat (etykieta z listy na stronie); pusty = temat ustalany z tytułu.
    const category = text(body.category, 40);
    if (!title || !content) return fail(400, 'Podaj tytuł i treść.');
    if (image && !/^(https:\/\/|\/)[^\s"'<>]+$/.test(image)) return fail(400, 'Adres okładki musi zaczynać się od https://.');
    const news = (await store.get(NEWS_KEY)) ?? [];
    const fields = { title, date, publishedAt: now.toISOString(), category, excerpt: excerptOf(content), html: newsHtml(content), image, body: content };

    // Edycja: adres wpisu (slug) zostaje ten sam, żeby udostępnione linki dalej działały.
    if (action === 'news-update') {
      const current = news.find((item) => item.slug === body.slug);
      if (!current) return fail(404, 'Nie ma takiej aktualności (mogła zostać usunięta).');
      const item = { ...current, ...fields, updatedAt: new Date().toISOString() };
      await store.set(
        NEWS_KEY,
        news.map((entry) => (entry.slug === current.slug ? item : entry)),
      );
      return { status: 200, body: { item } };
    }

    // reservedSlugs (od strony): adresy wpisów przeniesionych z dalk.pl — nowy wpis nie może ich zasłonić.
    const reserved = Array.isArray(body.reservedSlugs) ? body.reservedSlugs.filter((slug) => typeof slug === 'string') : [];
    const taken = new Set([...reserved, ...news.map((item) => item.slug)]);
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const item = { slug, ...fields, source: '', createdAt: new Date().toISOString() };
    await store.set(NEWS_KEY, [item, ...news]);
    return { status: 200, body: { item } };
  }

  if (action === 'news-delete') {
    const news = (await store.get(NEWS_KEY)) ?? [];
    await store.set(
      NEWS_KEY,
      news.filter((item) => item.slug !== body.slug),
    );
    return { status: 200, body: { ok: true } };
  }

  if (action === 'registration-form-save') {
    const name = text(body.name, 120).replace(/[\\/"]/g, '_');
    const extension = name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
    const contentType = extension && FORM_TYPES[extension];
    if (!contentType) return fail(400, 'Formularz: plik PDF, DOC, DOCX, ODT albo RTF.');
    const data = typeof body.data === 'string' ? body.data : '';
    const base64 = data.match(/^data:[^;,]*;base64,([A-Za-z0-9+/=]+)$/)?.[1];
    if (!base64) return fail(400, 'Nie udało się odczytać pliku.');
    if (data.length > MAX_FORM_LENGTH) return fail(400, 'Plik jest za duży (maks. ok. 700 KB).');
    const uploadedAt = new Date().toISOString();
    const meta = {
      name,
      size: Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0),
      uploadedAt,
      url: `/api/admin?action=registration-form&v=${Date.parse(uploadedAt)}`,
    };
    await store.set(FORM_KEY, { name, data: `data:${contentType};base64,${base64}` });
    await store.set(FORM_META_KEY, meta);
    return { status: 200, body: { registrationForm: meta } };
  }

  if (action === 'registration-form-delete') {
    await store.set(FORM_META_KEY, null);
    await store.set(FORM_KEY, null);
    return { status: 200, body: { ok: true } };
  }

  // Strefy kilku rozgrywek naraz (cała edycja z formularza); 0 i 0 usuwa wpis.
  if (action === 'zones-save') {
    const zones = (await store.get(ZONES_KEY)) ?? {};
    for (const [cid, zone] of Object.entries(body.zones ?? {})) {
      if (!/^\d+$/.test(cid)) continue;
      const playoff = count(zone?.playoff, 30);
      const relegation = count(zone?.relegation, 30);
      // Osobne strefy grup (nazwa grupy → miejsca), gdy grupy mają różną liczbę drużyn.
      const groups = Object.fromEntries(
        Object.entries(zone?.groups && typeof zone.groups === 'object' ? zone.groups : {})
          .slice(0, 16)
          .map(([group, counts]) => [text(group, 60), { playoff: count(counts?.playoff, 30), relegation: count(counts?.relegation, 30) }])
          .filter(([group]) => group),
      );
      const hasGroups = Object.keys(groups).length > 0;
      const any = playoff || relegation || Object.values(groups).some((counts) => counts.playoff || counts.relegation);
      // show — oznaczać strefy w tabelach na stronie (strefa play-off służy też drabince, gdy jest ukryta).
      if (any) zones[cid] = { playoff, relegation, show: zone?.show === true, ...(hasGroups ? { groups } : {}) };
      else delete zones[cid];
    }
    await store.set(ZONES_KEY, zones);
    return { status: 200, body: { zones } };
  }

  if (action === 'playoff-save') {
    const cid = String(body.cid ?? '');
    if (!/^\d+$/.test(cid)) return fail(400, 'Nieprawidłowe rozgrywki.');
    const bracket = playoffBracket(body.bracket);
    if (!bracket) return fail(400, 'Drabinka musi mieć 2, 4, 8, 16 albo 32 miejsca.');
    const playoffs = (await store.get(PLAYOFFS_KEY)) ?? {};
    playoffs[cid] = bracket;
    await store.set(PLAYOFFS_KEY, playoffs);
    return { status: 200, body: { bracket } };
  }

  if (action === 'playoff-delete') {
    const playoffs = (await store.get(PLAYOFFS_KEY)) ?? {};
    delete playoffs[String(body.cid ?? '')];
    await store.set(PLAYOFFS_KEY, playoffs);
    return { status: 200, body: { ok: true } };
  }

  // Nagrania meczów: dopisanie (numer filmu) albo usunięcie (null) — reszta zostaje.
  if (action === 'match-videos-save') {
    const videos = (await store.get(MATCH_VIDEOS_KEY)) ?? {};
    let changed = 0;
    for (const [matchId, videoId] of Object.entries(body.videos ?? {}).slice(0, 500)) {
      if (!/^\d{1,15}$/.test(matchId)) continue;
      if (videoId === null) delete videos[matchId];
      else if (typeof videoId === 'string' && YOUTUBE_ID.test(videoId)) videos[matchId] = videoId;
      else continue;
      changed++;
    }
    await store.set(MATCH_VIDEOS_KEY, videos);
    return { status: 200, body: { videos, changed } };
  }

  // Osiągnięcia jednych rozgrywek (cała lista z formularza); pusta lista usuwa wpis.
  if (action === 'achievements-save') {
    const cid = String(body.cid ?? '');
    const editionId = String(body.editionId ?? '');
    if (!/^\d+$/.test(cid)) return fail(400, 'Nieprawidłowe rozgrywki.');
    if (!/^[\d-]{4,10}$/.test(editionId)) return fail(400, 'Nieprawidłowa edycja.');
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40).map(achievement).filter(Boolean);
    const edition = (await store.get(achievementsKey(editionId))) ?? {};
    if (items.length > 0) edition[cid] = items;
    else delete edition[cid];
    if (JSON.stringify(edition).length > MAX_ACHIEVEMENTS_LENGTH) return fail(400, 'Za dużo danych osiągnięć w tej edycji.');
    await store.set(achievementsKey(editionId), edition);
    const editions = (await store.get(ACHIEVEMENT_EDITIONS_KEY)) ?? [];
    if (!editions.includes(editionId)) await store.set(ACHIEVEMENT_EDITIONS_KEY, [...editions, editionId]);
    // Rozgrywki ze starego wspólnego wpisu są już we wpisie edycji.
    const legacy = await store.get(ACHIEVEMENTS_LEGACY_KEY);
    if (legacy && cid in legacy) {
      delete legacy[cid];
      await store.set(ACHIEVEMENTS_LEGACY_KEY, Object.keys(legacy).length > 0 ? legacy : null);
    }
    return { status: 200, body: { achievements: await readAchievements(store) } };
  }

  if (action === 'records-save') {
    const cid = String(body.cid ?? '');
    if (!/^\d+$/.test(cid)) return fail(400, 'Nieprawidłowe rozgrywki.');
    const top = Object.fromEntries(
      RECORD_FIELDS.map((field) => [field, (Array.isArray(body.top?.[field]) ? body.top[field] : []).slice(0, 20).map(recordRow)]),
    );
    const records = {
      cid: Number(cid),
      computedAt: new Date().toISOString(),
      matchCount: Math.max(0, Number(body.matchCount) || 0),
      failedCount: Math.max(0, Number(body.failedCount) || 0),
      top,
    };
    if (JSON.stringify(records).length > MAX_RECORDS_LENGTH) return fail(400, 'Za dużo danych rekordów.');
    await store.set(recordsKey(cid), records);
    return { status: 200, body: { records } };
  }

  // Nowe listy zamkniętych edycji (z przeglądarki administratora) dopisujemy do zapisanych wcześniej.
  if (action === 'genius-history-save') {
    const lists = Object.entries(body.lists ?? {}).filter(
      ([key, ids]) => /^(teams|players|played):\d+$/.test(key) && Array.isArray(ids) && ids.length > 0 && ids.every((id) => /^\d+$/.test(String(id))),
    );
    if (lists.length === 0) return fail(400, 'Brak list do zapisania.');
    const teamNames = Object.entries(body.teamNames ?? {}).filter(([id, name]) => /^\d+$/.test(id) && typeof name === 'string' && name.length <= 200);
    const previous = (await store.get(geniusHistoryKey())) ?? { lists: {}, teamNames: {} };
    const history = {
      createdAt: new Date().toISOString(),
      lists: { ...previous.lists, ...Object.fromEntries(lists.map(([key, ids]) => [key, ids.map(String)])) },
      teamNames: { ...previous.teamNames, ...Object.fromEntries(teamNames) },
    };
    if (JSON.stringify(history).length > MAX_GENIUS_HISTORY_LENGTH) return fail(400, 'Za dużo danych list.');
    await store.set(geniusHistoryKey(), history);
    return { status: 200, body: { saved: lists.length } };
  }

  if (action === 'team-name-save') {
    const teamId = text(body.teamId, 20);
    const editionId = text(body.editionId, 20);
    const name = text(body.name, 120);
    const geniusName = text(body.geniusName, 120);
    if (!/^\d+$/.test(teamId) || !/^[\d-]+$/.test(editionId)) return fail(400, 'Wybierz edycję i drużynę.');
    if (!name || !geniusName) return fail(400, 'Podaj nazwę drużyny w tej edycji.');
    const all = (await store.get(TEAM_NAMES_KEY)) ?? [];
    const current = all.find((entry) => entry.teamId === teamId && entry.editionId === editionId);
    // Logo: "keep" (bez zmian), pusty tekst (bez logo — jak w Genius), adres https albo wgrany obrazek (data URL).
    const logoInput = typeof body.logo === 'string' ? body.logo.trim() : '';
    let logo;
    if (logoInput === 'keep') logo = current?.logo;
    else if (LOGO_DATA_URL.test(logoInput)) {
      if (logoInput.length > MAX_LOGO_LENGTH) return fail(400, 'Logo jest za duże (maks. ok. 200 KB).');
      await store.set(teamLogoKey(teamId, editionId), logoInput);
      logo = `/api/admin?action=team-logo&team=${teamId}&edition=${editionId}&v=${Date.now()}`;
    } else if (/^https:\/\/[^\s"'<>]+$/.test(logoInput) && logoInput.length <= 500) logo = logoInput;
    else if (logoInput) return fail(400, 'Logo: wgraj obrazek albo podaj adres zaczynający się od https://.');
    if (!logo?.startsWith('/api/')) await store.set(teamLogoKey(teamId, editionId), null);
    const names = all.filter((entry) => entry !== current);
    const entry = { teamId, editionId, name, geniusName, ...(logo ? { logo } : {}), updatedAt: new Date().toISOString() };
    await store.set(TEAM_NAMES_KEY, [...names, entry]);
    return { status: 200, body: { entry } };
  }

  if (action === 'team-name-delete') {
    const names = (await store.get(TEAM_NAMES_KEY)) ?? [];
    await store.set(
      TEAM_NAMES_KEY,
      names.filter((entry) => !(entry.teamId === body.teamId && entry.editionId === body.editionId)),
    );
    if (/^\d+$/.test(String(body.teamId)) && /^[\d-]+$/.test(String(body.editionId))) await store.set(teamLogoKey(body.teamId, body.editionId), null);
    return { status: 200, body: { ok: true } };
  }

  return fail(404, 'Nieznana operacja.');
}
