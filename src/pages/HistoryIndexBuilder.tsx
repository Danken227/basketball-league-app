import client from '@client/client';
import { useEffect, useRef, useState } from 'react';
import { currentGeniusEdition, isGeniusDomain } from '../components/genius/geniusConfig';
import { fetchGeniusJson } from '../components/genius/geniusFetch';
import { indexedCompetitions, type HistoryFile, type IndexKind } from '../components/genius/geniusIndex';

// Plik z listami drużyn i zawodników zamkniętych edycji (genius-history.json, czyta go geniusIndex) — tylko serwer
// deweloperski, adres /__indeks na dev.dalk.pl. Uruchamia się raz po dodaniu nowej edycji w konfiguracji klienta:
// poprzednia bieżąca edycja staje się zamknięta, a jej listy już się nie zmienią. Pyta Genius po jednej liście naraz,
// z przerwami, a plik zapisuje wtyczka w vite.config.ts.

const PAUSE_MS = 1000;
const ATTEMPTS = 3;

const pastCompetitions = indexedCompetitions.filter((c) => c.editionId !== currentGeniusEdition.id);
const tasks = pastCompetitions.flatMap(({ cid }) => (['teams', 'players'] as IndexKind[]).map((kind) => ({ kind, cid })));
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Numery z linków Genius (".../team/123", ".../person/456", także zakodowane w parametrze WHurl) i nazwy drużyn.
function readList(html: string, kind: IndexKind) {
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

async function loadList(kind: IndexKind, cid: number) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const json = await fetchGeniusJson(`/competition/${cid}/${kind}`, { showSubMenus: false }).catch(() => undefined);
    // Pusta strona (przy przeciążeniu Genius) nie ma klasy rozgrywek — wtedy próbujemy jeszcze raz.
    if (json?.html?.includes(`_comp_${cid}`)) {
      const list = readList(json.html, kind);
      if (list.ids.length > 0) return list;
    }
    await sleep(PAUSE_MS * attempt * 3);
  }
  return undefined;
}

function HistoryIndexBuilder() {
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [result, setResult] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !isGeniusDomain()) return;
    started.current = true;
    (async () => {
      const file: HistoryFile = { createdAt: new Date().toISOString(), lists: {}, teamNames: {} };
      for (const { kind, cid } of tasks) {
        const list = await loadList(kind, cid);
        if (list) {
          file.lists[`${kind}:${cid}`] = list.ids;
          Object.assign(file.teamNames, list.names);
        } else {
          setFailed((all) => [...all, `${kind}:${cid}`]);
        }
        setDone((count) => count + 1);
        await sleep(PAUSE_MS);
      }
      const response = await fetch('/__genius-history/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(file) });
      setResult(response.ok ? `Zapisano: ${Object.keys(file.lists).length} list, ${(await response.text()).trim()}` : `Błąd zapisu: ${response.status}`);
    })();
  }, []);

  if (!isGeniusDomain()) {
    return <p className="mx-auto max-w-3xl p-8 text-sm">Listy zbiera się na domenie ligi (np. http://{client.site.devHost}:5180/__indeks).</p>;
  }
  return (
    <div className="mx-auto max-w-3xl p-8 text-sm">
      <h1 className="text-xl font-bold">Listy zamkniętych edycji</h1>
      <p className="mt-2 text-slate-600">
        Edycje: {[...new Set(pastCompetitions.map((c) => c.editionId))].join(', ')} · listy: {done} z {tasks.length} · błędy: {failed.length}
      </p>
      {result && <p className="mt-2 font-semibold">{result}</p>}
      {failed.length > 0 && (
        <p className="mt-2 text-red-700">
          Bez listy (strona poszuka ich w Genius): {failed.join(', ')}
        </p>
      )}
    </div>
  );
}

export default HistoryIndexBuilder;
