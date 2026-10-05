import type { Team } from '../../data/league';

// Skrót z pierwszych liter dwóch pierwszych słów, np. "Odra Hoops Wrocław" -> "OH".
function initials(name: string) {
  const words = name.split(/[\s-]+/).filter((word) => /^\p{L}/u.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function TeamBadge({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'}`}
      style={{ backgroundColor: team.color }}
      aria-hidden="true"
    >
      {initials(team.name)}
    </span>
  );
}

export default TeamBadge;
