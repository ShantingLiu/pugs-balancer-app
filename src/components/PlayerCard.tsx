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

function isLobbyPlayer(player: Player | LobbyPlayer): player is LobbyPlayer {
  return "mustPlay" in player;
}

function getRoleBadgeColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "role-tank";
    case "DPS":
      return "role-dps";
    case "Support":
      return "role-support";
  }
}

function getRoleTextColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "text-tank";
    case "DPS":
      return "text-dps";
    case "Support":
      return "text-sup";
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
        className={`flex items-center gap-2 p-2 rounded-well border ${
          lobbyPlayer?.isAfk ? "opacity-55" : ""
        } ${lobbyPlayer?.lockedToTeam ? "border-lock-edge bg-lock-soft" : "app-player-row border-rule"}`}
      >
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-pill ${getRoleBadgeColor(assignedRole)}`}>
          {assignedRole.charAt(0)}
        </span>
        <span className="flex-1 truncate font-semibold text-ink">
          {parseBattletag(player.battletag).name}
        </span>
        {lobbyPlayer?.lockedToTeam && (
          <LockKeyhole className="h-3 w-3 text-lock" aria-hidden="true" />
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
      className={`p-3 rounded-well border ${
        onClick ? "cursor-pointer app-card-interactive" : ""
      } ${
        selected
          ? "app-lobby-card--selected"
          : "app-lobby-card"
      } ${lobbyPlayer?.isAfk ? "opacity-55" : ""} ${
        lobbyPlayer?.mustPlay ? "ring-2 ring-warn-edge" : ""
      }`}
    >
      {/* Header with name and roles */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-ink truncate">
            {parseBattletag(player.battletag).name}
          </span>
          {parseBattletag(player.battletag).discriminator && (
            <span className="text-xs text-muted shrink-0">
              #{parseBattletag(player.battletag).discriminator}
            </span>
          )}
        </div>

        {/* Roles aligned right */}
        <div className="flex gap-1 shrink-0">
          {player.rolesWilling.map((role, idx) => (
            <span
              key={role}
              className={`px-2 py-0.5 text-xs font-semibold rounded-pill ${getRoleBadgeColor(role)} ${
                idx === 0 && player.rolePreference[0] === role ? "ring-1 ring-ink" : ""
              }`}
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Status badges */}
      {(lobbyPlayer?.mustPlay || lobbyPlayer?.lockedToTeam || lobbyPlayer?.isAfk ||
        (showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0) || player.isOneTrick) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lobbyPlayer?.mustPlay && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-warn-soft border border-warn-edge text-warn rounded-pill">
              Must
            </span>
          )}
          {lobbyPlayer?.lockedToTeam && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-lock-soft border border-lock-edge text-lock rounded-pill">
              T{lobbyPlayer.lockedToTeam}
            </span>
          )}
          {lobbyPlayer?.isAfk && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-paper-2 border border-rule text-muted rounded-pill">
              AFK
            </span>
          )}
          {showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-bad-soft border border-bad-edge text-bad rounded-pill app-measured">
              L{lobbyPlayer.consecutiveLosses}
            </span>
          )}
          {player.isOneTrick && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-pink-soft border border-pink-edge text-pink-ink rounded-pill">
              OT
            </span>
          )}
        </div>
      )}

      {/* Ranks - only show for roles they're willing to play */}
      <div className="text-xs text-ink-2 space-y-0.5">
        {player.rolesWilling.includes("Tank") && (() => {
          const tankRank = getRoleRankDisplay(player, "Tank", gameMode);
          return tankRank ? (
            <div className="flex justify-between">
              <span>Tank</span>
              <span className={`font-semibold ${getRoleTextColor("Tank")}`}>{tankRank}</span>
            </div>
          ) : null;
        })()}
        {player.rolesWilling.includes("DPS") && (() => {
          const dpsRank = getRoleRankDisplay(player, "DPS", gameMode);
          return dpsRank ? (
            <div className="flex justify-between">
              <span>DPS</span>
              <span className={`font-semibold ${getRoleTextColor("DPS")}`}>{dpsRank}</span>
            </div>
          ) : null;
        })()}
        {player.rolesWilling.includes("Support") && (() => {
          const supportRank = getRoleRankDisplay(player, "Support", gameMode);
          return supportRank ? (
            <div className="flex justify-between">
              <span>Support</span>
              <span className={`font-semibold ${getRoleTextColor("Support")}`}>{supportRank}</span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Weight modifier if non-zero */}
      {showWeightModifiers && (player.weightModifier !== 0 || lobbyPlayer?.tempWeightOverride) && (
        <div className="mt-2 text-xs app-measured">
          {player.weightModifier !== 0 && (
            <span className="text-sky-ink font-semibold">
              Weight: {player.weightModifier > 0 ? "+" : ""}
              {player.weightModifier}
            </span>
          )}
          {lobbyPlayer?.tempWeightOverride && (
            <span className="text-lock font-semibold ml-2">
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
        <div className="mt-3 pt-2 border-t border-rule flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMustPlay(player.battletag);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-pill inline-flex items-center gap-1 border ${
              lobbyPlayer.mustPlay
                ? "bg-warn-fill border-warn-edge text-warn-btn-ink hover:bg-warn-soft hover:text-warn"
                : "bg-paper-2 border-rule text-ink-2 hover:bg-warn-fill hover:text-warn-btn-ink hover:border-warn-edge"
            }`}
          >
            <Star className="h-3 w-3" aria-hidden="true" />
            Must
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleAfk(player.battletag);
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-pill border ${
              lobbyPlayer.isAfk
                ? "bg-bad-soft border-bad-edge text-bad hover:bg-bad hover:text-paper"
                : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
            }`}
          >
            AFK
          </button>

          {onWeightClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWeightClick();
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-pill border ${
                lobbyPlayer.tempWeightOverride !== null
                  ? "bg-lock-soft border-lock-edge text-lock hover:bg-lock hover:text-paper"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
              }`}
              title="Adjust temporary SR weight"
              aria-label={`Adjust weight for ${parseBattletag(player.battletag).name}`}
            >
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {/* Team lock buttons */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 1 ? null : 1);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-pill border inline-flex items-center gap-1 ${
                lobbyPlayer.lockedToTeam === 1
                  ? "bg-pink-soft border-pink-edge text-pink-ink hover:bg-accent hover:text-accent-ink"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-accent hover:text-accent-ink hover:border-pink-edge"
              }`}
            >
              {lobbyPlayer.lockedToTeam === 1 && <LockKeyhole className="h-3 w-3" aria-hidden="true" />}
              T1
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-pill border inline-flex items-center gap-1 ${
                lobbyPlayer.lockedToTeam === 2
                  ? "bg-sky border-sky-edge text-sky-btn-ink hover:bg-sky-hover hover:text-sky-hover-ink"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
              }`}
            >
              {lobbyPlayer.lockedToTeam === 2 && <LockKeyhole className="h-3 w-3" aria-hidden="true" />}
              T2
            </button>
          </div>

          {/* Role lock buttons */}
          {player.rolesWilling.length > 1 && (
            <div className="flex gap-1">
              {player.rolesWilling.map((role) => {
                const isLocked = lobbyPlayer.lockedToRole === role;
                const roleInitial = role.charAt(0);
                return (
                  <button
                    type="button"
                    key={role}
                    onClick={(e) => {
                      e.stopPropagation();
                      lockToRole(player.battletag, isLocked ? null : role);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-pill border inline-flex items-center gap-0.5 ${
                      isLocked
                        ? getRoleBadgeColor(role)
                        : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
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
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 1 ? null : 1);
            }}
            className={`flex-1 px-2 py-1 text-xs font-semibold rounded-pill border inline-flex items-center justify-center gap-1 ${
              lobbyPlayer.lockedToTeam === 1
                ? "bg-pink-soft border-pink-edge text-pink-ink hover:bg-accent hover:text-accent-ink"
                : "bg-paper-2 border-rule text-ink-2 hover:bg-accent hover:text-accent-ink hover:border-pink-edge"
            }`}
          >
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />T1
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
            }}
            className={`flex-1 px-2 py-1 text-xs font-semibold rounded-pill border inline-flex items-center justify-center gap-1 ${
              lobbyPlayer.lockedToTeam === 2
                ? "bg-sky border-sky-edge text-sky-btn-ink hover:bg-sky-hover hover:text-sky-hover-ink"
                : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
            }`}
          >
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />T2
          </button>
        </div>
      )}
    </div>
  );
}
