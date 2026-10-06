import { useRef, useState } from 'react';

interface PhotoDialogProps {
  // Miniatura widoczna na stronie.
  thumbnail: string;
  // Większa wersja zdjęcia do okna (gdy się nie wczyta, okno pokazuje miniaturę).
  full: string;
  alt: string;
  className?: string;
}

// Miniatura zdjęcia, która po kliknięciu otwiera okno z większym zdjęciem.
// Natywny <dialog>: zamyka się klawiszem Esc, kliknięciem w tło albo przyciskiem.
function PhotoDialog({ thumbnail, full, alt, className = '' }: PhotoDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fullFailed, setFullFailed] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Powiększ zdjęcie: ${alt}`}
        className={`group relative shrink-0 cursor-zoom-in overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${className}`}
      >
        <img src={thumbnail} alt={alt} className="h-full w-full bg-white object-cover object-top transition group-hover:scale-105" />
      </button>
      <dialog
        ref={dialog}
        aria-label={alt}
        // Kliknięcie poza zdjęciem trafia w sam element <dialog> (tło) — wtedy zamykamy.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[90vh] max-w-[min(90vw,40rem)] overflow-visible rounded-2xl bg-transparent p-0 backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          <img
            src={fullFailed ? thumbnail : full}
            alt={alt}
            onError={() => setFullFailed(true)}
            className="max-h-[85vh] w-full rounded-2xl bg-white object-contain shadow-2xl"
          />
          <p className="mt-3 text-center text-sm font-semibold text-white">{alt}</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Zamknij"
            className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-900 shadow-lg hover:bg-orange-500 hover:text-white"
          >
            ✕
          </button>
        </div>
      </dialog>
    </>
  );
}

export default PhotoDialog;
