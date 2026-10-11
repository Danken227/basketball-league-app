import { useEffect, useRef, useState } from 'react';
import GeniusEmbed from './GeniusEmbed';
import { geniusCacheKey, isGeniusCached, type GeniusEmbedOptions } from './geniusCache';
import { useForegroundReady } from './geniusPriority';

// Ile treści wczytujemy w tle naraz — więcej obciążałoby serwer Genius i spowalniało to, co użytkownik klika.
const PARALLEL = 2;
// GeniusEmbed zapisuje treść w pamięci 0,5 s po jej wstawieniu — dopiero potem odpinamy osadzenie.
const SAVE_DELAY_MS = 800;
// Treść, która nie przyszła (przeciążony serwer), nie blokuje kolejki.
const ITEM_TIMEOUT_MS = 20000;

function PrefetchItem({ item, onDone }: { item: GeniusEmbedOptions; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), loaded ? SAVE_DELAY_MS : ITEM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);
  return <GeniusEmbed {...item} onContent={(root) => root.querySelector('.hs-embed') && setLoaded(true)} />;
}

// Wczytywanie z wyprzedzeniem: gdy widoczne dane są już na ekranie (geniusPriority), osadza poza ekranem strony
// Genius dla pozostałych opcji filtrów, po PARALLEL naraz, w kolejności z listy (najpierw najbardziej
// prawdopodobne). Gotowe treści trafiają do pamięci (geniusCache), więc po przełączeniu filtra pokazują się od razu.
function GeniusPrefetch({ items }: { items: GeniusEmbedOptions[] }) {
  const ready = useForegroundReady();
  const [done, setDone] = useState<string[]>([]);
  // Treści zapamiętane wcześniej pomijamy (np. obejrzane już w tej wizycie).
  const todo = items.filter((item) => !done.includes(geniusCacheKey(item)) && !isGeniusCached(geniusCacheKey(item))).slice(0, PARALLEL);
  if (!ready || todo.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
      {todo.map((item) => {
        const key = geniusCacheKey(item);
        return <PrefetchItem key={key} item={item} onDone={() => setDone((prev) => (prev.includes(key) ? prev : [...prev, key]))} />;
      })}
    </div>
  );
}

export default GeniusPrefetch;
