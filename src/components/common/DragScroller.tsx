import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

// Poziomy pasek kart: strzałki, przeciąganie myszą i natywne przewijanie palcem.
// Na start ustawia się na elemencie oznaczonym data-divider (granica wyników i najbliższych meczów).
// resetKey: zmiana (np. filtra) ponownie ustawia pozycję startową.
export function DragScroller({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const divider = el.querySelector<HTMLElement>('[data-divider]');
    el.scrollLeft = divider ? Math.max(0, divider.offsetLeft - el.clientWidth / 2) : 0;
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [resetKey]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  // Przeciąganie myszą; dotyk obsługuje natywne przewijanie przeglądarki.
  // Wskaźnik przejmujemy dopiero po kilku pikselach ruchu, żeby zwykłe kliknięcie w link działało,
  // a kliknięcie kończące przeciąganie blokujemy, żeby nie otwierało linku.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    drag.current = { x: e.clientX, scrollLeft: e.currentTarget.scrollLeft, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (!drag.current.moved && Math.abs(dx) > 5) {
      drag.current.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (drag.current.moved) e.currentTarget.scrollLeft = drag.current.scrollLeft - dx;
  };
  const onPointerUp = () => {
    suppressClick.current = drag.current?.moved ?? false;
    drag.current = null;
  };
  const onClickCapture = (e: MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const arrowClass =
    'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-orange-500 hover:text-slate-950 disabled:pointer-events-none disabled:opacity-30';

  return (
    // min-w-0: w wierszu z innymi elementami (np. logo źródła) pasek ma zostać w swojej kolumnie i przewijać się.
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button type="button" className={`${arrowClass} hidden sm:grid`} aria-label="Przewiń w lewo" disabled={edges.start} onClick={() => scrollBy(-1)}>
        ‹
      </button>
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        // Odstęp z każdej strony: obwódka kafelków (ring) jest rysowana na zewnątrz i bez niego przycina ją przewijanie.
        className="relative flex flex-1 cursor-grab touch-pan-x select-none gap-3 overflow-x-auto p-1 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button type="button" className={`${arrowClass} hidden sm:grid`} aria-label="Przewiń w prawo" disabled={edges.end} onClick={() => scrollBy(1)}>
        ›
      </button>
    </div>
  );
}

// Pionowy podpis grupy kart (np. "Wyniki", "Najbliższe").
export function GroupLabel({ children }: { children: string }) {
  return (
    <div className="flex w-8 shrink-0 items-center justify-center">
      <span className="rotate-180 text-[11px] font-semibold uppercase tracking-widest text-slate-500 [writing-mode:vertical-rl]">{children}</span>
    </div>
  );
}
