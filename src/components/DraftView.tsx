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
  gameMode?: import("@engine/types").GameMode;
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
          <span
            key={role}
            className={`px-2 py-0.5 text-xs font-semibold rounded-pill inline-flex items-center gap-1 ${getRoleBadgeColor(role)}`}
          >
            {getRoleLabel(role)}
            {rankDisplay && <span className="font-normal text-[11px]">{rankDisplay}</span>}
          </span>
        );
      })}
    </span>
  );
}

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
    const showAdaptive = adaptiveWeight !== 0;

    if (!showManual && !showAdaptive) {
      return <span className="text-xs text-ink-2">{baseRank}</span>;
    }

    return (
      <span className="text-xs text-ink-2">
        {baseRank}
        {showManual && (
          <span className={`app-measured ${manualMod > 0 ? "text-ok" : "text-bad"}`}>
            {" "}{manualMod > 0 ? "+" : ""}{manualMod}
          </span>
        )}
        {showAdaptive && (
          <span className={`app-measured ${adaptiveWeight > 0 ? "text-sky-ink" : "text-pink-ink"}`}>
            {" "}{adaptiveWeight > 0 ? "+" : ""}{adaptiveWeight}
          </span>
        )}
      </span>
    );
  };

  return (
    <div
      className={`app-player-row app-card-interactive flex items-center gap-2.5 px-3 py-2 rounded-well border border-rule cursor-pointer select-none ${
        player.isAfk ? "opacity-55" : ""
      } ${dimmed ? "opacity-45" : ""}`}
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
            type="button"
            className={`px-2 py-0.5 text-xs font-semibold rounded-pill inline-flex items-center gap-1 ${getRoleBadgeColor(
              displayRole
            )} ${canCycleRole ? "hover:opacity-85 cursor-pointer" : ""}`}
            onClick={(e) => {
              if (canCycleRole && onCycleRole) {
                e.stopPropagation();
                onCycleRole();
              }
            }}
            title={canCycleRole ? "Click to cycle role" : undefined}
          >
            {getRoleLabel(displayRole)}
            {canCycleRole && <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />}
          </button>
          <span className="flex-1 font-semibold text-ink truncate">{name}</span>
          {formatSRDisplay()}
        </>
      ) : (
        <>
          <span className="font-semibold text-ink">{name}</span>
          <RoleBadges roles={player.rolesWilling} player={player} gameMode={gameMode} />
        </>
      )}
    </div>
  );
}

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
    <div ref={popupRef} style={style} className="app-modal p-2.5 flex gap-3">
      <div className="text-center">
        <div className="text-xs font-semibold text-pink-ink mb-1.5">← Team 1</div>
        <div className="flex gap-1">
          {roles.map((role) => {
            const open = team1OpenRoles.has(role);
            return (
              <button
                type="button"
                key={`t1-${role}`}
                onClick={() => open && onAssign(1, role)}
                disabled={!open}
                className={`px-2.5 py-1 text-xs font-semibold rounded-pill ${
                  open
                    ? getRoleBadgeColor(role)
                    : "bg-paper-3 border border-rule text-muted cursor-not-allowed"
                }`}
                title={open ? undefined : `${role} is full on Team 1`}
              >
                {getRoleLabel(role)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="w-px bg-rule" />
      <div className="text-center">
        <div className="text-xs font-semibold text-sky-ink mb-1.5">Team 2 →</div>
        <div className="flex gap-1">
          {roles.map((role) => {
            const open = team2OpenRoles.has(role);
            return (
              <button
                type="button"
                key={`t2-${role}`}
                onClick={() => open && onAssign(2, role)}
                disabled={!open}
                className={`px-2.5 py-1 text-xs font-semibold rounded-pill ${
                  open
                    ? getRoleBadgeColor(role)
                    : "bg-paper-3 border border-rule text-muted cursor-not-allowed"
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
      className={`space-y-3 rounded-well p-1 ${
        dragOver ? "bg-paper-2 ring-2 ring-focus" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {compositionWarning && (
        <div className="text-xs text-warn bg-warn-soft border border-warn-edge rounded-well px-2.5 py-1.5 flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {compositionWarning}
        </div>
      )}
      {ROLE_ORDER.map((role) => {
        const playersInRole = players.filter((p) => p.lockedToRole === role);
        const emptySlots = Math.max(0, roleCounts[role] - playersInRole.length);

        return (
          <div key={role}>
            <div className={`text-xs font-semibold mb-1.5 ${getRoleTextColor(role)}`}>
              {role} ({playersInRole.length}/{roleCounts[role]})
            </div>
            <div className="space-y-1.5">
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
                  className={`flex items-center justify-center px-3 py-2 rounded-well bg-paper-2/70 border border-dashed ${getRoleBorderColor(
                    role
                  )} text-xs text-muted`}
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

  const handleDragStart = (_battletag: string) => {};

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
      {team1.length > 0 && team2.length > 0 && (() => {
        const team1AvgSR =
          team1.length > 0
            ? Math.round(
                team1.reduce(
                  (sum, p) => sum + getEffectiveSR(p, p.lockedToRole ?? p.rolesWilling[0] ?? "DPS", gameMode),
                  0
                ) / team1.length
              )
            : 0;
        const team2AvgSR =
          team2.length > 0
            ? Math.round(
                team2.reduce(
                  (sum, p) => sum + getEffectiveSR(p, p.lockedToRole ?? p.rolesWilling[0] ?? "DPS", gameMode),
                  0
                ) / team2.length
              )
            : 0;
        const srDiff = Math.abs(team1AvgSR - team2AvgSR);

        return (
          <div className="app-well p-3">
            <div className="grid grid-cols-3 items-center gap-4 text-center">
              <div>
                <div className="text-xl font-semibold text-pink-ink" title={`${team1AvgSR} SR`}>
                  {team1.length > 0 ? formatRankOnly(team1AvgSR, gameMode) : "Pending"}
                </div>
                <div className="text-xs font-semibold text-ink-2">Team 1</div>
                <div className="text-xs mt-1 min-h-4">
                  {team1AvgSR > team2AvgSR && srDiff >= 25 && team2.length > 0 && (
                    <span className="px-2 py-0.5 rounded-pill bg-ok-soft text-ok font-semibold">Favored</span>
                  )}
                  {team1AvgSR < team2AvgSR && srDiff >= 25 && team1.length > 0 && (
                    <span className="px-2 py-0.5 rounded-pill bg-bad-soft text-bad font-semibold">Underdog</span>
                  )}
                </div>
              </div>
              <div>
                {team1.length > 0 && team2.length > 0 ? (
                  <div
                    className={`text-lg font-semibold app-measured ${
                      srDiff <= 50 ? "text-ok" : srDiff <= 100 ? "text-warn" : "text-bad"
                    }`}
                    title={`${srDiff} SR difference`}
                  >
                    {srDiff < 25 ? <span>Even</span> : <span>Delta {srDiff} SR</span>}
                  </div>
                ) : (
                  <div className="text-lg text-muted">vs</div>
                )}
                <div className="text-xs font-semibold text-muted">Difference</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-sky-ink" title={`${team2AvgSR} SR`}>
                  {team2.length > 0 ? formatRankOnly(team2AvgSR, gameMode) : "Pending"}
                </div>
                <div className="text-xs font-semibold text-ink-2">Team 2</div>
                <div className="text-xs mt-1 min-h-4">
                  {team2AvgSR > team1AvgSR && srDiff >= 25 && team1.length > 0 && (
                    <span className="px-2 py-0.5 rounded-pill bg-ok-soft text-ok font-semibold">Favored</span>
                  )}
                  {team2AvgSR < team1AvgSR && srDiff >= 25 && team2.length > 0 && (
                    <span className="px-2 py-0.5 rounded-pill bg-bad-soft text-bad font-semibold">Underdog</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3-panel grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4">
        {/* Team 1 */}
        <div className="app-team-1 p-4">
          <h3 className="text-sm font-semibold text-pink-ink mb-3 text-center">
            Team 1
            <span
              className={`ml-2 text-xs font-normal app-measured ${
                team1.length === teamSize ? "text-ok" : team1.length > 0 ? "text-pink-ink" : "text-muted"
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
          className={`app-well p-4 min-w-[220px] ${
            dragOverPool ? "ring-2 ring-focus bg-sky-soft" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverPool(true);
          }}
          onDragLeave={() => setDragOverPool(false)}
          onDrop={handlePoolDrop}
        >
          <h3 className="text-sm font-semibold text-ink mb-1 text-center">
            Unassigned
            <span className="ml-2 text-xs font-normal text-muted app-measured">
              ({sortedUnassigned.length})
            </span>
          </h3>
          <div className="flex justify-center gap-1.5 mb-3">
            {(["Tank", "DPS", "Support"] as Role[]).map((role) => (
              <button
                type="button"
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-pill border ${
                  roleFilter === role
                    ? getRoleBadgeColor(role)
                    : "bg-paper-2 border-rule text-ink-2 hover:bg-sky-soft"
                }`}
              >
                {getRoleLabel(role)}
              </button>
            ))}
          </div>
          {sortedUnassigned.length === 0 ? (
            <div className="text-center text-muted text-sm py-8">
              All players assigned
            </div>
          ) : (
            <div className="space-y-1.5">
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
        <div className="app-team-2 p-4">
          <h3 className="text-sm font-semibold text-sky-ink mb-3 text-center">
            Team 2
            <span
              className={`ml-2 text-xs font-normal app-measured ${
                team2.length === teamSize ? "text-ok" : team2.length > 0 ? "text-sky-ink" : "text-muted"
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

      {/* Fill Remaining / Shuffle Drafted */}
      {showFillRemaining && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleFillRemaining}
            className="px-6 py-2.5 app-primary rounded-pill font-semibold inline-flex items-center gap-2"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            Fill Remaining
          </button>
          {fillError && (
            <div className="mt-2 text-sm text-bad bg-bad-soft border border-bad-edge rounded-well px-3 py-1.5 inline-block">
              {fillError}
            </div>
          )}
        </div>
      )}

      {teamsAreFull && !postMatchPending && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleShuffleDrafted}
            className="px-6 py-2.5 app-sky rounded-pill font-semibold inline-flex items-center gap-2"
            title="Auto-balance just the drafted players"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Shuffle Drafted
          </button>
          {shuffleError && (
            <div className="mt-2 text-sm text-bad bg-bad-soft border border-bad-edge rounded-well px-3 py-1.5 inline-block">
              {shuffleError}
            </div>
          )}
        </div>
      )}

      {/* Team Won / Post-Match buttons */}
      {(hasAssigned || postMatchPending) && (
        <div className="text-center">
          {postMatchPending ? (
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={handleAutoBalanceNext}
                className="py-2.5 px-5 app-primary rounded-pill font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Auto-Balance Next Game
              </button>
              <button
                type="button"
                onClick={handleDraftNext}
                className="py-2.5 px-5 app-sky rounded-pill font-semibold inline-flex items-center gap-2"
              >
                <Users className="w-4 h-4" aria-hidden="true" />
                Draft Next Game
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 justify-center">
              <HoldButton
                onConfirm={() => handleTeamWon(1)}
                className="py-2.5 px-5 app-primary rounded-pill font-semibold inline-flex items-center gap-2"
                title="Hold for 1 second to confirm Team 1 won"
              >
                <Trophy className="inline-block w-4 h-4 mr-1.5 -mt-0.5" aria-hidden="true" />
                Team 1 Won
              </HoldButton>
              <HoldButton
                onConfirm={() => handleTeamWon(2)}
                className="py-2.5 px-5 app-sky rounded-pill font-semibold inline-flex items-center gap-2"
                title="Hold for 1 second to confirm Team 2 won"
              >
                <Trophy className="inline-block w-4 h-4 mr-1.5 -mt-0.5" aria-hidden="true" />
                Team 2 Won
              </HoldButton>
              <button
                type="button"
                onClick={handleNewGame}
                className="py-2.5 px-5 app-secondary rounded-pill font-semibold inline-flex items-center gap-2"
                title="Clear teams without recording a result"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
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
      {popup && (() => {
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
