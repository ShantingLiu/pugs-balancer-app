import { useState, type ReactNode } from "react";
import { LockKeyhole, LockKeyholeOpen, RefreshCw, Pencil, ArrowLeftRight } from "lucide-react";
import type { RoleAssignment, Role, LobbyPlayer, GameMode } from "@engine/types";
import { useSessionStore } from "@store/sessionStore";
import { formatRankOnly, getEffectiveSR } from "@utils/rankMapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// =============================================================================
// TeamColumn - Displays a single team's composition
// =============================================================================

interface TeamColumnProps {
  teamNumber: 1 | 2;
  assignments: RoleAssignment[];
  averageSR: number;
  onEditPlayer?: (battletag: string) => void;
  swapSource: string | null;
  onSwapClick: (battletag: string) => void;
}

const ROLE_ORDER: Role[] = ["Tank", "DPS", "Support"];

function getPlayerModifier(lobbyPlayer: LobbyPlayer | undefined): number {
  if (!lobbyPlayer) return 0;
  const manual = (lobbyPlayer.tempWeightOverride ?? 0) + (lobbyPlayer.weightModifier ?? 0);
  const adaptive = lobbyPlayer.adaptiveWeight ?? 0;
  return manual + adaptive;
}

function getAdaptiveWeight(lobbyPlayer: LobbyPlayer | undefined): number {
  if (!lobbyPlayer) return 0;
  return lobbyPlayer.adaptiveWeight ?? 0;
}

function formatRankWithModifier(
  effectiveSR: number,
  modifier: number,
  adaptiveWeight: number,
  mode: GameMode,
  showModifiers: boolean = true
): ReactNode {
  const baseRank = formatRankOnly(effectiveSR - modifier, mode);

  const manualMod = modifier - adaptiveWeight;
  const showManual = showModifiers && manualMod !== 0;
  const showAdaptive = showModifiers && adaptiveWeight !== 0;

  if (!showManual && !showAdaptive) {
    return <>{baseRank}</>;
  }

  if (showManual && showAdaptive) {
    const manualSign = manualMod > 0 ? "+" : "";
    const adaptiveSign = adaptiveWeight > 0 ? "+" : "";
    return (
      <>
        {baseRank}{" "}
        <span className={cn("app-measured", manualMod > 0 ? "text-ok" : "text-bad")}>
          {manualSign}{manualMod}
        </span>
        <span className={cn("app-measured", adaptiveWeight > 0 ? "text-sky-ink" : "text-pink-ink")}>
          {" "}{adaptiveSign}{adaptiveWeight}
        </span>
      </>
    );
  }

  if (showAdaptive) {
    const sign = adaptiveWeight > 0 ? "+" : "";
    return (
      <>
        {baseRank}{" "}
        <span className={cn("app-measured", adaptiveWeight > 0 ? "text-sky-ink" : "text-pink-ink")}>
          {sign}{adaptiveWeight}
        </span>
      </>
    );
  }

  const sign = manualMod > 0 ? "+" : "";
  return (
    <>
      {baseRank}{" "}
      <span className={cn("app-measured", manualMod > 0 ? "text-ok" : "text-bad")}>
        {sign}{manualMod}
      </span>
    </>
  );
}

function getRoleColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "text-tank";
    case "DPS":
      return "text-dps";
    case "Support":
      return "text-sup";
  }
}

function getRoleBadgeVariant(role: Role): NonNullable<BadgeProps["variant"]> {
  switch (role) {
    case "Tank":
      return "tank";
    case "DPS":
      return "dps";
    case "Support":
      return "support";
  }
}

export function TeamColumn({
  teamNumber,
  assignments,
  averageSR,
  onEditPlayer,
  swapSource,
  onSwapClick,
}: TeamColumnProps) {
  const [substituteOpen, setSubstituteOpen] = useState<string | null>(null);

  const gameMode = useSessionStore((state) => state.gameMode);
  const lockToTeam = useSessionStore((state) => state.lockToTeam);
  const lockToRole = useSessionStore((state) => state.lockToRole);
  const substitutePlayer = useSessionStore((state) => state.substitutePlayer);
  const getLobbyPlayers = useSessionStore((state) => state.getLobbyPlayers);
  const lastResult = useSessionStore((state) => state.lastResult);
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
  useSessionStore((state) => state.lockedTeam1);
  useSessionStore((state) => state.lockedTeam2);
  useSessionStore((state) => state.lockedRoles);

  const lobbyPlayers = getLobbyPlayers();
  const lobbyMap = new Map<string, LobbyPlayer>(
    lobbyPlayers.map((lp) => [lp.battletag, lp])
  );

  const playersOnTeams = new Set<string>();
  if (lastResult) {
    lastResult.team1.forEach((ra) => playersOnTeams.add(ra.player.battletag));
    lastResult.team2.forEach((ra) => playersOnTeams.add(ra.player.battletag));
  }

  const getEligibleSubstitutes = (role: Role): LobbyPlayer[] => {
    return lobbyPlayers
      .filter((lp) =>
        !playersOnTeams.has(lp.battletag) &&
        !lp.isAfk &&
        lp.rolesWilling.includes(role)
      )
      .sort((a, b) => getEffectiveSR(b, role) - getEffectiveSR(a, role));
  };

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    players: assignments.filter((a) => a.assignedRole === role),
  }));

  const isTeam1 = teamNumber === 1;

  return (
    <Card variant={isTeam1 ? "team1" : "team2"} className="p-5 gap-4">
      <CardHeader className="p-0">
        <CardTitle
          className={cn(
            "text-xl font-bold app-display flex items-center gap-2.5",
            isTeam1 ? "text-pink-ink" : "text-sky-ink"
          )}
        >
          <span>Team {teamNumber}</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  className={cn(
                    "font-bold",
                    isTeam1
                      ? "bg-team-1-pill border-team-1-edge text-pink-ink"
                      : "bg-team-2-pill border-team-2-edge text-sky-ink"
                  )}
                />
              }
            >
              {formatRankOnly(averageSR, gameMode)}
            </TooltipTrigger>
            <TooltipContent>{`${averageSR.toFixed(0)} SR`}</TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>

        <CardContent className="p-0 flex flex-col gap-3.5">
          {byRole.map(({ role, players }) => (
            <div key={role}>
              <div
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider mb-1.5",
                  getRoleColor(role)
                )}
              >
                {role}
              </div>
              <div className="flex flex-col gap-2">
                {players.map((assignment) => {
                  const battletag = assignment.player.battletag;
                  const shortName = battletag.split("#")[0];
                  const lobbyPlayer = lobbyMap.get(battletag);
                  const isLocked = lobbyPlayer?.lockedToTeam === teamNumber;
                  const modifier = getPlayerModifier(lobbyPlayer);
                  const adaptive = getAdaptiveWeight(lobbyPlayer);
                  const isSwapSource = swapSource === battletag;
                  const eligibleSubs = getEligibleSubstitutes(assignment.assignedRole);
                  const srTooltip = showWeightModifiers
                    ? `${assignment.effectiveSR.toLocaleString()} SR (manual: ${
                        modifier - adaptive >= 0 ? "+" : ""
                      }${modifier - adaptive}, adaptive: ${adaptive >= 0 ? "+" : ""}${adaptive})`
                    : `${(assignment.effectiveSR - modifier).toLocaleString()} SR`;

                  return (
                    <div
                      key={battletag}
                      className={cn(
                        "p-3 rounded-well border group flex gap-3 app-card-interactive",
                        isSwapSource
                          ? "border-sky-edge ring-2 ring-focus bg-sky-soft"
                          : isLocked
                          ? "border-lock-edge bg-lock-soft"
                          : "app-player-row border-rule"
                      )}
                    >
                      {/* Role badge */}
                      <Badge
                        variant={getRoleBadgeVariant(assignment.assignedRole)}
                        className="size-8 p-0 font-bold self-center"
                      >
                        {assignment.assignedRole.charAt(0)}
                      </Badge>

                      {/* Player details + quick controls */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="flex-1 min-w-0 font-semibold text-ink break-words" />
                              }
                            >
                              {shortName}
                            </TooltipTrigger>
                            <TooltipContent>{battletag}</TooltipContent>
                          </Tooltip>

                          {/* Lock button */}
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="quiet"
                                  size="xs"
                                  onClick={() => {
                                    if (isLocked) {
                                      lockToTeam(battletag, null);
                                      lockToRole(battletag, null);
                                    } else {
                                      lockToTeam(battletag, teamNumber);
                                      lockToRole(battletag, assignment.assignedRole);
                                    }
                                  }}
                                  className={cn(
                                    "px-2 py-1 shrink-0",
                                    isLocked
                                      ? "bg-lock-soft border-lock-edge text-lock hover:bg-lock-soft hover:border-lock-edge hover:text-lock"
                                      : "bg-paper-3 border-rule text-ink-2 hover:bg-lock-soft hover:border-lock-edge hover:text-lock"
                                  )}
                                  aria-label={
                                    isLocked
                                      ? `Unlock ${shortName}`
                                      : `Lock ${shortName} to Team ${teamNumber}`
                                  }
                                />
                              }
                            >
                              {isLocked ? (
                                <LockKeyhole aria-hidden="true" />
                              ) : (
                                <LockKeyholeOpen aria-hidden="true" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {isLocked ? "Unlock player" : `Lock to Team ${teamNumber}`}
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Rank display & hover/focus actions */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mt-0.5">
                          {assignment.effectiveSR !== undefined ? (
                            <Tooltip>
                              <TooltipTrigger render={<div className="text-xs text-ink-2" />}>
                                {formatRankWithModifier(
                                  assignment.effectiveSR,
                                  modifier,
                                  adaptive,
                                  gameMode,
                                  showWeightModifiers
                                )}
                              </TooltipTrigger>
                              <TooltipContent>{srTooltip}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Swap button */}
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant={isSwapSource ? "sky" : "quiet"}
                                    size="xs"
                                    aria-label={`Swap ${shortName}`}
                                    aria-pressed={isSwapSource}
                                    onClick={() => onSwapClick(battletag)}
                                    className={cn(
                                      "px-2 py-1 shrink-0",
                                      isSwapSource
                                        ? "opacity-100"
                                        : swapSource
                                        ? "bg-sky-soft border-sky-edge text-sky-ink animate-pulse"
                                        : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft hover:border-sky-edge hover:text-sky-ink opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                                    )}
                                  />
                                }
                              >
                                <ArrowLeftRight aria-hidden="true" />
                              </TooltipTrigger>
                              <TooltipContent>{isSwapSource ? "Cancel" : "Swap"}</TooltipContent>
                            </Tooltip>

                            {/* Substitute button + portaled Popover */}
                            <Popover
                              open={substituteOpen === battletag}
                              onOpenChange={(open) =>
                                setSubstituteOpen(open ? battletag : null)
                              }
                            >
                              <Tooltip>
                                <PopoverTrigger
                                  render={
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          variant="quiet"
                                          size="xs"
                                          aria-label={`Substitute ${shortName}`}
                                          className={cn(
                                            "px-2 py-1 shrink-0",
                                            substituteOpen === battletag
                                              ? "bg-pink-soft border-pink-edge text-pink-ink opacity-100 hover:bg-pink-soft hover:border-pink-edge hover:text-pink-ink"
                                              : "bg-paper-3 border-rule text-ink-2 hover:bg-pink-soft hover:border-pink-edge hover:text-pink-ink opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                                          )}
                                        />
                                      }
                                    />
                                  }
                                >
                                  <RefreshCw aria-hidden="true" />
                                </PopoverTrigger>
                                <TooltipContent>Substitute</TooltipContent>
                              </Tooltip>

                              <PopoverContent
                                align="end"
                                className="w-auto min-w-[200px] max-h-[300px] overflow-y-auto p-0"
                              >
                                <div className="p-2.5 text-xs font-semibold text-muted">
                                  Sub for {shortName}
                                </div>
                                <Separator />
                                {eligibleSubs.length === 0 ? (
                                  <div className="p-3 text-sm text-muted">
                                    No eligible {assignment.assignedRole} subs
                                  </div>
                                ) : (
                                  eligibleSubs.map((sub) => (
                                    <Button
                                      key={sub.battletag}
                                      variant="ghost"
                                      shape="well"
                                      onClick={() => {
                                        substitutePlayer(battletag, sub.battletag, true);
                                        setSubstituteOpen(null);
                                      }}
                                      className="w-full justify-between rounded-none px-3 py-2 text-sm text-ink hover:bg-sky-soft"
                                    >
                                      <span className="font-semibold">
                                        {sub.battletag.split("#")[0]}
                                      </span>
                                      <span className="text-muted text-xs">
                                        {formatRankOnly(
                                          getEffectiveSR(sub, assignment.assignedRole),
                                          gameMode
                                        )}
                                      </span>
                                    </Button>
                                  ))
                                )}
                                <Separator />
                                <Button
                                  variant="ghost"
                                  shape="well"
                                  onClick={() => setSubstituteOpen(null)}
                                  className="w-full justify-start rounded-none px-3 py-2 text-xs font-semibold text-muted hover:bg-paper-3"
                                >
                                  Cancel
                                </Button>
                              </PopoverContent>
                            </Popover>

                            {/* Edit button */}
                            {onEditPlayer && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="quiet"
                                      size="xs"
                                      aria-label={`Edit ${shortName}`}
                                      onClick={() => onEditPlayer(battletag)}
                                      className="px-2 py-1 shrink-0 bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft hover:border-sky-edge hover:text-sky-ink opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                                    />
                                  }
                                >
                                  <Pencil aria-hidden="true" />
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {players.length === 0 && (
                  <div className="text-muted text-sm py-1">No {role}</div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
    </Card>
  );
}
