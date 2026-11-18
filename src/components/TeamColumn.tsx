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
        <span className={`app-measured ${manualMod > 0 ? "text-ok" : "text-bad"}`}>
          {manualSign}{manualMod}
        </span>
        <span className={`app-measured ${adaptiveWeight > 0 ? "text-sky-ink" : "text-pink-ink"}`}>
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
        <span className={`app-measured ${adaptiveWeight > 0 ? "text-sky-ink" : "text-pink-ink"}`}>
          {sign}{adaptiveWeight}
        </span>
      </>
    );
  }

  const sign = manualMod > 0 ? "+" : "";
  return (
    <>
      {baseRank}{" "}
      <span className={`app-measured ${manualMod > 0 ? "text-ok" : "text-bad"}`}>
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
    <div className={`${isTeam1 ? "app-team-1" : "app-team-2"} p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xl font-semibold ${isTeam1 ? "text-pink-ink" : "text-sky-ink"}`}>
          Team {teamNumber}
        </h3>
        <div
          className={`text-base font-semibold px-3 py-1 rounded-pill bg-paper-2 border ${
            isTeam1 ? "border-pink-edge text-pink-ink" : "border-sky-edge text-sky-ink"
          }`}
          title={`${averageSR.toFixed(0)} SR`}
        >
          {formatRankOnly(averageSR, gameMode)}
        </div>
      </div>

      {/* Role sections */}
      <div className="space-y-3">
        {byRole.map(({ role, players }) => (
          <div key={role}>
            <div className={`text-xs font-semibold mb-1.5 ${getRoleColor(role)}`}>
              {role}
            </div>
            <div className="space-y-1.5">
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
                    className={`px-3 py-2 rounded-well border group flex gap-3 app-card-interactive ${
                      isSwapSource
                        ? "border-sky-edge ring-2 ring-focus bg-sky-soft"
                        : isLocked
                        ? "border-lock-edge bg-lock-soft"
                        : "app-player-row border-rule"
                    }`}
                  >
                    {/* Role badge */}
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-pill shrink-0 self-center ${getRoleBadgeColor(
                        assignment.assignedRole
                      )}`}
                    >
                      {assignment.assignedRole.charAt(0)}
                    </span>

                    {/* Player details + quick controls */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className="flex-1 min-w-0 font-semibold text-ink break-words"
                          title={assignment.player.battletag}
                        >
                          {assignment.player.battletag.split("#")[0]}
                        </span>

                        {/* Lock button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              // Unlock: remove team AND role lock
                              lockToTeam(assignment.player.battletag, null);
                              lockToRole(assignment.player.battletag, null);
                            } else {
                              // Lock: set team AND role lock
                              lockToTeam(assignment.player.battletag, teamNumber);
                              lockToRole(assignment.player.battletag, assignment.assignedRole);
                            }
                          }}
                          className={`px-2 py-1 text-xs rounded-pill border shrink-0 ${
                            isLocked
                              ? "bg-lock-soft border-lock-edge text-lock"
                              : "bg-paper-3 border-rule text-ink-2 hover:bg-lock-soft"
                          }`}
                          title={isLocked ? "Unlock player" : `Lock to Team ${teamNumber}`}
                          aria-label={isLocked ? `Unlock ${assignment.player.battletag.split("#")[0]}` : `Lock ${assignment.player.battletag.split("#")[0]} to Team ${teamNumber}`}
                        >
                          {isLocked ? (
                            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <LockKeyholeOpen className="h-3 w-3" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      {/* Rank display & hover/focus actions */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mt-0.5">
                        {assignment.effectiveSR !== undefined ? (
                          <div
                            className="text-xs text-ink-2"
                            title={
                              showWeightModifiers
                                ? `${assignment.effectiveSR.toLocaleString()} SR (manual: ${
                                    modifier - adaptive >= 0 ? "+" : ""
                                  }${modifier - adaptive}, adaptive: ${adaptive >= 0 ? "+" : ""}${adaptive})`
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
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Swap button */}
                          <button
                            type="button"
                            onClick={() => onSwapClick(battletag)}
                            className={`px-2 py-1 text-xs rounded-pill border shrink-0 ${
                              isSwapSource
                                ? "bg-sky border-sky-edge text-ink"
                                : swapSource
                                ? "bg-sky-soft border-sky-edge text-sky-ink animate-pulse"
                                : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            }`}
                            title={
                              isSwapSource
                                ? "Click to cancel"
                                : swapSource
                                ? "Click to swap with selected player"
                                : "Swap roles with another player"
                            }
                            aria-label={`Swap ${assignment.player.battletag.split("#")[0]}`}
                          >
                            <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                          </button>

                          {/* Substitute button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setSubstituteOpen(substituteOpen === battletag ? null : battletag)}
                              className={`px-2 py-1 text-xs bg-paper-3 border border-rule text-ink-2 hover:bg-pink-soft hover:border-pink-edge rounded-pill shrink-0 ${
                                substituteOpen === battletag
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                              }`}
                              title="Substitute player"
                              aria-label={`Substitute ${assignment.player.battletag.split("#")[0]}`}
                            >
                              <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            </button>
                            {substituteOpen === battletag && (
                              <div className="absolute right-0 top-full mt-1 z-50 app-modal min-w-[200px] max-h-[300px] overflow-y-auto">
                                <div className="p-2.5 text-xs font-semibold text-muted border-b border-rule">
                                  Sub for {assignment.player.battletag.split("#")[0]}
                                </div>
                                {getEligibleSubstitutes(assignment.assignedRole).length === 0 ? (
                                  <div className="p-3 text-sm text-muted">
                                    No eligible {assignment.assignedRole} subs
                                  </div>
                                ) : (
                                  getEligibleSubstitutes(assignment.assignedRole).map((sub) => (
                                    <button
                                      type="button"
                                      key={sub.battletag}
                                      onClick={() => {
                                        substitutePlayer(battletag, sub.battletag, true);
                                        setSubstituteOpen(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-sky-soft flex items-center justify-between"
                                    >
                                      <span className="font-semibold">{sub.battletag.split("#")[0]}</span>
                                      <span className="text-muted text-xs">
                                        {formatRankOnly(getEffectiveSR(sub, assignment.assignedRole), gameMode)}
                                      </span>
                                    </button>
                                  ))
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSubstituteOpen(null)}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-muted hover:bg-paper-3 border-t border-rule"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Edit button */}
                          {onEditPlayer && (
                            <button
                              type="button"
                              onClick={() => onEditPlayer(battletag)}
                              className="px-2 py-1 text-xs bg-paper-3 border border-rule text-ink-2 hover:bg-sky-soft rounded-pill opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0"
                              title="Edit player"
                              aria-label={`Edit ${assignment.player.battletag.split("#")[0]}`}
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                            </button>
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
      </div>
    </div>
  );
}
