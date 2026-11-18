import type { GameMode } from "@engine/types";
import type { LayoutMode } from "@store/sessionStore";

export const MODE_OPTIONS: { id: GameMode; label: string; description: string }[] = [
  { id: "regular_5v5", label: "Regular 5v5", description: "Full hero roster, comp ranks" },
  { id: "regular_6v6", label: "Regular 6v6", description: "2-2-2 composition" },
  { id: "stadium_5v5", label: "Stadium 5v5", description: "Locked heroes, stadium ranks" },
];

export const LAYOUT_OPTIONS: { id: LayoutMode; label: string; description: string }[] = [
  {
    id: "sidebar-left",
    label: "Sidebar Left",
    description: "Lobby on left, teams & stats on right",
  },
  {
    id: "teams-left",
    label: "Teams Left",
    description: "Teams & stats on left, lobby on right",
  },
  {
    id: "wide-teams",
    label: "Wide Teams",
    description: "Full-width teams on top, lobby & stats below",
  },
  {
    id: "three-col",
    label: "Three Column",
    description: "Lobby, teams, and stats side by side",
  },
];

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
