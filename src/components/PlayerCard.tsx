import type { LobbyPlayer, Player, Role } from "@engine/types";
import { useSessionStore } from "@store/sessionStore";
import { parseBattletag } from "@utils/heroUtils";

// =============================================================================
// PlayerCard - Displays a player's information
// =============================================================================

interface PlayerCardProps {
  player: Player | LobbyPlayer;
  /** Show session controls (must-play, team lock, AFK) */
  showControls?: boolean;
  /** Assigned role (if in a team) */
  assignedRole?: Role;
  /** Effective SR for assigned role */
  effectiveSR?: number;
  /** Compact mode for team display */
  compact?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Is selected */
  selected?: boolean;
  /** Show lock buttons for assigning to teams */
  showLockButtons?: boolean;
  /** Handler for weight adjust button */
  onWeightClick?: () => void;
}

/** Check if player is a LobbyPlayer */
function isLobbyPlayer(player: Player | LobbyPlayer): player is LobbyPlayer {
  return "mustPlay" in player;
}

/** Get role badge color */
function getRoleBadgeColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "bg-yellow-600";
    case "DPS":
      return "bg-red-600";
    case "Support":
      return "bg-green-600";
  }
}

/** Format SR for display */
function formatSR(sr: number): string {
  return sr.toLocaleString();
}

export function PlayerCard({
  player,
  showControls = false,
  assignedRole,
  effectiveSR,
  compact = false,
  onClick,
  selected = false,
  showLockButtons = false,
  onWeightClick,
}: PlayerCardProps) {
  const lobbyPlayer = isLobbyPlayer(player) ? player : null;
  
  // Store actions
  const toggleMustPlay = useSessionStore((state) => state.toggleMustPlay);
  const toggleAfk = useSessionStore((state) => state.toggleAfk);
  const lockToTeam = useSessionStore((state) => state.lockToTeam);
  const lockToRole = useSessionStore((state) => state.lockToRole);

  // Compact mode for team display
  if (compact && assignedRole) {
    return (
      <div
        className={`
          flex items-center gap-2 p-2 rounded-lg bg-gray-800
          ${lobbyPlayer?.isAfk ? "opacity-50" : ""}
          ${lobbyPlayer?.lockedToTeam ? "ring-1 ring-purple-500" : ""}
        `}
      >
        <span
          className={`
            px-2 py-0.5 text-xs font-bold rounded
            ${getRoleBadgeColor(assignedRole)}
          `}
        >
          {assignedRole.charAt(0)}
        </span>
        <span className="flex-1 truncate font-medium">
          {parseBattletag(player.battletag).name}
        </span>
        {lobbyPlayer?.lockedToTeam && (
          <span className="text-xs text-purple-400">🔒</span>
        )}
        {effectiveSR !== undefined && (
          <span className="text-sm text-gray-400">{formatSR(effectiveSR)}</span>
        )}
      </div>
    );
  }

  // Full card
  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg border transition-all
        ${onClick ? "cursor-pointer hover:border-blue-500" : ""}
        ${selected ? "border-blue-500 bg-blue-500/10" : "border-gray-700 bg-gray-800"}
        ${lobbyPlayer?.isAfk ? "opacity-50" : ""}
        ${lobbyPlayer?.mustPlay ? "ring-2 ring-yellow-500" : ""}
      `}
    >
      {/* Header with name and roles */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-white truncate">
            {parseBattletag(player.battletag).name}
          </span>
          {parseBattletag(player.battletag).discriminator && (
            <span className="text-xs text-gray-500 flex-shrink-0">
              #{parseBattletag(player.battletag).discriminator}
            </span>
          )}
        </div>

        {/* Roles aligned right */}
        <div className="flex gap-1 flex-shrink-0">
          {player.rolesWilling.map((role, idx) => (
            <span
              key={role}
              className={`
                px-2 py-0.5 text-xs font-medium rounded
                ${getRoleBadgeColor(role)}
                ${idx === 0 && player.rolePreference[0] === role ? "ring-1 ring-white" : ""}
              `}
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Status badges */}
      {(lobbyPlayer?.mustPlay || lobbyPlayer?.lockedToTeam || lobbyPlayer?.isAfk || 
        (lobbyPlayer && lobbyPlayer.consecutiveLosses > 0) || player.isOneTrick) && (
        <div className="flex gap-1 mb-2">
          {lobbyPlayer?.mustPlay && (
            <span className="px-1.5 py-0.5 text-xs bg-yellow-600 rounded">
              Must
            </span>
          )}
          {lobbyPlayer?.lockedToTeam && (
            <span className="px-1.5 py-0.5 text-xs bg-purple-600 rounded">
              T{lobbyPlayer.lockedToTeam}
            </span>
          )}
          {lobbyPlayer?.isAfk && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-600 rounded">
              AFK
            </span>
          )}
          {lobbyPlayer && lobbyPlayer.consecutiveLosses > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-red-700 rounded">
              📉L{lobbyPlayer.consecutiveLosses}
            </span>
          )}
          {player.isOneTrick && (
            <span className="px-1.5 py-0.5 text-xs bg-orange-600 rounded">
              OT
            </span>
          )}
        </div>
      )}

      {/* Ranks - only show for roles they're willing to play */}
      <div className="text-xs text-gray-400 space-y-0.5">
        {player.tankRank && player.rolesWilling.includes("Tank") && (
          <div className="flex justify-between">
            <span>Tank:</span>
            <span className="text-yellow-400">{player.tankRank}</span>
          </div>
        )}
        {player.dpsRank && player.rolesWilling.includes("DPS") && (
          <div className="flex justify-between">
            <span>DPS:</span>
            <span className="text-red-400">{player.dpsRank}</span>
          </div>
        )}
        {player.supportRank && player.rolesWilling.includes("Support") && (
          <div className="flex justify-between">
            <span>Support:</span>
            <span className="text-green-400">{player.supportRank}</span>
          </div>
        )}
      </div>

      {/* Weight modifier if non-zero */}
      {(player.weightModifier !== 0 || lobbyPlayer?.tempWeightOverride) && (
        <div className="mt-2 text-xs">
          {player.weightModifier !== 0 && (
            <span className="text-blue-400">
              Weight: {player.weightModifier > 0 ? "+" : ""}
              {player.weightModifier}
            </span>
          )}
          {lobbyPlayer?.tempWeightOverride && (
            <span className="text-purple-400 ml-2">
              (Temp: {lobbyPlayer.tempWeightOverride > 0 ? "+" : ""}
              {lobbyPlayer.tempWeightOverride})
            </span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {player.notes && (
        <div className="mt-2 text-xs text-gray-500 truncate" title={player.notes}>
          {player.notes}
        </div>
      )}

      {/* Session controls */}
      {showControls && lobbyPlayer && (
        <div className="mt-3 pt-2 border-t border-gray-700 flex gap-2 flex-wrap">
          {/* Must-play toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMustPlay(player.battletag);
            }}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              lobbyPlayer.mustPlay
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-600 hover:bg-gray-500"
            }`}
          >
            {lobbyPlayer.mustPlay ? "★ Must" : "☆ Must"}
          </button>

          {/* AFK toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAfk(player.battletag);
            }}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              lobbyPlayer.isAfk
                ? "bg-gray-500 hover:bg-gray-400"
                : "bg-gray-600 hover:bg-gray-500"
            }`}
          >
            {lobbyPlayer.isAfk ? "💤 AFK" : "AFK"}
          </button>

          {/* Weight adjust button */}
          {onWeightClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWeightClick();
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                lobbyPlayer.tempWeightOverride !== null
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-600 hover:bg-gray-500"
              }`}
            >
              ⚖️
            </button>
          )}

          {/* Team lock buttons */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 1 ? null : 1);
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                lobbyPlayer.lockedToTeam === 1
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-600 hover:bg-gray-500"
              }`}
            >
              {lobbyPlayer.lockedToTeam === 1 ? "🔒T1" : "T1"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                lobbyPlayer.lockedToTeam === 2
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-600 hover:bg-gray-500"
              }`}
            >
              {lobbyPlayer.lockedToTeam === 2 ? "🔒T2" : "T2"}
            </button>
          </div>

          {/* Role lock buttons - only show roles they're willing to play */}
          {player.rolesWilling.length > 1 && (
            <div className="flex gap-1">
              {player.rolesWilling.map((role) => {
                const isLocked = lobbyPlayer.lockedToRole === role;
                const roleInitial = role.charAt(0);
                const bgColor = role === "Tank" 
                  ? (isLocked ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-600 hover:bg-gray-500")
                  : role === "DPS"
                  ? (isLocked ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-500")
                  : (isLocked ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-500");
                return (
                  <button
                    key={role}
                    onClick={(e) => {
                      e.stopPropagation();
                      lockToRole(player.battletag, isLocked ? null : role);
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${bgColor}`}
                    title={isLocked ? `Unlock ${role}` : `Lock to ${role} for this game`}
                  >
                    {isLocked ? `🎯${roleInitial}` : roleInitial}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lock buttons for team display (without full controls) */}
      {showLockButtons && lobbyPlayer && (
        <div className="mt-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 1 ? null : 1);
            }}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              lobbyPlayer.lockedToTeam === 1
                ? "bg-purple-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            🔒T1
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
            }}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              lobbyPlayer.lockedToTeam === 2
                ? "bg-purple-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            🔒T2
          </button>
        </div>
      )}
    </div>
  );
}
