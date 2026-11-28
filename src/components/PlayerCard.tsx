import type { ReactNode } from "react";
import type { LobbyPlayer, Player, Role } from "@engine/types";
import { LockKeyhole, Scale, Star } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { parseBattletag } from "@utils/heroUtils";
import { getRoleRankDisplay, getShared6v6Rank } from "@utils/rankMapper";

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
  /** Optional inline action rendered at the top-right of the card header */
  headerAction?: ReactNode;
}

function isLobbyPlayer(player: Player | LobbyPlayer): player is LobbyPlayer {
  return "mustPlay" in player;
}

function getRoleBadgeVariant(role: Role): "tank" | "dps" | "support" {
  switch (role) {
    case "Tank":
      return "tank";
    case "DPS":
      return "dps";
    case "Support":
      return "support";
  }
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
      return "app-card-rank--tank";
    case "DPS":
      return "app-card-rank--dps";
    case "Support":
      return "app-card-rank--sup";
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
  headerAction,
}: PlayerCardProps) {
  const lobbyPlayer = isLobbyPlayer(player) ? player : null;

  const gameMode = useSessionStore((state) => state.gameMode);
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
  const toggleMustPlay = useSessionStore((state) => state.toggleMustPlay);
  const toggleAfk = useSessionStore((state) => state.toggleAfk);
  const lockToTeam = useSessionStore((state) => state.lockToTeam);
  const toggleRoleLock = useSessionStore((state) => state.toggleRoleLock);

  // Compact mode for team display
  if (compact && assignedRole) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 p-2 rounded-well border",
          lobbyPlayer?.lockedToTeam
            ? "border-lock-edge bg-lock-soft"
            : lobbyPlayer?.isAfk
            ? "bg-paper-2 border-rule"
            : "app-player-row border-rule"
        )}
      >
        <Badge variant={getRoleBadgeVariant(assignedRole)} className="px-2">
          {assignedRole.charAt(0)}
        </Badge>
        <span className={cn("flex-1 min-w-0 break-words font-semibold", lobbyPlayer?.isAfk ? "text-muted" : "text-ink")}>
          {parseBattletag(player.battletag).name}
        </span>
        {lobbyPlayer?.lockedToTeam && (
          <LockKeyhole className="size-3 text-lock" aria-hidden="true" />
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
      className={cn(
        "p-3 rounded-well border",
        onClick && "cursor-pointer app-card-interactive",
        lobbyPlayer?.isAfk
          ? "bg-paper-2 border-rule text-ink-2"
          : selected
          ? "app-lobby-card--selected"
          : "app-lobby-card"
      )}
    >
        {/* Header with name and roles */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className={cn("font-semibold break-words min-w-0", lobbyPlayer?.isAfk ? "text-muted" : "text-ink")}>
              {parseBattletag(player.battletag).name}
            </span>
            {parseBattletag(player.battletag).discriminator && (
              <span className="text-xs text-muted shrink-0">
                #{parseBattletag(player.battletag).discriminator}
              </span>
            )}
          </div>

          {/* Roles and optional header action aligned right */}
          <div className="flex items-center gap-1 shrink-0">
            {player.rolesWilling.map((role) => (
              <Badge key={role} variant={getRoleBadgeVariant(role)} className="px-2">
                {role}
              </Badge>
            ))}
            {headerAction}
          </div>
        </div>

        {/* Status badges */}
        {(lobbyPlayer?.mustPlay || lobbyPlayer?.lockedToTeam || lobbyPlayer?.isAfk ||
          (showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0) || player.isOneTrick) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {lobbyPlayer?.mustPlay && (
              <Badge variant="warn" className="px-2">
                Must
              </Badge>
            )}
            {lobbyPlayer?.lockedToTeam && (
              <Badge variant="lock" className="px-2">
                T{lobbyPlayer.lockedToTeam}
              </Badge>
            )}
            {lobbyPlayer?.isAfk && (
              <Badge variant="muted" className="px-2">
                AFK
              </Badge>
            )}
            {showWeightModifiers && lobbyPlayer && lobbyPlayer.consecutiveLosses > 0 && (
              <Badge variant="bad" className="px-2 app-measured">
                L{lobbyPlayer.consecutiveLosses}
              </Badge>
            )}
            {player.isOneTrick && (
              <Badge variant="pink" className="px-2">
                OT
              </Badge>
            )}
          </div>
        )}

        {/* Ranks - single shared rank in 6v6 mode if set, otherwise per willing role */}
        <div className="text-xs text-ink-2 flex flex-col gap-0.5">
          {(() => {
            const shared6v6Rank = gameMode === "regular_6v6" ? getShared6v6Rank(player) : null;
            if (shared6v6Rank) {
              return (
                <div className="flex justify-between">
                  <span>6v6 Rank</span>
                  <span className="font-semibold text-ink">{shared6v6Rank}</span>
                </div>
              );
            }

            return (
              <>
                {player.rolesWilling.includes("Tank") && (() => {
                  const tankRank = getRoleRankDisplay(player, "Tank", gameMode);
                  return tankRank ? (
                    <div className="flex justify-between">
                      <span>Tank</span>
                      <span className={cn("font-semibold", getRoleTextColor("Tank"))}>{tankRank}</span>
                    </div>
                  ) : null;
                })()}
                {player.rolesWilling.includes("DPS") && (() => {
                  const dpsRank = getRoleRankDisplay(player, "DPS", gameMode);
                  return dpsRank ? (
                    <div className="flex justify-between">
                      <span>DPS</span>
                      <span className={cn("font-semibold", getRoleTextColor("DPS"))}>{dpsRank}</span>
                    </div>
                  ) : null;
                })()}
                {player.rolesWilling.includes("Support") && (() => {
                  const supportRank = getRoleRankDisplay(player, "Support", gameMode);
                  return supportRank ? (
                    <div className="flex justify-between">
                      <span>Support</span>
                      <span className={cn("font-semibold", getRoleTextColor("Support"))}>{supportRank}</span>
                    </div>
                  ) : null;
                })()}
              </>
            );
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
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="mt-2 text-xs text-muted italic truncate" />
              }
            >
              {player.notes}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs whitespace-normal">
              {player.notes}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Session controls */}
        {showControls && lobbyPlayer && (
          <>
            <Separator className="my-2.5" />
            <div className="flex gap-1.5 flex-wrap">
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                toggleMustPlay(player.battletag);
              }}
              className={cn(
                "border",
                lobbyPlayer.mustPlay
                  ? "bg-warn-fill border-warn-edge text-warn-btn-ink hover:bg-warn-soft hover:text-warn"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-warn-fill hover:text-warn-btn-ink hover:border-warn-edge"
              )}
            >
              <Star data-icon="inline-start" aria-hidden="true" />
              Must
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                toggleAfk(player.battletag);
              }}
              className={cn(
                "border",
                lobbyPlayer.isAfk
                  ? "bg-bad-soft border-bad-edge text-bad hover:bg-bad hover:text-paper"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
              )}
            >
              AFK
            </Button>

            {onWeightClick && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWeightClick();
                      }}
                      className={cn(
                        "border",
                        lobbyPlayer.tempWeightOverride !== null
                          ? "bg-lock-soft border-lock-edge text-lock hover:bg-lock hover:text-paper"
                          : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
                      )}
                      aria-label={`Adjust weight for ${parseBattletag(player.battletag).name}`}
                    />
                  }
                >
                  <Scale aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Adjust temporary SR weight</TooltipContent>
              </Tooltip>
            )}

            {/* Team lock buttons */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 1 ? null : 1);
                }}
                className={cn(
                  "border",
                  lobbyPlayer.lockedToTeam === 1
                    ? "bg-pink-soft border-pink-edge text-pink-ink hover:bg-accent hover:text-accent-ink"
                    : "bg-paper-2 border-rule text-ink-2 hover:bg-accent hover:text-accent-ink hover:border-pink-edge"
                )}
              >
                {lobbyPlayer.lockedToTeam === 1 && <LockKeyhole data-icon="inline-start" aria-hidden="true" />}
                T1
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
                }}
                className={cn(
                  "border",
                  lobbyPlayer.lockedToTeam === 2
                    ? "bg-sky border-sky-edge text-sky-btn-ink hover:bg-sky-hover hover:text-sky-hover-ink"
                    : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
                )}
              >
                {lobbyPlayer.lockedToTeam === 2 && <LockKeyhole data-icon="inline-start" aria-hidden="true" />}
                T2
              </Button>
            </div>

            {/* Role lock buttons (multi-select supported for 3-role flex players) */}
            {player.rolesWilling.length > 1 && (
              <div className="flex gap-1">
                {player.rolesWilling.map((role) => {
                  const isLocked = lobbyPlayer.lockedToRoles
                    ? lobbyPlayer.lockedToRoles.includes(role)
                    : lobbyPlayer.lockedToRole === role;
                  const roleInitial = role.charAt(0);
                  return (
                    <Tooltip key={role}>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-pressed={isLocked}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRoleLock(player.battletag, role, player.rolesWilling);
                            }}
                            className={cn(
                              "border gap-0.5",
                              isLocked
                                ? getRoleBadgeColor(role)
                                : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
                            )}
                          />
                        }
                      >
                        {isLocked && <LockKeyhole data-icon="inline-start" aria-hidden="true" />}
                        {roleInitial}
                      </TooltipTrigger>
                      <TooltipContent>
                        {isLocked ? `Unlock ${role}` : `Restrict to ${role} (multi-select supported)`}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
            </div>
          </>
        )}

        {/* Lock buttons for team display (without full controls) */}
        {showLockButtons && lobbyPlayer && (
          <div className="mt-2 flex gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 1 ? null : 1);
              }}
              className={cn(
                "flex-1 px-2 border",
                lobbyPlayer.lockedToTeam === 1
                  ? "bg-pink-soft border-pink-edge text-pink-ink hover:bg-accent hover:text-accent-ink"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-accent hover:text-accent-ink hover:border-pink-edge"
              )}
            >
              <LockKeyhole data-icon="inline-start" aria-hidden="true" />
              T1
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                lockToTeam(player.battletag, lobbyPlayer.lockedToTeam === 2 ? null : 2);
              }}
              className={cn(
                "flex-1 px-2 border",
                lobbyPlayer.lockedToTeam === 2
                  ? "bg-sky border-sky-edge text-sky-btn-ink hover:bg-sky-hover hover:text-sky-hover-ink"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-sky hover:text-sky-btn-ink hover:border-sky-edge"
              )}
            >
              <LockKeyhole data-icon="inline-start" aria-hidden="true" />
              T2
            </Button>
          </div>
        )}
    </div>
  );
}
