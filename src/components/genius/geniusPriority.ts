// Kolejność wczytywania danych Genius: najpierw to, co widać (pasek meczów, tabela, strona drużyny lub zawodnika
// dla wybranej edycji), a dopiero potem dane w tle (inne ligi i edycje, indeks edycji drużyn i zawodników).
// Zadania w tle zaczynają się, gdy widoczne osadzenia Genius mają już treść, a pasek meczów karty — najpóźniej
// po MAX_WAIT_MS, żeby tło nie czekało w nieskończoność na przeciążony serwer.
import { useEffect, useState } from 'react';

const POLL_MS = 250;
const MAX_WAIT_MS = 5000;

// Osadzenia na ekranie: bez ukrytych źródeł danych (wrappery aria-hidden poza ekranem).
function foregroundLoaded() {
  const visible = [...document.querySelectorAll('main .genius-embed, main .genius-native')].filter((embed) => !embed.closest('[aria-hidden="true"]'));
  const embedsReady = visible.every((embed) => embed.querySelector('.hs-embed, .genius-cached') && !embed.querySelector('.genius-target > .genius-status'));
  const bar = document.querySelector('section[aria-label="Wyniki i najbliższe mecze"]');
  const barReady = !bar || Boolean(bar.querySelector('a[aria-label]'));
  return embedsReady && barReady;
}

// true, gdy można zaczynać wczytywanie w tle.
export function useForegroundReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    const started = Date.now();
    let streak = 0;
    const timer = window.setInterval(() => {
      // Dwa odczyty z rzędu — treść zdążyła się wstawić, a nie tylko mignąć między filtrami.
      streak = foregroundLoaded() ? streak + 1 : 0;
      if (streak >= 2 || Date.now() - started > MAX_WAIT_MS) setReady(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [ready]);
  return ready;
}
