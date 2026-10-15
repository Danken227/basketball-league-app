// Treści dodawane przez administratora (panel /admin): aktualności i nazwy drużyn w poszczególnych edycjach.
// Zapisuje je serwer (/api/admin — na Vercelu baza Upstash Redis, na serwerze deweloperskim plik JSON); strona
// wczytuje je raz i dokleja do treści przeniesionych z dalk.pl oraz danych Genius.
import { useSyncExternalStore } from 'react';
import { news as dalkNews, type NewsItem } from './news';
import { teamName } from '../components/genius/geniusIndex';
import type { PlayoffBracket, StandingsZone } from './playoff';

export interface AddedNewsItem extends NewsItem {
  // Treść wpisana przez administratora (z niej serwer zbudował html).
  body: string;
  createdAt: string;
}

// Nazwa drużyny w edycji. Genius pokazuje we wszystkich edycjach najnowszą nazwę drużyny (geniusName) — w treści
// stron tej edycji zamieniamy ją na nazwę, pod którą drużyna wtedy grała.
export interface TeamNameEntry {
  teamId: string;
  editionId: string;
  name: string;
  geniusName: string;
  // Logo z tamtego sezonu: adres obrazka (wgrany w panelu: /api/admin?action=team-logo…); bez niego logo z Genius.
  logo?: string;
  updatedAt: string;
}

// Formularz zgłoszenia drużyny wgrany w panelu (zastępuje plik z konfiguracji klienta).
export interface RegistrationForm {
  name: string;
  size: number;
  uploadedAt: string;
  url: string;
}

interface SiteContent {
  loaded: boolean;
  news: AddedNewsItem[];
  teamNames: TeamNameEntry[];
  registrationForm?: RegistrationForm;
  // Numer rozgrywek → strefy tabeli i drabinka play-off (zakładki „Awanse/spadki” i „Play-off” w panelu).
  zones: Record<string, StandingsZone>;
  playoffs: Record<string, PlayoffBracket>;
}

let content: SiteContent = { loaded: false, news: [], teamNames: [], zones: {}, playoffs: {} };
const listeners = new Set<() => void>();
let request: Promise<void> | undefined;

function setContent(next: SiteContent) {
  content = next;
  listeners.forEach((listener) => listener());
}

export async function adminRequest<T>(action: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const response = await fetch(`/api/admin?${new URLSearchParams({ action, ...query })}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Błąd serwera (${response.status}).`);
  return data;
}

// Wczytanie (albo ponowne, po zmianie w panelu). Bez serwera (np. podgląd builda) zostają same treści z dalk.pl.
export function reloadSiteContent() {
  request = adminRequest<{
    news: AddedNewsItem[];
    teamNames: TeamNameEntry[];
    registrationForm?: RegistrationForm | null;
    zones?: Record<string, StandingsZone>;
    playoffs?: Record<string, PlayoffBracket>;
  }>('content')
    .then((data) =>
      setContent({
        loaded: true,
        news: data.news ?? [],
        teamNames: data.teamNames ?? [],
        registrationForm: data.registrationForm ?? undefined,
        zones: data.zones ?? {},
        playoffs: data.playoffs ?? {},
      }),
    )
    .catch(() => setContent({ ...content, loaded: true }));
  return request;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!request) void reloadSiteContent();
  return () => listeners.delete(listener);
}

export const useSiteContent = () => useSyncExternalStore(subscribe, () => content);

// Wszystkie aktualności od najnowszej: dodane w panelu i przeniesione z dalk.pl (tego samego dnia dodane wyżej).
export function useNews(): NewsItem[] {
  const { news } = useSiteContent();
  // Ten sam dzień: późniejsza godzina wyżej, wpisy z dalk.pl (bez godziny) pod wpisami z panelu.
  return news.length === 0
    ? dalkNews
    : [...news, ...dalkNews].sort((a, b) => b.date.localeCompare(a.date) || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

// Drużyny wybranej edycji z inną nazwą (nazwa z Genius → nazwa w tej edycji) albo innym logo. Wpis dotyczy numeru
// drużyny: zamieniamy jej obecną nazwę z Genius (indeks drużyn), więc zmiana nazwy w Genius nie psuje wpisów.
// Nazwa zapisana w panelu zostaje jako zapas — gdy indeksu jeszcze nie ma albo ma nazwę sprzed zmiany (do doby).
export function teamRenames(teamNames: TeamNameEntry[], editionId: string | undefined) {
  if (!editionId) return [];
  return teamNames
    .filter((entry) => entry.editionId === editionId)
    .flatMap((entry) => [...new Set([teamName(entry.teamId), entry.geniusName])].flatMap((geniusName) => (geniusName ? [{ ...entry, geniusName }] : [])))
    .filter((entry) => entry.name !== entry.geniusName || entry.logo);
}

export const renameTeam = (name: string, renames: TeamNameEntry[]) => renames.find((entry) => entry.geniusName === name)?.name ?? name;

// Sesja administratora (ciasteczko HttpOnly — stan zna tylko serwer).
let admin: boolean | undefined;
const adminListeners = new Set<() => void>();
let sessionRequest: Promise<void> | undefined;

export function setAdmin(value: boolean) {
  admin = value;
  adminListeners.forEach((listener) => listener());
}

function subscribeAdmin(listener: () => void) {
  adminListeners.add(listener);
  sessionRequest ??= adminRequest<{ admin: boolean }>('session')
    .then((data) => setAdmin(data.admin))
    .catch(() => setAdmin(false));
  return () => adminListeners.delete(listener);
}

// undefined, dopóki serwer nie odpowie.
export const useAdmin = () => useSyncExternalStore(subscribeAdmin, () => admin);
