import type { Team } from '../../data/league';

// Zastępcze "zdjęcie" zawodnika: sylwetka na tle w kolorze zespołu i numer na koszulce.
function PlayerPhoto({ team, number, size = 'md' }: { team: Team; number: number; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-lg ${size === 'lg' ? 'h-40 w-32' : 'h-16 w-14'}`}
      style={{ background: `linear-gradient(160deg, ${team.color}, #0f172a)` }}
      aria-hidden="true"
    >
      <svg className="absolute inset-x-0 bottom-0 h-[85%] w-full text-white/25" viewBox="0 0 60 70" preserveAspectRatio="xMidYMax meet" fill="currentColor">
        <circle cx="30" cy="20" r="12" />
        <path d="M6 70c0-15 10.7-27 24-27s24 12 24 27H6Z" />
      </svg>
      <span className={`absolute inset-x-0 bottom-1 text-center font-black text-white/90 ${size === 'lg' ? 'text-2xl' : 'text-xs'}`}>{number}</span>
    </span>
  );
}

export default PlayerPhoto;
