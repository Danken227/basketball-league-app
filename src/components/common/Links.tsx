import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Player, Team } from '../../data/league';
import { playerPath, teamPath } from '../../utils/paths';

const linkClass = 'transition hover:text-orange-600 hover:underline underline-offset-2';

interface TeamLinkProps {
  team: Team;
  seasonId?: string;
  className?: string;
  children?: ReactNode;
}

export function TeamLink({ team, seasonId, className = '', children }: TeamLinkProps) {
  return (
    <Link to={teamPath(team.id, seasonId)} draggable={false} className={`${linkClass} ${className}`}>
      {children ?? team.name}
    </Link>
  );
}

interface PlayerLinkProps {
  player: Player;
  className?: string;
  children?: ReactNode;
}

export function PlayerLink({ player, className = '', children }: PlayerLinkProps) {
  return (
    <Link to={playerPath(player.id)} draggable={false} className={`${linkClass} ${className}`}>
      {children ?? `${player.firstName} ${player.lastName}`}
    </Link>
  );
}
