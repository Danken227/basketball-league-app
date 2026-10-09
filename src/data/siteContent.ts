// Treści dodawane przez administratora (panel /admin): aktualności i nazwy drużyn w poszczególnych edycjach.
// Zapisuje je serwer (/api/admin — na Vercelu baza Upstash Redis, na serwerze deweloperskim plik JSON); strona
// wczytuje je raz i dokleja do treści przeniesionych z dalk.pl oraz danych Genius.
import { useSyncExternalStore } from 'react';
import { news as dalkNews, type NewsItem } from './news';

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
  updatedAt: string;
}

interface SiteContent {
  loaded: boolean;
  news: AddedNewsItem[];
  teamNames: TeamNameEntry[];
}

let content: SiteContent = { loaded: false, news: [], teamNames: [] };
const listeners = new Set<() => void>();
let request: Promise<void> | undefined;

function setContent(next: SiteContent) {
  content = next;
  listeners.forEach((listener) => listener());
}

export async function adminRequest<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin?action=${action}`, {
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
  request = adminRequest<{ news: AddedNewsItem[]; teamNames: TeamNameEntry[] }>('content')
    .then((data) => setContent({ loaded: true, news: data.news ?? [], teamNames: data.teamNames ?? [] }))
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
  return news.length === 0 ? dalkNews : [...news, ...dalkNews].sort((a, b) => b.date.localeCompare(a.date));
}

// Nazwy drużyn wybranej edycji: nazwa z Genius → nazwa w tej edycji.
export function teamRenames(teamNames: TeamNameEntry[], editionId: string | undefined) {
  return editionId ? teamNames.filter((entry) => entry.editionId === editionId && entry.name !== entry.geniusName) : [];
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
