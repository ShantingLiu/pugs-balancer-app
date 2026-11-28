import { useState, useCallback, type ComponentPropsWithRef } from "react";
import { Users, Zap, RefreshCw, Trophy, AlertTriangle, Star } from "lucide-react";
import type { GameMode, LobbyPlayer, Role } from "@engine/types";
import { useSessionStore } from "@store/sessionStore";
import { getModeConfig } from "@engine/modeConfig";
import { parseBattletag } from "@utils/heroUtils";
import { getEffectiveSR, formatRankOnly } from "@utils/rankMapper";
import { HoldButton } from "./HoldButton";
import { MatchScoreModal } from "./MatchScoreModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// =============================================================================
// DraftView - 3-panel captain draft layout
// =============================================================================

const ROLE_ORDER: Role[] = ["Tank", "DPS", "Support"];

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

function getRoleBorderColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "border-tank-edge";
    case "DPS":
      return "border-dps-edge";
    case "Support":
      return "border-sup-edge";
  }
}

function getRoleLabel(role: Role): string {
  return role.charAt(0);
}

function RoleBadges({
  roles,
  player,
  gameMode,
}: {
  roles: Role[];
  player?: LobbyPlayer;
  gameMode?: GameMode;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => {
        let rankDisplay: string | null = null;
        if (player && gameMode) {
          const effectiveSR = getEffectiveSR(player, role, gameMode);
          const modifier =
            (player.adaptiveWeight ?? 0) +
            (player.tempWeightOverride ?? 0) +
            (player.weightModifier ?? 0);
          rankDisplay = formatRankOnly(effectiveSR - modifier, gameMode);
        }
        return (
          <Badge key={role} variant={getRoleBadgeVariant(role)}>
            {getRoleLabel(role)}
            {rankDisplay && <span className="font-normal text-[11px]">{rankDisplay}</span>}
          </Badge>
        );
      })}
    </span>
  );
}

function getOpenRoles(players: LobbyPlayer[], gameMode: GameMode): Set<Role> {
  const config = getModeConfig(gameMode);
  const roleCounts: Record<Role, number> = {
    Tank: config.composition.tank.max,
    DPS: config.composition.dps.max,
    Support: config.composition.support.max,
  };

  const filled: Record<Role, number> = { Tank: 0, DPS: 0, Support: 0 };
  for (const p of players) {
    if (p.lockedToRole) filled[p.lockedToRole]++;
  }

  const open = new Set<Role>();
  for (const role of ROLE_ORDER) {
    if (filled[role] < roleCounts[role]) open.add(role);
  }
  return open;
}

function getCompositionWarning(players: LobbyPlayer[], gameMode: GameMode): string | null {
  const config = getModeConfig(gameMode);
  const roleCounts: Record<Role, number> = {
    Tank: config.composition.tank.max,
    DPS: config.composition.dps.max,
    Support: config.composition.support.max,
  };

  const filled: Record<Role, number> = { Tank: 0, DPS: 0, Support: 0 };
  for (const p of players) {
    if (p.lockedToRole) filled[p.lockedToRole]++;
  }

  const overflows: string[] = [];
  for (const role of ROLE_ORDER) {
    if (filled[role] > roleCounts[role]) {
      overflows.push(`${filled[role]}/${roleCounts[role]} ${role}`);
    }
  }

  if (overflows.length > 0) {
    return `Too many: ${overflows.join(", ")}`;
  }

  if (players.length >= config.teamSize) {
    const noRole = players.filter((p) => !p.lockedToRole).length;
    if (noRole > 0) return `${noRole} player(s) without role assignment`;
  }

  return null;
}

interface DraftPlayerCardProps extends ComponentPropsWithRef<"div"> {
  player: LobbyPlayer;
  assignedRole?: Role;
  canCycleRole?: boolean;
  onCycleRole?: () => void;
  dimmed?: boolean;
  onDragStartBattletag?: (battletag: string) => void;
}

function DraftPlayerCard({
  player,
  assignedRole,
  canCycleRole,
  onCycleRole,
  dimmed,
  draggable: isDraggable,
  onDragStartBattletag,
  className,
  onDragStart,
  ...rest
}: DraftPlayerCardProps) {
  const gameMode = useSessionStore((state) => state.gameMode);
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
  const { name } = parseBattletag(player.battletag);
  const displayRole = assignedRole ?? player.lockedToRole;
  const sr = displayRole ? getEffectiveSR(player, displayRole, gameMode) : null;

  const adaptiveWeight = player.adaptiveWeight ?? 0;
  const manualMod = (player.tempWeightOverride ?? 0) + (player.weightModifier ?? 0);
  const totalModifier = adaptiveWeight + manualMod;

  const formatSRDisplay = () => {
    if (sr === null) return null;
    const baseRank = formatRankOnly(sr - totalModifier, gameMode);

    if (totalModifier === 0) {
      return <span className="text-xs text-ink-2">{baseRank}</span>;
    }

    const showManual = showWeightModifiers && manualMod !== 0;
    const showAdaptive = showWeightModifiers && adaptiveWeight !== 0;

    if (!showManual && !showAdaptive) {
      return <span className="text-xs text-ink-2">{baseRank}</span>;
    }

    return (
      <span className="text-xs text-ink-2">
        {baseRank}
        {showManual && (
          <span className={cn("app-measured", manualMod > 0 ? "text-ok" : "text-bad")}>
            {" "}{manualMod > 0 ? "+" : ""}{manualMod}
          </span>
        )}
        {showAdaptive && (
          <span className={cn("app-measured", adaptiveWeight > 0 ? "text-sky-ink" : "text-pink-ink")}>
            {" "}{adaptiveWeight > 0 ? "+" : ""}{adaptiveWeight}
          </span>
        )}
      </span>
    );
  };

  const isSubdued = Boolean(player.isAfk || dimmed);

  return (
    <div
      className={cn(
        "app-card-interactive flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 rounded-well border border-rule cursor-pointer select-none",
        isSubdued ? "bg-paper-2 text-muted" : "app-player-row",
        className
      )}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (isDraggable) {
          e.dataTransfer.setData("text/plain", player.battletag);
          e.dataTransfer.effectAllowed = "move";
          onDragStartBattletag?.(player.battletag);
        }
        onDragStart?.(e);
      }}
      {...rest}
    >
      {displayRole ? (
        <div className="flex items-center gap-2.5 w-full min-w-0">
          {canCycleRole ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge
                    variant={getRoleBadgeVariant(displayRole)}
                    render={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCycleRole?.();
                        }}
                      />
                    }
                    className="py-1 font-bold hover:opacity-85 cursor-pointer"
                  />
                }
              >
                {getRoleLabel(displayRole)}
                <RefreshCw aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Click to cycle role</TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant={getRoleBadgeVariant(displayRole)} className="py-1 font-bold">
              {getRoleLabel(displayRole)}
            </Badge>
          )}
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    className={cn(
                      "font-semibold truncate",
                      isSubdued ? "text-muted" : "text-ink"
                    )}
                  />
                }
              >
                {name}
              </TooltipTrigger>
              <TooltipContent>{player.battletag}</TooltipContent>
            </Tooltip>
            {formatSRDisplay()}
          </div>
        </div>
      ) : (
        <>
          <span
            className={cn(
              "font-semibold truncate max-w-full",
              isSubdued ? "text-muted" : "text-ink"
            )}
            title={player.battletag}
          >
            {name}
          </span>
          <RoleBadges roles={player.rolesWilling} player={player} gameMode={gameMode} />
        </>
      )}
    </div>
  );
}

interface AssignPopoverContentProps {
  roles: Role[];
  team1OpenRoles: Set<Role>;
  team2OpenRoles: Set<Role>;
  onAssign: (team: 1 | 2, role: Role) => void;
}

function AssignPopoverBody({
  roles,
  team1OpenRoles,
  team2OpenRoles,
  onAssign,
}: AssignPopoverContentProps) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="text-center">
        <div className="text-xs font-semibold text-pink-ink mb-1.5">← Team 1</div>
        <div className="flex gap-1">
          {roles.map((role) => {
            const open = team1OpenRoles.has(role);
            return (
              <Button
                key={`t1-${role}`}
                variant="quiet"
                size="xs"
                onClick={() => open && onAssign(1, role)}
                disabled={!open}
                className={cn(
                  open
                    ? [getRoleBadgeColor(role), "hover:opacity-85"]
                    : "bg-paper-3 border-rule text-muted"
                )}
                title={open ? undefined : `${role} is full on Team 1`}
              >
                {getRoleLabel(role)}
              </Button>
            );
          })}
        </div>
      </div>
      <Separator orientation="vertical" className="h-auto self-stretch" />
      <div className="text-center">
        <div className="text-xs font-semibold text-sky-ink mb-1.5">Team 2 →</div>
        <div className="flex gap-1">
          {roles.map((role) => {
            const open = team2OpenRoles.has(role);
            return (
              <Button
                key={`t2-${role}`}
                variant="quiet"
                size="xs"
                onClick={() => open && onAssign(2, role)}
                disabled={!open}
                className={cn(
                  open
                    ? [getRoleBadgeColor(role), "hover:opacity-85"]
                    : "bg-paper-3 border-rule text-muted"
                )}
                title={open ? undefined : `${role} is full on Team 2`}
              >
                {getRoleLabel(role)}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TeamPanelProps {
  players: LobbyPlayer[];
  onUnassign: (battletag: string) => void;
  onCycleRole: (battletag: string) => void;
  onDrop?: (battletag: string) => void;
  dragOver: boolean;
  onDragOverChange: (over: boolean) => void;
  compositionWarning: string | null;
}

function TeamPanel({
  players,
  onUnassign,
  onCycleRole,
  onDrop,
  dragOver,
  onDragOverChange,
  compositionWarning,
}: TeamPanelProps) {
  const gameMode = useSessionStore((state) => state.gameMode);
  const config = getModeConfig(gameMode);

  const roleCounts: Record<Role, number> = {
    Tank: config.composition.tank.max,
    DPS: config.composition.dps.max,
    Support: config.composition.support.max,
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      onDragOverChange(true);
    },
    [onDragOverChange]
  );

  const handleDragLeave = useCallback(() => {
    onDragOverChange(false);
  }, [onDragOverChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onDragOverChange(false);
      const battletag = e.dataTransfer.getData("text/plain");
      if (battletag && onDrop) {
        onDrop(battletag);
      }
    },
    [onDrop, onDragOverChange]
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-well p-1",
        dragOver && "bg-paper-2 ring-2 ring-focus"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {compositionWarning && (
        <Alert variant="warn" size="compact">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle className="text-warn">{compositionWarning}</AlertTitle>
        </Alert>
      )}
      {ROLE_ORDER.map((role) => {
        const playersInRole = players.filter((p) => p.lockedToRole === role);
        const emptySlots = Math.max(0, roleCounts[role] - playersInRole.length);

        return (
          <div key={role}>
            <div className={cn("text-xs font-semibold mb-1.5", getRoleTextColor(role))}>
              {role} ({playersInRole.length}/{roleCounts[role]})
            </div>
            <div className="flex flex-col gap-1.5">
              {playersInRole.map((player) => (
                <DraftPlayerCard
                  key={player.battletag}
                  player={player}
                  assignedRole={player.lockedToRole ?? undefined}
                  onClick={() => onUnassign(player.battletag)}
                  canCycleRole={player.rolesWilling.length > 1}
                  onCycleRole={() => onCycleRole(player.battletag)}
                  draggable
                />
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div
                  key={`empty-${role}-${i}`}
                  className={cn(
                    "flex items-center justify-center px-3 py-2 rounded-well bg-paper-2/70 border border-dashed text-xs text-muted",
                    getRoleBorderColor(role)
                  )}
                >
                  Open {role} slot
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DraftView() {
  const gameMode = useSessionStore((state) => state.gameMode);
  const getDraftState = useSessionStore((state) => state.getDraftState);
  const assignToTeam = useSessionStore((state) => state.assignToTeam);
  const unassignFromTeam = useSessionStore((state) => state.unassignFromTeam);
  const cycleRole = useSessionStore((state) => state.cycleRole);
  const fillRemaining = useSessionStore((state) => state.fillRemaining);
  const setPendingMatchResult = useSessionStore((state) => state.setPendingMatchResult);
  const pendingMatchResult = useSessionStore((state) => state.pendingMatchResult);
  const confirmMatchScore = useSessionStore((state) => state.confirmMatchScore);
  const cancelPendingMatch = useSessionStore((state) => state.cancelPendingMatch);
  const clearTeams = useSessionStore((state) => state.clearTeams);
  const autoBalanceAfterMatch = useSessionStore((state) => state.autoBalanceAfterMatch);
  const balanceDraftedPlayers = useSessionStore((state) => state.balanceDraftedPlayers);
  const config = getModeConfig(gameMode);

  useSessionStore((state) => state.lockedTeam1);
  useSessionStore((state) => state.lockedTeam2);
  useSessionStore((state) => state.lockedRoles);
  useSessionStore((state) => state.lobbyBattletags);
  useSessionStore((state) => state.afkPlayers);

  const [assignPopoverTag, setAssignPopoverTag] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);
  const [shuffleError, setShuffleError] = useState<string | null>(null);
  const [dragOverTeam1, setDragOverTeam1] = useState(false);
  const [dragOverTeam2, setDragOverTeam2] = useState(false);
  const [dragOverPool, setDragOverPool] = useState(false);
  const [roleFilter, setRoleFilter] = useState<Role | null>(null);
  const [postMatchPending, setPostMatchPending] = useState(false);

  const { team1, team2, unassigned } = getDraftState();

  const team1OpenRoles = getOpenRoles(team1, gameMode);
  const team2OpenRoles = getOpenRoles(team2, gameMode);
  const allOpenRoles = new Set([...team1OpenRoles, ...team2OpenRoles]);

  const team1Warning = getCompositionWarning(team1, gameMode);
  const team2Warning = getCompositionWarning(team2, gameMode);

  const sortedUnassigned = [...unassigned].sort((a, b) => {
    if (a.mustPlay && !b.mustPlay) return -1;
    if (!a.mustPlay && b.mustPlay) return 1;

    if (roleFilter) {
      const aHas = a.rolesWilling.includes(roleFilter);
      const bHas = b.rolesWilling.includes(roleFilter);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas) {
        return getEffectiveSR(b, roleFilter, gameMode) - getEffectiveSR(a, roleFilter, gameMode);
      }
    }
    const aRole = a.rolePreference[0] ?? a.rolesWilling[0] ?? "DPS";
    const bRole = b.rolePreference[0] ?? b.rolesWilling[0] ?? "DPS";
    return getEffectiveSR(b, bRole, gameMode) - getEffectiveSR(a, aRole, gameMode);
  });

  const isPlayerDimmed = (player: LobbyPlayer): boolean => {
    if (allOpenRoles.size === 0) return false;
    return !player.rolesWilling.some((role) => allOpenRoles.has(role));
  };

  const hasAssigned = team1.length > 0 || team2.length > 0;
  const hasSlotsRemaining = team1.length < config.teamSize || team2.length < config.teamSize;
  const showFillRemaining = hasAssigned && hasSlotsRemaining;
  const teamsAreFull = team1.length === config.teamSize && team2.length === config.teamSize;

  const handleFillRemaining = () => {
    setFillError(null);
    const result = fillRemaining();
    if (result.error) {
      setFillError(result.error);
    }
  };

  const handleShuffleDrafted = () => {
    setShuffleError(null);
    const result = balanceDraftedPlayers();
    if (result.error) {
      setShuffleError(result.error);
    }
  };

  const handleTeamWon = (team: 1 | 2) => {
    setPendingMatchResult(team);
  };

  const handleScoreConfirm = (
    winnerScore: number,
    loserScore: number,
    team1Cash?: number,
    team2Cash?: number,
    winnerAdj?: number,
    loserAdj?: number
  ) => {
    confirmMatchScore(winnerScore, loserScore, team1Cash, team2Cash, winnerAdj, loserAdj);
    setPostMatchPending(true);
  };

  const handleAutoBalanceNext = () => {
    setPostMatchPending(false);
    setTimeout(() => {
      autoBalanceAfterMatch();
    }, 0);
  };

  const handleDraftNext = () => {
    setPostMatchPending(false);
    clearTeams();
  };

  const handleNewGame = () => {
    clearTeams();
  };

  const handleAssign = (battletag: string, team: 1 | 2, role: Role) => {
    assignToTeam(battletag, team, role);
    setAssignPopoverTag(null);
  };

  const handleUnassign = (battletag: string) => {
    unassignFromTeam(battletag);
  };

  const handleCycleRole = (battletag: string) => {
    cycleRole(battletag);
  };

  const handleDragEnd = () => {
    setDragOverTeam1(false);
    setDragOverTeam2(false);
    setDragOverPool(false);
  };

  const handlePoolDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverPool(false);
      const battletag = e.dataTransfer.getData("text/plain");
      if (battletag) {
        unassignFromTeam(battletag);
      }
    },
    [unassignFromTeam]
  );

  const teamSize = config.teamSize;

  return (
    <div className="flex flex-col gap-4" onDragEnd={handleDragEnd}>
      {/* Team SR Comparison */}
      {team1.length > 0 && team2.length > 0 && (() => {
        const team1AvgSR =
          team1.length > 0
            ? Math.round(
                team1.reduce(
                  (sum, p) =>
                    sum + getEffectiveSR(p, p.lockedToRole ?? p.rolesWilling[0] ?? "DPS", gameMode),
                  0
                ) / team1.length
              )
            : 0;
        const team2AvgSR =
          team2.length > 0
            ? Math.round(
                team2.reduce(
                  (sum, p) =>
                    sum + getEffectiveSR(p, p.lockedToRole ?? p.rolesWilling[0] ?? "DPS", gameMode),
                  0
                ) / team2.length
              )
            : 0;
        const srDiff = Math.abs(team1AvgSR - team2AvgSR);

        return (
          <Card variant="well" className="p-3">
            <CardContent className="p-0">
              <div className="grid grid-cols-3 items-center gap-4 text-center">
                <div>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="text-lg app-display text-pink-ink inline-block" />
                      }
                    >
                      {team1.length > 0 ? formatRankOnly(team1AvgSR, gameMode) : "Pending"}
                    </TooltipTrigger>
                    <TooltipContent>{`${team1AvgSR} SR`}</TooltipContent>
                  </Tooltip>
                  <div className="text-xs font-semibold text-ink-2 flex items-center justify-center gap-1">
                    {team1AvgSR > team2AvgSR && srDiff >= 25 && team2.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex text-warn" />}>
                          <Star className="size-3 fill-current shrink-0" aria-label="Favored" />
                        </TooltipTrigger>
                        <TooltipContent>Favored</TooltipContent>
                      </Tooltip>
                    )}
                    <span>Team 1</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {team1.length > 0 && team2.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Badge
                            variant={srDiff <= 50 ? "ok" : srDiff <= 100 ? "warn" : "bad"}
                            className="px-3 py-0.5 text-sm app-display"
                          />
                        }
                      >
                        {srDiff < 25 ? <span>Even</span> : <span>Δ {srDiff} SR</span>}
                      </TooltipTrigger>
                      <TooltipContent>{`${srDiff} SR difference`}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="text-lg text-muted">vs</div>
                  )}
                  <div className="text-xs font-semibold text-muted">Difference</div>
                </div>
                <div>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="text-lg app-display text-sky-ink inline-block" />
                      }
                    >
                      {team2.length > 0 ? formatRankOnly(team2AvgSR, gameMode) : "Pending"}
                    </TooltipTrigger>
                    <TooltipContent>{`${team2AvgSR} SR`}</TooltipContent>
                  </Tooltip>
                  <div className="text-xs font-semibold text-ink-2 flex items-center justify-center gap-1">
                    {team2AvgSR > team1AvgSR && srDiff >= 25 && team1.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger render={<span className="inline-flex text-warn" />}>
                          <Star className="size-3 fill-current shrink-0" aria-label="Favored" />
                        </TooltipTrigger>
                        <TooltipContent>Favored</TooltipContent>
                      </Tooltip>
                    )}
                    <span>Team 2</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

        {/* 3-panel grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
          {/* Team 1 */}
          <Card variant="team1" className="p-4 min-w-0 gap-3">
            <CardHeader className="p-0">
              <CardTitle className="text-sm font-semibold text-pink-ink text-center">
                Team 1
                <span
                  className={cn(
                    "ml-2 text-xs font-normal app-measured",
                    team1.length === teamSize
                      ? "text-ok"
                      : team1.length > 0
                      ? "text-pink-ink"
                      : "text-muted"
                  )}
                >
                  ({team1.length}/{teamSize})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TeamPanel
                players={team1}
                onUnassign={handleUnassign}
                onCycleRole={handleCycleRole}
                onDrop={(bt) => assignToTeam(bt, 1)}
                dragOver={dragOverTeam1}
                onDragOverChange={setDragOverTeam1}
                compositionWarning={team1Warning}
              />
            </CardContent>
          </Card>

          {/* Unassigned Pool */}
          <Card
            variant="well"
            className={cn(
              "p-4 min-w-0 gap-3",
              dragOverPool && "ring-2 ring-focus bg-sky-soft"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverPool(true);
            }}
            onDragLeave={() => setDragOverPool(false)}
            onDrop={handlePoolDrop}
          >
            <CardHeader className="p-0 gap-2">
              <CardTitle className="text-sm font-semibold text-ink text-center">
                Unassigned
                <span className="ml-2 text-xs font-normal text-muted app-measured">
                  ({sortedUnassigned.length})
                </span>
              </CardTitle>
              <ToggleGroup
                multiple
                size="sm"
                aria-label="Filter unassigned players by role"
                value={roleFilter ? [roleFilter] : []}
                onValueChange={(vals) => {
                  const next = vals.find((v) => v !== roleFilter) ?? null;
                  setRoleFilter(next as Role | null);
                }}
                className="mx-auto"
              >
                {ROLE_ORDER.map((role) => (
                  <ToggleGroupItem key={role} value={role} className="py-0.5">
                    {getRoleLabel(role)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardHeader>
            <CardContent className="p-0">
              {sortedUnassigned.length === 0 ? (
                <Empty className="gap-2 p-4 py-6 md:p-6">
                  <EmptyHeader className="gap-1">
                    <EmptyDescription>All players assigned</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sortedUnassigned.map((player) => (
                    <Popover
                      key={player.battletag}
                      open={assignPopoverTag === player.battletag}
                      onOpenChange={(open) =>
                        setAssignPopoverTag(open ? player.battletag : null)
                      }
                    >
                      <PopoverTrigger
                        nativeButton={false}
                        render={
                          <DraftPlayerCard
                            player={player}
                            dimmed={isPlayerDimmed(player)}
                            draggable
                          />
                        }
                      />
                      <PopoverContent className="w-auto p-2.5">
                        <AssignPopoverBody
                          roles={player.rolesWilling}
                          team1OpenRoles={team1OpenRoles}
                          team2OpenRoles={team2OpenRoles}
                          onAssign={(team, role) => handleAssign(player.battletag, team, role)}
                        />
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team 2 */}
          <Card variant="team2" className="p-4 min-w-0 gap-3">
            <CardHeader className="p-0">
              <CardTitle className="text-sm font-semibold text-sky-ink text-center">
                Team 2
                <span
                  className={cn(
                    "ml-2 text-xs font-normal app-measured",
                    team2.length === teamSize
                      ? "text-ok"
                      : team2.length > 0
                      ? "text-sky-ink"
                      : "text-muted"
                  )}
                >
                  ({team2.length}/{teamSize})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TeamPanel
                players={team2}
                onUnassign={handleUnassign}
                onCycleRole={handleCycleRole}
                onDrop={(bt) => assignToTeam(bt, 2)}
                dragOver={dragOverTeam2}
                onDragOverChange={setDragOverTeam2}
                compositionWarning={team2Warning}
              />
            </CardContent>
          </Card>
        </div>

        {/* Fill Remaining / Shuffle Drafted */}
        {showFillRemaining && (
          <div className="text-center">
            <Button variant="primary" size="lg" onClick={handleFillRemaining}>
              <Zap data-icon="inline-start" aria-hidden="true" />
              Fill Remaining
            </Button>
            {fillError && (
              <Alert variant="bad" size="compact" className="mt-2 mx-auto w-fit text-left">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription className="text-bad">{fillError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {teamsAreFull && !postMatchPending && (
          <div className="text-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="sky" size="lg" onClick={handleShuffleDrafted} />
                }
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Shuffle Drafted
              </TooltipTrigger>
              <TooltipContent>Auto-balance just the drafted players</TooltipContent>
            </Tooltip>
            {shuffleError && (
              <Alert variant="bad" size="compact" className="mt-2 mx-auto w-fit text-left">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription className="text-bad">{shuffleError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Team Won / Post-Match buttons */}
        {(hasAssigned || postMatchPending) && (
          <div className="text-center">
            {postMatchPending ? (
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant="primary"
                  onClick={handleAutoBalanceNext}
                  className="py-2.5 px-5"
                >
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  Auto-Balance Next Game
                </Button>
                <Button
                  variant="sky"
                  onClick={handleDraftNext}
                  className="py-2.5 px-5"
                >
                  <Users data-icon="inline-start" aria-hidden="true" />
                  Draft Next Game
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center">
                <HoldButton
                  onConfirm={() => handleTeamWon(1)}
                  variant="win1"
                  className="py-2.5 px-5"
                  title="Hold for 1 second to confirm Team 1 won"
                >
                  <Trophy data-icon="inline-start" aria-hidden="true" />
                  Team 1 Won
                </HoldButton>
                <HoldButton
                  onConfirm={() => handleTeamWon(2)}
                  variant="sky"
                  className="py-2.5 px-5"
                  title="Hold for 1 second to confirm Team 2 won"
                >
                  <Trophy data-icon="inline-start" aria-hidden="true" />
                  Team 2 Won
                </HoldButton>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="secondary"
                        onClick={handleNewGame}
                        className="py-2.5 px-5"
                      />
                    }
                  >
                    <RefreshCw data-icon="inline-start" aria-hidden="true" />
                    New Game
                  </TooltipTrigger>
                  <TooltipContent>Clear teams without recording a result</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}

        {/* Match Score Modal */}
        <MatchScoreModal
          isOpen={!!pendingMatchResult}
          winningTeam={pendingMatchResult?.winningTeam ?? 1}
          onConfirm={handleScoreConfirm}
          onCancel={() => cancelPendingMatch()}
        />
    </div>
  );
}
