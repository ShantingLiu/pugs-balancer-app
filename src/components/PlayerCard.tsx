import type { LobbyPlayer, Player, Role } from "@engine/types";
import { LockKeyhole, Scale, Star } from "lucide-react";
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

/** Get role badge class */
function getRoleBadgeColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "role-badge-tank";
    case "DPS":
      return "role-badge-dps";
    case "Support":
      return "role-badge-support";
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
          flex items-center gap-2 p-2 app-card
          ${lobbyPlayer?.isAfk ? "opacity-50" : ""}
          ${lobbyPlayer?.lockedToTeam ? "outline outline-1 outline-[var(--color-accent)]" : ""}
        `}
      >
        <span
          className={`
            px-2 py-0.5 text-xs font-bold
            ${getRoleBadgeColor(assignedRole)}
          `}
        >
          {assignedRole.charAt(0)}
        </span>
        <span className="flex-1 truncate font-medium text-ink">
          {parseBattletag(player.battletag).name}
        </span>
        {lobbyPlayer?.lockedToTeam && (
          <LockKeyhole className="h-3 w-3 text-accent" aria-hidden="true" />
        )}
        {effectiveSR !== undefined && (
          <span className="text-sm text-muted app-measured">{effectiveSR}</span>
        )}
      </div>
    );
  }

  // Full card
  return (
    <div
      onClick={onClick}
      className={`
        p-3 border transition-colors rounded-[var(--radius-card)]
        ${onClick ? "cursor-pointer hover:border-[var(--color-accent)]" : ""}
        ${selected ? "app-surface-selected" : "app-card"}
        ${lobbyPlayer?.isAfk ? "opacity-50" : ""}
        ${lobbyPlayer?.mustPlay ? "outline outline-2 outline-[var(--color-accent)]" : ""}
      `}
    >
      {/* Header with name and roles */}
      <div className="flex items-center justify-between gap-2 mb-2 pr-6">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-ink truncate">
            {parseBattletag(player.battletag).name}
          </span>
          {parseBattletag(player.battletag).discriminator && (
            <span className="text-xs text-muted flex-shrink-0 app-measured">
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
                px-2 py-0.5 text-xs font-medium
                ${getRoleBadgeColor(role)}
                ${idx === 0 && player.rolePreference[0] === role ? "outline outline-1 outline-[var(--color-ink)]" : ""}
              `}
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Status badges */}
      {(lobbyPlayer?.mustPlay ||
        lobbyPlayer?.lockedToTeam ||
        lobbyPlayer?.isAfk ||
        (showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0) ||
        player.isOneTrick) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lobbyPlayer?.mustPlay && (
            <span className="px-2 py-0.5 text-xs app-chip-active inline-flex items-center gap-1">
              <Star className="h-3 w-3" aria-hidden="true" />
              Must
            </span>
          )}
          {lobbyPlayer?.lockedToTeam && (
            <span className="px-2 py-0.5 text-xs app-badge app-measured">
              T{lobbyPlayer.lockedToTeam}
            </span>
          )}
          {lobbyPlayer?.isAfk && (
            <span className="px-2 py-0.5 text-xs app-chip">
              AFK
            </span>
          )}
          {showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0 && (
            <span className="px-2 py-0.5 text-xs app-alert-error app-measured">
              L{lobbyPlayer.consecutiveLosses}
            </span>
          )}
          {player.isOneTrick && (
            <span className="px-2 py-0.5 text-xs app-badge">
              OT
            </span>
          )}
        </div>
      )}

      {/* Ranks - only show for roles they're willing to play */}
      <div className="text-xs text-muted space-y-0.5">
        {player.rolesWilling.includes("Tank") &&
          (() => {
            const tankRank = getRoleRankDisplay(player, "Tank", gameMode);
            return tankRank ? (
              <div className="flex justify-between">
                <span>Tank:</span>
                <span className="role-text-tank font-medium">{tankRank}</span>
              </div>
            ) : null;
          })()}
        {player.rolesWilling.includes("DPS") &&
          (() => {
            const dpsRank = getRoleRankDisplay(player, "DPS", gameMode);
            return dpsRank ? (
              <div className="flex justify-between">
                <span>DPS:</span>
                <span className="role-text-dps font-medium">{dpsRank}</span>
              </div>
            ) : null;
          })()}
        {player.rolesWilling.includes("Support") &&
          (() => {
            const supportRank = getRoleRankDisplay(player, "Support", gameMode);
            return supportRank ? (
              <div className="flex justify-between">
                <span>Support:</span>
                <span className="role-text-support font-medium">{supportRank}</span>
              </div>
            ) : null;
          })()}
      </div>

      {/* Weight modifier if non-zero */}
      {showWeightModifiers && (player.weightModifier !== 0 || lobbyPlayer?.tempWeightOverride) && (
        <div className="mt-2 text-xs app-measured">
          {player.weightModifier !== 0 && (
            <span className="text-accent">
              Weight: {player.weightModifier > 0 ? "+" : ""}
              {player.weightModifier}
            </span>
          )}
          {lobbyPlayer?.tempWeightOverride && (
            <span className="text-ink-2 ml-2">
              (Temp: {lobbyPlayer.tempWeightOverride > 0 ? "+" : ""}
              {lobbyPlayer.tempWeightOverride})
            </span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {player.notes && (
        <div className="mt-2 text-xs text-muted truncate" title={player.notes}>
          {player.notes}
        </div>
      )}

      {/* Session controls */}
      {showControls && lobbyPlayer && (
        <div className="mt-3 pt-2 border-t border-[var(--color-rule)] flex gap-1 flex-wrap items-center">
          {/* Must-play toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMustPlay(player.battletag);
            }}
            className={`px-2 py-0.5 text-xs inline-flex items-center gap-1 transition-colors ${
              lobbyPlayer.mustPlay ? "app-chip-active" : "app-chip"
            }`}
          >
            <Star className="h-3 w-3" aria-hidden="true" />
            Must
          </button>

          {/* AFK toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAfk(player.battletag);
            }}
            className={`px-2 py-0.5 text-xs transition-colors ${
              lobbyPlayer.isAfk ? "app-chip-active" : "app-chip"
            }`}
          >
            AFK
          </button>

          {/* Weight adjust button */}
          {onWeightClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWeightClick();
              }}
              className={`px-2 py-0.5 text-xs inline-flex items-center transition-colors ${
                lobbyPlayer.tempWeightOverride !== null ? "app-chip-active" : "app-chip"
              }`}
              title="Adjust temporary weight"
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
              className={`px-1.5 py-0.5 text-xs inline-flex items-center gap-0.5 transition-colors app-measured ${
                lobbyPlayer.lockedToTeam === 1 ? "app-chip-active" : "app-chip"
              }`}
            >
              {lobbyPlayer.lockedToTeam === 1 && (
                <LockKeyhole className="h-3 w-3" aria-hidden="true" />
              )}
              T1
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
              }}
              className={`px-1.5 py-0.5 text-xs inline-flex items-center gap-0.5 transition-colors app-measured ${
                lobbyPlayer.lockedToTeam === 2 ? "app-chip-active" : "app-chip"
              }`}
            >
              {lobbyPlayer.lockedToTeam === 2 && (
                <LockKeyhole className="h-3 w-3" aria-hidden="true" />
              )}
              T2
            </button>
          </div>

          {/* Role lock buttons - only show roles they're willing to play */}
          {player.rolesWilling.length > 1 && (
            <div className="flex gap-1">
              {player.rolesWilling.map((role) => {
                const isLocked = lobbyPlayer.lockedToRole === role;
                const roleInitial = role.charAt(0);
                return (
                  <button
                    key={role}
                    onClick={(e) => {
                      e.stopPropagation();
                      lockToRole(player.battletag, isLocked ? null : role);
                    }}
                    className={`px-1.5 py-0.5 text-xs inline-flex items-center gap-0.5 transition-colors ${
                      isLocked ? getRoleBadgeColor(role) : "app-chip"
                    }`}
                    title={isLocked ? `Unlock ${role}` : `Lock to ${role} for this game`}
                  >
                    {isLocked && <LockKeyhole className="h-2.5 w-2.5" aria-hidden="true" />}
                    {roleInitial}
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
            className={`flex-1 px-2 py-1 text-xs inline-flex items-center justify-center gap-1 transition-colors ${
              lobbyPlayer.lockedToTeam === 1 ? "app-chip-active" : "app-chip"
            }`}
          >
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
            T1
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
            }}
            className={`flex-1 px-2 py-1 text-xs inline-flex items-center justify-center gap-1 transition-colors ${
              lobbyPlayer.lockedToTeam === 2 ? "app-chip-active" : "app-chip"
            }`}
          >
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
            T2
          </button>
        </div>
      )}
    </div>
  );
}
