import { useState, type ReactNode } from "react";
import { LockKeyhole, LockKeyholeOpen, RefreshCw, Pencil, ArrowLeftRight } from "lucide-react";
import type { RoleAssignment, Role, LobbyPlayer, GameMode } from "@engine/types";
import { useSessionStore } from "@store/sessionStore";
import { formatRankOnly, getEffectiveSR } from "@utils/rankMapper";

// =============================================================================
// TeamColumn - Displays a single team's composition
// =============================================================================

interface TeamColumnProps {
  teamNumber: 1 | 2;
  assignments: RoleAssignment[];
  averageSR: number;
  onEditPlayer?: (battletag: string) => void;
  /** Current swap source battletag (lifted to parent for cross-team swaps) */
  swapSource: string | null;
  /** Handler for swap button clicks */
  onSwapClick: (battletag: string) => void;
}

/** Role order for display */
const ROLE_ORDER: Role[] = ["Tank", "DPS", "Support"];

/** Get the total modifier for a lobby player (manual + adaptive) */
function getPlayerModifier(lobbyPlayer: LobbyPlayer | undefined): number {
  if (!lobbyPlayer) return 0;
  const manual = (lobbyPlayer.tempWeightOverride ?? 0) + (lobbyPlayer.weightModifier ?? 0);
  const adaptive = lobbyPlayer.adaptiveWeight ?? 0;
  return manual + adaptive;
}

/** Get just the adaptive weight for a lobby player */
function getAdaptiveWeight(lobbyPlayer: LobbyPlayer | undefined): number {
  if (!lobbyPlayer) return 0;
  return lobbyPlayer.adaptiveWeight ?? 0;
}

/** Format rank with modifier display (shows manual and adaptive separately) */
function formatRankWithModifier(
  effectiveSR: number,
  modifier: number,
  adaptiveWeight: number,
  mode: GameMode,
  showManualModifier: boolean = true
): ReactNode {
  const baseRank = formatRankOnly(effectiveSR - modifier, mode);

  const manualMod = modifier - adaptiveWeight;
  const showManual = showManualModifier && manualMod !== 0;
  const showAdaptive = adaptiveWeight !== 0;

  if (!showManual && !showAdaptive) {
    return <>{baseRank}</>;
  }

  if (showManual && showAdaptive) {
    const manualSign = manualMod > 0 ? "+" : "";
    const adaptiveSign = adaptiveWeight > 0 ? "+" : "";
    return (
      <>
        {baseRank}{" "}
        <span className={`app-measured ${manualMod > 0 ? "text-ok" : "text-bad"}`}>
          {manualSign}
          {manualMod}
        </span>
        <span className={`app-measured ${adaptiveWeight > 0 ? "text-accent" : "text-bad"}`}>
          {" "}
          {adaptiveSign}
          {adaptiveWeight}
        </span>
      </>
    );
  }

  if (showAdaptive) {
    const sign = adaptiveWeight > 0 ? "+" : "";
    return (
      <>
        {baseRank}{" "}
        <span className={`app-measured ${adaptiveWeight > 0 ? "text-accent" : "text-bad"}`}>
          {sign}
          {adaptiveWeight}
        </span>
      </>
    );
  }

  const sign = manualMod > 0 ? "+" : "";
  return (
    <>
      {baseRank}{" "}
      <span className={`app-measured ${manualMod > 0 ? "text-ok" : "text-bad"}`}>
        {sign}
        {manualMod}
      </span>
    </>
  );
}

/** Get role color for header */
function getRoleColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "role-text-tank";
    case "DPS":
      return "role-text-dps";
    case "Support":
      return "role-text-support";
  }
}

/** Get role badge color */
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
  const lobbyMap = new Map<string, LobbyPlayer>(lobbyPlayers.map((lp) => [lp.battletag, lp]));

  const playersOnTeams = new Set<string>();
  if (lastResult) {
    lastResult.team1.forEach((ra) => playersOnTeams.add(ra.player.battletag));
    lastResult.team2.forEach((ra) => playersOnTeams.add(ra.player.battletag));
  }

  const getEligibleSubstitutes = (role: Role): LobbyPlayer[] => {
    return lobbyPlayers
      .filter(
        (lp) =>
          !playersOnTeams.has(lp.battletag) && !lp.isAfk && lp.rolesWilling.includes(role)
      )
      .sort((a, b) => getEffectiveSR(b, role) - getEffectiveSR(a, role));
  };

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    players: assignments.filter((a) => a.assignedRole === role),
  }));

  return (
    <div className="app-subsurface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-ink">Team {teamNumber}</h3>
        <div className="text-lg font-semibold text-accent" title={`${averageSR.toFixed(0)} SR`}>
          {formatRankOnly(averageSR, gameMode)}
        </div>
      </div>

      {/* Role sections */}
      <div className="space-y-3">
        {byRole.map(({ role, players }) => (
          <div key={role}>
            <div className={`text-sm font-medium mb-1 ${getRoleColor(role)}`}>{role}</div>
            <div className="space-y-1">
              {players.map((assignment) => {
                const battletag = assignment.player.battletag;
                const lobbyPlayer = lobbyMap.get(battletag);
                const isLocked = lobbyPlayer?.lockedToTeam === teamNumber;
                const modifier = getPlayerModifier(lobbyPlayer);
                const adaptive = getAdaptiveWeight(lobbyPlayer);
                const isSwapSource = swapSource === battletag;

                return (
                  <div
                    key={assignment.player.battletag}
                    className={`
                      px-3 py-2 app-card group transition-colors flex gap-3
                      ${isLocked ? "outline outline-1 outline-[var(--color-accent)]" : ""}
                      ${isSwapSource ? "app-surface-selected" : ""}
                    `}
                  >
                    {/* Role badge - centered vertically across both rows */}
                    <span
                      className={`
                        px-2 py-1 text-xs font-bold flex-shrink-0 self-center
                        ${getRoleBadgeColor(assignment.assignedRole)}
                      `}
                    >
                      {assignment.assignedRole.charAt(0)}
                    </span>
                    {/* Right side: name/buttons row + rank row */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: name, buttons */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex-1 font-medium text-ink truncate min-w-0"
                          title={assignment.player.battletag}
                        >
                          {assignment.player.battletag.split("#")[0]}
                        </span>
                        {/* Swap button */}
                        <button
                          onClick={() => onSwapClick(battletag)}
                          className={`
                            px-2 py-1 text-xs inline-flex items-center justify-center transition-colors flex-shrink-0
                            ${
                              isSwapSource
                                ? "app-chip-active"
                                : swapSource
                                ? "app-badge"
                                : "app-chip opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            }
                          `}
                          title={
                            isSwapSource
                              ? "Click to cancel"
                              : swapSource
                              ? "Click to swap with selected player"
                              : "Swap roles with another player"
                          }
                        >
                          <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                        {/* Substitute button */}
                        <div className="relative flex items-center">
                          <button
                            onClick={() =>
                              setSubstituteOpen(substituteOpen === battletag ? null : battletag)
                            }
                            className="px-2 py-1 text-xs app-chip inline-flex items-center justify-center transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            title="Substitute player"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          </button>
                          {substituteOpen === battletag && (
                            <div className="absolute right-0 top-full mt-1 z-50 app-modal min-w-[200px] max-h-[300px] overflow-y-auto">
                              <div className="p-2 text-xs text-muted border-b border-[var(--color-rule)]">
                                Sub for {assignment.player.battletag.split("#")[0]}
                              </div>
                              {getEligibleSubstitutes(assignment.assignedRole).length === 0 ? (
                                <div className="p-3 text-sm text-muted italic">
                                  No eligible {assignment.assignedRole} subs
                                </div>
                              ) : (
                                getEligibleSubstitutes(assignment.assignedRole).map((sub) => (
                                  <button
                                    key={sub.battletag}
                                    onClick={() => {
                                      substitutePlayer(battletag, sub.battletag, true);
                                      setSubstituteOpen(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-accent-soft)] flex items-center justify-between text-ink"
                                  >
                                    <span>{sub.battletag.split("#")[0]}</span>
                                    <span className="text-muted text-xs">
                                      {formatRankOnly(
                                        getEffectiveSR(sub, assignment.assignedRole),
                                        gameMode
                                      )}
                                    </span>
                                  </button>
                                ))
                              )}
                              <button
                                onClick={() => setSubstituteOpen(null)}
                                className="w-full px-3 py-2 text-left text-xs text-muted hover:bg-[var(--color-paper-2)] border-t border-[var(--color-rule)]"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Edit button (appears on hover/focus) */}
                        {onEditPlayer && (
                          <button
                            onClick={() => onEditPlayer(battletag)}
                            className="px-2 py-1 text-xs app-chip inline-flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0"
                            title="Edit player"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                        {/* Lock button - always visible, rightmost */}
                        <button
                          onClick={() => {
                            if (isLocked) {
                              lockToTeam(assignment.player.battletag, null);
                              lockToRole(assignment.player.battletag, null);
                            } else {
                              lockToTeam(assignment.player.battletag, teamNumber);
                              lockToRole(assignment.player.battletag, assignment.assignedRole);
                            }
                          }}
                          className={`
                            px-2 py-1 text-xs inline-flex items-center justify-center transition-colors flex-shrink-0
                            ${isLocked ? "app-chip-active" : "app-chip"}
                          `}
                          title={isLocked ? "Unlock player" : `Lock to Team ${teamNumber}`}
                        >
                          {isLocked ? (
                            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <LockKeyholeOpen className="h-3 w-3" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {/* Bottom row: rank display */}
                      {assignment.effectiveSR !== undefined && (
                        <div
                          className="text-sm text-muted mt-1"
                          title={
                            showWeightModifiers
                              ? `${assignment.effectiveSR.toLocaleString()} SR (manual: ${
                                  modifier - adaptive >= 0 ? "+" : ""
                                }${modifier - adaptive}, adaptive: ${
                                  adaptive >= 0 ? "+" : ""
                                }${adaptive})`
                              : `${(assignment.effectiveSR - modifier).toLocaleString()} SR`
                          }
                        >
                          {formatRankWithModifier(
                            assignment.effectiveSR,
                            modifier,
                            adaptive,
                            gameMode,
                            showWeightModifiers
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {players.length === 0 && (
                <div className="text-muted text-sm italic">No {role}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
