import { useEffect, useRef } from 'react';
import { GENIUS_WIDGET_URL } from './geniusConfig';

// Widget skonfigurowany w panelu Genius (np. pasek meczów na stronie głównej dalk.pl).
// Wstawiamy go tak jak dalk.pl: element "spw_<id>", pusta konfiguracja window.spw_<id> i skrypt widgetu.
function GeniusWidget({ widgetId }: { widgetId: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const configName = `spw_${widgetId}` as const;
    window[configName] = {};
    const script = document.createElement('script');
    script.async = true;
    script.src = `${GENIUS_WIDGET_URL}?${widgetId}`;
    // Opóźnienie chroni przed podwójnym wstawieniem w trybie deweloperskim React (jak w GeniusEmbed).
    const insert = window.setTimeout(() => document.body.appendChild(script), 0);
    const placeholder = ref.current;

    return () => {
      window.clearTimeout(insert);
      script.remove();
      delete window[configName];
      if (placeholder) placeholder.innerHTML = '';
    };
  }, [widgetId]);

  return <div id={`spw_${widgetId}`} ref={ref} className="genius-widget min-h-24" />;
}

export default GeniusWidget;
