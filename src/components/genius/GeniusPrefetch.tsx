import { useEffect, useState } from 'react';
import GeniusEmbed from './GeniusEmbed';
import { geniusCacheKey, isGeniusCached, type GeniusEmbedOptions } from './geniusCache';

// Wczytywanie z wyprzedzeniem: chwilę po wyświetleniu strony (żeby nie spowalniać tego, co widać)
// osadza poza ekranem strony Genius dla pozostałych opcji filtrów. Gotowe treści trafiają do pamięci
// (geniusCache), więc po przełączeniu filtra pokazują się od razu.
function GeniusPrefetch({ items, delay = 1500 }: { items: GeniusEmbedOptions[]; delay?: number }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  if (!ready) return null;
  // Lista liczona raz przy starcie; elementy już zapamiętane pomijamy.
  const todo = items.filter((item) => !isGeniusCached(geniusCacheKey(item)));

  return (
    <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-0 w-[1200px] overflow-hidden">
      {todo.map((item) => (
        <GeniusEmbed key={geniusCacheKey(item)} {...item} />
      ))}
    </div>
  );
}

export default GeniusPrefetch;
