// Panel administratora: logowanie oraz treści dodawane przez administratora (aktualności i nazwy drużyn w edycjach).
// Wspólne dla funkcji Vercela (api/admin.js, zapis w Upstash Redis) i serwera Vite (vite.config.ts, zapis do pliku
// JSON na dysku). Treści czyta każdy (strona je wyświetla), zmieniać może tylko zalogowany administrator.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Dane logowania ze zmiennych środowiskowych (repozytorium jest publiczne, więc hasła nie ma w kodzie): na Vercelu
// w ustawieniach projektu, na serwerze deweloperskim w .env.local. Bez ADMIN_PASSWORD logowanie jest wyłączone.
// Czytane przy każdym logowaniu — serwer Vite wczytuje .env.local dopiero po zaimportowaniu tego modułu.
const adminLogin = () => process.env.ADMIN_LOGIN || 'admin';
const adminPassword = () => process.env.ADMIN_PASSWORD;

const COOKIE = 'dalk_admin';
const SESSION_SECONDS = 12 * 60 * 60;

const NEWS_KEY = 'dalk:news';
const TEAM_NAMES_KEY = 'dalk:team-names';

// Baza Upstash Redis podpięta do projektu Vercela (integracja dodaje zmienne KV_* albo UPSTASH_REDIS_REST_*).
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Klucz podpisu sesji: ADMIN_SECRET, a bez niego skrót tokenu bazy (tajny, znany tylko serwerowi). Bez bazy
// (serwer deweloperski) losowy — sesje kończą się wtedy z restartem serwera.
const sessionSecret =
  process.env.ADMIN_SECRET || (redisToken ? crypto.createHash('sha256').update(`dalk-admin:${redisToken}`).digest('hex') : crypto.randomBytes(32).toString('hex'));

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
  };
}

export function fileStore(file) {
  const read = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
  return {
    get: async (key) => read()[key],
    set: async (key, value) => {
      const data = read();
      data[key] = value;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 1));
    },
  };
}

// Sesja: "<wygaśnięcie>.<podpis HMAC>" w ciasteczku HttpOnly.
const sign = (value) => crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');

function sessionToken() {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
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

const cookie = (value, maxAge, secure) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

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
export async function handleAdmin({ method, action, body = {}, cookie: cookieHeader, secure = false, store }) {
  if (action === 'session') return { status: 200, body: { admin: validSession(cookieHeader) } };

  if (action === 'content') {
    if (!store) return { status: 200, body: { news: [], teamNames: [] } };
    const [news, teamNames] = await Promise.all([store.get(NEWS_KEY), store.get(TEAM_NAMES_KEY)]);
    return { status: 200, body: { news: news ?? [], teamNames: teamNames ?? [] } };
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
    return { status: 200, body: { admin: true }, setCookie: cookie(sessionToken(), SESSION_SECONDS, secure) };
  }

  if (action === 'logout') return { status: 200, body: { admin: false }, setCookie: cookie('', 0, secure) };

  if (!validSession(cookieHeader)) return fail(401, 'Sesja wygasła — zaloguj się ponownie.');
  if (!store) return fail(503, 'Brak bazy danych: podłącz Upstash Redis do projektu Vercela.');

  if (action === 'news-add') {
    const title = text(body.title, 200);
    const content = text(body.body, 20000);
    const date = text(body.date, 10);
    const image = text(body.image, 500);
    if (!title || !content) return fail(400, 'Podaj tytuł i treść.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Nieprawidłowa data.');
    if (image && !/^(https:\/\/|\/)[^\s"'<>]+$/.test(image)) return fail(400, 'Adres okładki musi zaczynać się od https://.');
    const news = (await store.get(NEWS_KEY)) ?? [];
    // reservedSlugs (od strony): adresy wpisów przeniesionych z dalk.pl — nowy wpis nie może ich zasłonić.
    const reserved = Array.isArray(body.reservedSlugs) ? body.reservedSlugs.filter((slug) => typeof slug === 'string') : [];
    const taken = new Set([...reserved, ...news.map((item) => item.slug)]);
    const base = slugify(title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const item = { slug, title, date, excerpt: excerptOf(content), html: newsHtml(content), image, source: '', body: content, createdAt: new Date().toISOString() };
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

  if (action === 'team-name-save') {
    const teamId = text(body.teamId, 20);
    const editionId = text(body.editionId, 20);
    const name = text(body.name, 120);
    const geniusName = text(body.geniusName, 120);
    if (!/^\d+$/.test(teamId) || !/^[\d-]+$/.test(editionId)) return fail(400, 'Wybierz edycję i drużynę.');
    if (!name || !geniusName) return fail(400, 'Podaj nazwę drużyny w tej edycji.');
    const names = ((await store.get(TEAM_NAMES_KEY)) ?? []).filter((entry) => !(entry.teamId === teamId && entry.editionId === editionId));
    const entry = { teamId, editionId, name, geniusName, updatedAt: new Date().toISOString() };
    await store.set(TEAM_NAMES_KEY, [...names, entry]);
    return { status: 200, body: { entry } };
  }

  if (action === 'team-name-delete') {
    const names = (await store.get(TEAM_NAMES_KEY)) ?? [];
    await store.set(
      TEAM_NAMES_KEY,
      names.filter((entry) => !(entry.teamId === body.teamId && entry.editionId === body.editionId)),
    );
    return { status: 200, body: { ok: true } };
  }

  return fail(404, 'Nieznana operacja.');
}
