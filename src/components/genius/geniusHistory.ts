// Zbieranie list drużyn i zawodników zamkniętych edycji (zakładka „Sezony Genius” w panelu administratora).
// Pyta Genius w przeglądarce administratora (na domenie ligi), po jednej liście naraz, i zapisuje w bazie panelu
// tylko edycje, których nie ma jeszcze w pliku genius-history.json ani w bazie (czyta je geniusIndex).
import { adminRequest } from '../../data/siteContent';
import { geniusEditionById } from './geniusConfig';
import { fetchGeniusJson } from './geniusFetch';
import { fetchHistorySources, historyKinds, pastCompetitions, type HistoryFile, type HistoryKind } from './geniusIndex';

const PAUSE_MS = 1000;
const ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Strona Genius z listą danego rodzaju: drużyny, zawodnicy (skład) i zestawienie statystyk (tylko ci, którzy zagrali).
const listPage: Record<HistoryKind, string> = { teams: 'teams', players: 'players', played: 'statistics/player' };

export interface EditionCoverage {
  editionId: string;
  name: string;
  // Rozgrywki edycji bez kompletu list (drużyny, zawodnicy, występy).
  missing: number[];
}

// Zamknięte edycje i to, czego z nich brakuje w obu źródłach list.
export async function historyCoverage(): Promise<EditionCoverage[]> {
  const files = await fetchHistorySources(true);
  const has = (key: string) => files.some((file) => (file.lists?.[key]?.length ?? 0) > 0);
  const editionIds = [...new Set(pastCompetitions.map((c) => c.editionId))];
  return editionIds.map((editionId) => ({
    editionId,
    name: geniusEditionById.get(editionId)?.name ?? editionId,
    missing: pastCompetitions
      .filter((c) => c.editionId === editionId && historyKinds.some((kind) => !has(`${kind}:${c.cid}`)))
      .map((c) => c.cid),
  }));
}

// Numery z linków Genius (".../team/123", ".../person/456", także zakodowane w parametrze WHurl) i nazwy drużyn.
function readList(html: string, kind: HistoryKind) {
  const root = new DOMParser().parseFromString(html, 'text/html').body;
  const pattern = kind === 'teams' ? /\/team\/(\d+)/ : /\/person\/(\d+)/;
  const ids = new Set<string>();
  const names: Record<string, string> = {};
  root.querySelectorAll('a[href]').forEach((link) => {
    const id = decodeURIComponent(link.getAttribute('href')!).match(pattern)?.[1];
    if (!id) return;
    ids.add(id);
    const name = link.textContent?.replace(/\s+/g, ' ').trim();
    if (kind === 'teams' && name && !names[id]) names[id] = name;
  });
  return { ids: [...ids], names };
}

async function loadList(kind: HistoryKind, cid: number) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const json = await fetchGeniusJson(`/competition/${cid}/${listPage[kind]}`, { showSubMenus: false }).catch(() => undefined);
    // Pusta strona (przy przeciążeniu Genius) nie ma klasy rozgrywek — wtedy próbujemy jeszcze raz.
    if (json?.html?.includes(`_comp_${cid}`)) {
      const list = readList(json.html, kind);
      if (list.ids.length > 0) return list;
    }
    await sleep(PAUSE_MS * attempt * 3);
  }
  return undefined;
}

// Brakujące listy wskazanych rozgrywek z Genius → baza panelu (listy już zapisane pomijamy). Zwraca listy,
// których nie udało się pobrać.
export async function collectHistory(cids: number[], onProgress: (done: number, total: number) => void): Promise<string[]> {
  const files = await fetchHistorySources(true);
  const has = (key: string) => files.some((file) => (file.lists?.[key]?.length ?? 0) > 0);
  const tasks = cids.flatMap((cid) => historyKinds.map((kind) => ({ kind, cid }))).filter(({ kind, cid }) => !has(`${kind}:${cid}`));
  const file: Pick<HistoryFile, 'lists' | 'teamNames'> = { lists: {}, teamNames: {} };
  const failed: string[] = [];
  for (const [done, { kind, cid }] of tasks.entries()) {
    onProgress(done, tasks.length);
    const list = await loadList(kind, cid);
    if (list) {
      file.lists[`${kind}:${cid}`] = list.ids;
      Object.assign(file.teamNames, list.names);
    } else {
      failed.push(`${kind}:${cid}`);
    }
    await sleep(PAUSE_MS);
  }
  onProgress(tasks.length, tasks.length);
  if (Object.keys(file.lists).length > 0) await adminRequest('genius-history-save', file);
  return failed;
}
