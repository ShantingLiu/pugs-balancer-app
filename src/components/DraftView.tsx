import { useState, useRef, useEffect, useCallback } from "react";
import { Users, Zap, RefreshCw, Trophy, AlertTriangle } from "lucide-react";
import type { LobbyPlayer, Role } from "@engine/types";
import { useSessionStore } from "@store/sessionStore";
import { getModeConfig } from "@engine/modeConfig";
import { parseBattletag } from "@utils/heroUtils";
import { getEffectiveSR, formatRankOnly } from "@utils/rankMapper";
import { HoldButton } from "./HoldButton";
import { MatchScoreModal } from "./MatchScoreModal";

// =============================================================================
// DraftView - 3-panel captain draft layout
// =============================================================================

const ROLE_ORDER: Role[] = ["Tank", "DPS", "Support"];

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

function getRoleTextColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "role-text-tank";
    case "DPS":
      return "role-text-dps";
    case "Support":
      return "role-text-support";
  }
}

/** Role icon letters */
function getRoleLabel(role: Role): string {
  return role.charAt(0);
}

/** Get willing role icons for a player */
function RoleBadges({
  roles,
  player,
  gameMode,
}: {
  roles: Role[];
  player?: LobbyPlayer;
  gameMode?: import("@engine/types").GameMode;
}) {
  return (
    <span className="flex flex-wrap gap-1 justify-end">
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
          <span
            key={role}
            className={`px-1.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap ${getRoleBadgeColor(role)}`}
          >
            {getRoleLabel(role)}
            {rankDisplay && (
              <span className="font-normal opacity-85 text-[11px]">{rankDisplay}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Get open (unfilled) roles for a team given current assignments and mode config */
function getOpenRoles(players: LobbyPlayer[], gameMode: string): Set<Role> {
  const config = getModeConfig(gameMode as import("@engine/types").GameMode);
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

/** Check if a team has a composition conflict (more players in a role than allowed) */
function getCompositionWarning(players: LobbyPlayer[], gameMode: string): string | null {
  const config = getModeConfig(gameMode as import("@engine/types").GameMode);
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

// =============================================================================
// DraftPlayerCard - Compact card for draft panels
// =============================================================================

interface DraftPlayerCardProps {
  player: LobbyPlayer;
  onClick: (e: React.MouseEvent) => void;
  assignedRole?: Role;
  canCycleRole?: boolean;
  onCycleRole?: () => void;
  dimmed?: boolean;
  draggable?: boolean;
  onDragStart?: (battletag: string) => void;
}

function DraftPlayerCard({
  player,
  onClick,
  assignedRole,
  canCycleRole,
  onCycleRole,
  dimmed,
  draggable: isDraggable,
  onDragStart,
}: DraftPlayerCardProps) {
  const gameMode = useSessionStore((state) => state.gameMode);
  const showWeightModifiers = useSessionStore((state) => state.showWeightModifiers);
  const { name } = parseBattletag(player.battletag);
  const displayRole = assignedRole ?? player.lockedToRole;
  const sr = displayRole ? getEffectiveSR(player, displayRole, gameMode) : null;

  // Calculate modifier breakdown for display
  const adaptiveWeight = player.adaptiveWeight ?? 0;
  const manualMod = (player.tempWeightOverride ?? 0) + (player.weightModifier ?? 0);
  const totalModifier = adaptiveWeight + manualMod;

  // Format SR display with rank name and modifiers
  const formatSRDisplay = () => {
    if (sr === null) return null;

    const baseRank = formatRankOnly(sr - totalModifier, gameMode);

    if (totalModifier === 0) {
      return <span className="text-sm text-muted">{baseRank}</span>;
    }

    const showManual = showWeightModifiers && manualMod !== 0;
    const showAdaptive = adaptiveWeight !== 0;

    if (!showManual && !showAdaptive) {
      return <span className="text-sm text-muted">{baseRank}</span>;
    }

    return (
      <span className="text-sm text-muted">
        {baseRank}
        {showManual && (
          <span className={`app-measured ${manualMod > 0 ? "text-ok" : "text-bad"}`}>
            {" "}
            {manualMod > 0 ? "+" : ""}
            {manualMod}
          </span>
        )}
        {showAdaptive && (
          <span className={`app-measured ${adaptiveWeight > 0 ? "text-accent" : "text-bad"}`}>
            {" "}
            {adaptiveWeight > 0 ? "+" : ""}
            {adaptiveWeight}
          </span>
        )}
      </span>
    );
  };

  return (
    <div
      className={`
        flex items-center justify-between gap-2 px-3 py-2 app-card
        hover:border-[var(--color-accent)] cursor-pointer transition-colors select-none
        ${player.mustPlay ? "outline outline-2 outline-[var(--color-accent)]" : ""}
        ${player.isAfk ? "opacity-50" : ""}
        ${dimmed ? "opacity-40" : ""}
      `}
      onClick={(e) => onClick(e)}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (isDraggable && onDragStart) {
          e.dataTransfer.setData("text/plain", player.battletag);
          e.dataTransfer.effectAllowed = "move";
          onDragStart(player.battletag);
        }
      }}
    >
      {displayRole ? (
        <>
          <button
            className={`
              px-2 py-1 text-xs font-bold
              ${getRoleBadgeColor(displayRole)}
              ${canCycleRole ? "cursor-pointer" : ""}
            `}
            onClick={(e) => {
              if (canCycleRole && onCycleRole) {
                e.stopPropagation();
                onCycleRole();
              }
            }}
            title={canCycleRole ? "Click to cycle role" : undefined}
          >
            {getRoleLabel(displayRole)}
            {canCycleRole && <span className="ml-0.5 text-[8px]">⟳</span>}
          </button>
          <span className="flex-1 font-medium text-ink">{name}</span>
          {formatSRDisplay()}
        </>
      ) : (
        <>
          <span className="font-medium text-ink truncate min-w-0">{name}</span>
          <RoleBadges roles={player.rolesWilling} player={player} gameMode={gameMode} />
        </>
      )}
    </div>
  );
}

// =============================================================================
// AssignPopup - Inline popup for team assignment
// =============================================================================

interface AssignPopupProps {
  anchorRect: DOMRect;
  roles: Role[];
  team1OpenRoles: Set<Role>;
  team2OpenRoles: Set<Role>;
  onAssign: (team: 1 | 2, role: Role) => void;
  onClose: () => void;
}

function AssignPopup({
  anchorRect,
  roles,
  team1OpenRoles,
  team2OpenRoles,
  onAssign,
  onClose,
}: AssignPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 4,
    left: anchorRect.left + anchorRect.width / 2,
    transform: "translateX(-50%)",
    zIndex: 50,
  };

  return (
    <div ref={popupRef} style={style} className="app-modal p-2 flex gap-3">
      <div className="text-center">
        <div className="text-[10px] text-muted mb-1">← Team 1</div>
        <div className="flex gap-1">
          {roles.map((role) => {
            const open = team1OpenRoles.has(role);
            return (
              <button
                key={`t1-${role}`}
                onClick={() => open && onAssign(1, role)}
                disabled={!open}
                className={`px-2 py-1 text-xs font-bold transition-colors ${
                  open ? getRoleBadgeColor(role) : "app-chip cursor-not-allowed"
                }`}
                title={open ? undefined : `${role} is full on Team 1`}
              >
                {getRoleLabel(role)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="w-px bg-[var(--color-rule)]" />
      <div className="text-center">
        <div className="text-[10px] text-muted mb-1">Team 2 →</div>
        <div className="flex gap-1">
          {roles.map((role) => {
            const open = team2OpenRoles.has(role);
            return (
              <button
                key={`t2-${role}`}
                onClick={() => open && onAssign(2, role)}
                disabled={!open}
                className={`px-2 py-1 text-xs font-bold transition-colors ${
                  open ? getRoleBadgeColor(role) : "app-chip cursor-not-allowed"
                }`}
                title={open ? undefined : `${role} is full on Team 2`}
              >
                {getRoleLabel(role)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TeamPanel - Shows assigned players grouped by role with empty slot placeholders
// =============================================================================

interface TeamPanelProps {
  players: LobbyPlayer[];
  onUnassign: (battletag: string) => void;
  onCycleRole: (battletag: string) => void;
  onDrop?: (battletag: string) => void;
  onDragStart?: (battletag: string) => void;
  dragOver: boolean;
  onDragOverChange: (over: boolean) => void;
  compositionWarning: string | null;
}

function TeamPanel({
  players,
  onUnassign,
  onCycleRole,
  onDrop,
  onDragStart,
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
      className={`space-y-3 rounded-[var(--radius-card)] p-1 transition-colors ${
        dragOver ? "bg-accent-soft outline outline-1 outline-[var(--color-accent)]" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {compositionWarning && (
        <div className="text-xs app-alert-accent px-2 py-1 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {compositionWarning}
        </div>
      )}
      {ROLE_ORDER.map((role) => {
        const playersInRole = players.filter((p) => p.lockedToRole === role);
        const emptySlots = Math.max(0, roleCounts[role] - playersInRole.length);

        return (
          <div key={role}>
            <div className={`text-xs font-medium mb-1 ${getRoleTextColor(role)}`}>
              {role} ({playersInRole.length}/{roleCounts[role]})
            </div>
            <div className="space-y-1">
              {playersInRole.map((player) => (
                <DraftPlayerCard
                  key={player.battletag}
                  player={player}
                  assignedRole={player.lockedToRole ?? undefined}
                  onClick={() => onUnassign(player.battletag)}
                  canCycleRole={player.rolesWilling.length > 1}
                  onCycleRole={() => onCycleRole(player.battletag)}
                  draggable
                  onDragStart={onDragStart}
                />
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div
                  key={`empty-${role}-${i}`}
                  className="flex items-center justify-center px-2.5 py-2.5 rounded-[var(--radius-card)] border border-dashed role-slot text-xs whitespace-nowrap"
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

// =============================================================================
// DraftView - Main 3-panel draft component
// =============================================================================

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

  // Re-render when locks change
  useSessionStore((state) => state.lockedTeam1);
  useSessionStore((state) => state.lockedTeam2);
  useSessionStore((state) => state.lockedRoles);
  useSessionStore((state) => state.lobbyBattletags);
  useSessionStore((state) => state.afkPlayers);

  const [popup, setPopup] = useState<{ battletag: string; rect: DOMRect } | null>(null);
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

  const handlePlayerClick = (battletag: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopup({ battletag, rect });
  };

  const handleAssign = (team: 1 | 2, role: Role) => {
    if (popup) {
      assignToTeam(popup.battletag, team, role);
      setPopup(null);
    }
  };

  const handleUnassign = (battletag: string) => {
    unassignFromTeam(battletag);
  };

  const handleCycleRole = (battletag: string) => {
    cycleRole(battletag);
  };

  const handleDragStart = () => {};

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
    <div className="space-y-4" onDragEnd={handleDragEnd}>
      {/* Team SR Comparison */}
      {team1.length > 0 &&
        team2.length > 0 &&
        (() => {
          const team1AvgSR =
            team1.length > 0
              ? Math.round(
                  team1.reduce(
                    (sum, p) =>
                      sum +
                      getEffectiveSR(p, p.lockedToRole ?? p.rolesWilling[0] ?? "DPS", gameMode),
                    0
                  ) / team1.length
                )
              : 0;
          const team2AvgSR =
            team2.length > 0
              ? Math.round(
                  team2.reduce(
                    (sum, p) =>
                      sum +
                      getEffectiveSR(p, p.lockedToRole ?? p.rolesWilling[0] ?? "DPS", gameMode),
                    0
                  ) / team2.length
                )
              : 0;
          const srDiff = Math.abs(team1AvgSR - team2AvgSR);

          return (
            <div className="app-subsurface p-4">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-xl font-bold text-accent" title={`${team1AvgSR} SR`}>
                    {team1.length > 0 ? formatRankOnly(team1AvgSR, gameMode) : "Pending"}
                  </div>
                  <div className="text-xs text-muted">Team 1</div>
                  <div className="text-xs mt-1 h-4">
                    {team1AvgSR > team2AvgSR && srDiff >= 25 && team2.length > 0 && (
                      <span className="text-ok font-medium">Favored</span>
                    )}
                    {team1AvgSR < team2AvgSR && srDiff >= 25 && team1.length > 0 && (
                      <span className="text-bad font-medium">Underdog</span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  {team1.length > 0 && team2.length > 0 ? (
                    <div
                      className={`text-lg font-bold app-measured ${
                        srDiff <= 50 ? "text-ok" : srDiff <= 100 ? "text-accent" : "text-bad"
                      }`}
                      title={`${srDiff} SR difference`}
                    >
                      {srDiff < 25 ? <span>Even</span> : <span>Delta {srDiff} SR</span>}
                    </div>
                  ) : (
                    <div className="text-lg text-muted">vs</div>
                  )}
                  <div className="text-xs text-muted">Difference</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-accent" title={`${team2AvgSR} SR`}>
                    {team2.length > 0 ? formatRankOnly(team2AvgSR, gameMode) : "Pending"}
                  </div>
                  <div className="text-xs text-muted">Team 2</div>
                  <div className="text-xs mt-1 h-4">
                    {team2AvgSR > team1AvgSR && srDiff >= 25 && team1.length > 0 && (
                      <span className="text-ok font-medium">Favored</span>
                    )}
                    {team2AvgSR < team1AvgSR && srDiff >= 25 && team2.length > 0 && (
                      <span className="text-bad font-medium">Underdog</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* 3-panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(240px,280px)_minmax(0,1fr)] gap-4 items-start">
        {/* Team 1 */}
        <div className="app-subsurface p-4">
          <h3 className="text-sm font-bold text-accent mb-3 text-center">
            Team 1
            <span
              className={`ml-2 text-xs font-normal app-measured ${
                team1.length === teamSize
                  ? "text-ok"
                  : team1.length > 0
                  ? "text-accent"
                  : "text-muted"
              }`}
            >
              ({team1.length}/{teamSize})
            </span>
          </h3>
          <TeamPanel
            players={team1}
            onUnassign={handleUnassign}
            onCycleRole={handleCycleRole}
            onDrop={(bt) => assignToTeam(bt, 1)}
            onDragStart={handleDragStart}
            dragOver={dragOverTeam1}
            onDragOverChange={setDragOverTeam1}
            compositionWarning={team1Warning}
          />
        </div>

        {/* Unassigned Pool */}
        <div
          className={`app-subsurface p-4 min-w-[220px] transition-colors ${
            dragOverPool ? "bg-accent-soft outline outline-1 outline-[var(--color-accent)]" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverPool(true);
          }}
          onDragLeave={() => setDragOverPool(false)}
          onDrop={handlePoolDrop}
        >
          <h3 className="text-sm font-bold text-ink-2 mb-2 text-center">
            Unassigned
            <span className="ml-2 text-xs font-normal text-muted app-measured">
              ({sortedUnassigned.length})
            </span>
          </h3>
          <div className="flex justify-center gap-1.5 mb-3 whitespace-nowrap">
            {(["Tank", "DPS", "Support"] as Role[]).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={`
                  px-2.5 py-0.5 text-xs font-bold transition-colors
                  ${roleFilter === role ? getRoleBadgeColor(role) : "app-chip"}
                `}
              >
                {getRoleLabel(role)}
              </button>
            ))}
          </div>
          {sortedUnassigned.length === 0 ? (
            <div className="text-center text-muted text-sm py-8">All players assigned</div>
          ) : (
            <div className="space-y-1 max-h-[540px] overflow-y-auto overflow-x-hidden pr-1">
              {sortedUnassigned.map((player) => (
                <DraftPlayerCard
                  key={player.battletag}
                  player={player}
                  onClick={(e) => handlePlayerClick(player.battletag, e)}
                  dimmed={isPlayerDimmed(player)}
                  draggable
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="app-subsurface p-4">
          <h3 className="text-sm font-bold text-accent mb-3 text-center">
            Team 2
            <span
              className={`ml-2 text-xs font-normal app-measured ${
                team2.length === teamSize
                  ? "text-ok"
                  : team2.length > 0
                  ? "text-accent"
                  : "text-muted"
              }`}
            >
              ({team2.length}/{teamSize})
            </span>
          </h3>
          <TeamPanel
            players={team2}
            onUnassign={handleUnassign}
            onCycleRole={handleCycleRole}
            onDrop={(bt) => assignToTeam(bt, 2)}
            onDragStart={handleDragStart}
            dragOver={dragOverTeam2}
            onDragOverChange={setDragOverTeam2}
            compositionWarning={team2Warning}
          />
        </div>
      </div>

      {/* Fill Remaining / Shuffle Drafted buttons */}
      {showFillRemaining && (
        <div className="text-center">
          <button
            onClick={handleFillRemaining}
            className="px-6 py-2 app-primary font-medium transition-colors"
          >
            <Zap className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
            Fill Remaining
          </button>
          {fillError && (
            <div className="mt-2 text-sm app-alert-error px-3 py-1.5 inline-block">
              {fillError}
            </div>
          )}
        </div>
      )}

      {teamsAreFull && !postMatchPending && (
        <div className="text-center">
          <button
            onClick={handleShuffleDrafted}
            className="px-6 py-2 app-secondary font-medium transition-colors"
            title="Auto-balance just the drafted players"
          >
            <RefreshCw className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
            Shuffle Drafted
          </button>
          {shuffleError && (
            <div className="mt-2 text-sm app-alert-error px-3 py-1.5 inline-block">
              {shuffleError}
            </div>
          )}
        </div>
      )}

      {/* Team Won / Post-Match buttons */}
      {(hasAssigned || postMatchPending) && (
        <div className="text-center">
          {postMatchPending ? (
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleAutoBalanceNext}
                className="py-2 px-4 app-primary font-medium transition-colors"
              >
                <RefreshCw className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
                Auto-Balance Next Game
              </button>
              <button
                onClick={handleDraftNext}
                className="py-2 px-4 app-secondary font-medium transition-colors"
              >
                <Users className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
                Draft Next Game
              </button>
            </div>
          ) : (
            <div className="flex gap-4 justify-center">
              <HoldButton
                onConfirm={() => handleTeamWon(1)}
                className="py-2 px-4 app-primary font-medium transition-colors"
                title="Hold for 1 second to confirm Team 1 won"
              >
                <Trophy className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
                Team 1 Won
              </HoldButton>
              <HoldButton
                onConfirm={() => handleTeamWon(2)}
                className="py-2 px-4 app-primary font-medium transition-colors"
                title="Hold for 1 second to confirm Team 2 won"
              >
                <Trophy className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
                Team 2 Won
              </HoldButton>
              <button
                onClick={handleNewGame}
                className="py-2 px-4 app-secondary font-medium transition-colors"
                title="Clear teams without recording a result"
              >
                <RefreshCw className="inline-block w-5 h-5 mr-1 -mt-0.5" aria-hidden="true" />
                New Game
              </button>
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

      {/* Assign popup */}
      {popup &&
        (() => {
          const popupPlayer = unassigned.find((p) => p.battletag === popup.battletag);
          return (
            <AssignPopup
              anchorRect={popup.rect}
              roles={popupPlayer?.rolesWilling ?? []}
              team1OpenRoles={team1OpenRoles}
              team2OpenRoles={team2OpenRoles}
              onAssign={handleAssign}
              onClose={() => setPopup(null)}
            />
          );
        })()}
    </div>
  );
}
