import type { LobbyPlayer, Player, Role } from "@engine/types";
import { LockKeyhole, Scale } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { parseBattletag } from "@utils/heroUtils";
import { getRoleRankDisplay } from "@utils/rankMapper";

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
  const gameMode = useSessionStore((state) => state.gameMode);
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
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
          <LockKeyhole className="h-3 w-3 text-accent" aria-hidden="true" />
        )}
        {effectiveSR !== undefined && (
          <span className="text-sm text-gray-400">{effectiveSR}</span>
        )}
      </div>
    );
  }

  // Full card
  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg border transition-colors
        ${onClick ? "cursor-pointer hover:border-[var(--color-cool)]" : ""}
        ${selected ? "border-[var(--color-cool)] bg-[var(--color-cool-soft)]" : "border-[var(--color-rule)] bg-[var(--color-paper-2)]"}
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
        (showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0) || player.isOneTrick) && (
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
          {showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-red-700 rounded">
              L{lobbyPlayer.consecutiveLosses}
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
        {player.rolesWilling.includes("Tank") && (() => {
          const tankRank = getRoleRankDisplay(player, "Tank", gameMode);
          return tankRank ? (
            <div className="flex justify-between">
              <span>Tank:</span>
              <span className="text-yellow-400">{tankRank}</span>
            </div>
          ) : null;
        })()}
        {player.rolesWilling.includes("DPS") && (() => {
          const dpsRank = getRoleRankDisplay(player, "DPS", gameMode);
          return dpsRank ? (
            <div className="flex justify-between">
              <span>DPS:</span>
              <span className="text-red-400">{dpsRank}</span>
            </div>
          ) : null;
        })()}
        {player.rolesWilling.includes("Support") && (() => {
          const supportRank = getRoleRankDisplay(player, "Support", gameMode);
          return supportRank ? (
            <div className="flex justify-between">
              <span>Support:</span>
              <span className="text-green-400">{supportRank}</span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Weight modifier if non-zero */}
      {showWeightModifiers && (player.weightModifier !== 0 || lobbyPlayer?.tempWeightOverride) && (
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
            {lobbyPlayer.isAfk ? "AFK" : "AFK"}
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
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
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
              {lobbyPlayer.lockedToTeam === 1 ? <><LockKeyhole className="inline h-3 w-3 mr-1" aria-hidden="true" />T1</> : "T1"}
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
              {lobbyPlayer.lockedToTeam === 2 ? <><LockKeyhole className="inline h-3 w-3 mr-1" aria-hidden="true" />T2</> : "T2"}
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
            <LockKeyhole className="h-3 w-3 text-accent" aria-hidden="true" />T1
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
            <LockKeyhole className="h-3 w-3 text-accent" aria-hidden="true" />T2
          </button>
        </div>
      )}
    </div>
  );
}
