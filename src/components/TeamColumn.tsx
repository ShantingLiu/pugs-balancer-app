import { useState, type ReactNode } from "react";
import type { RoleAssignment, Role, LobbyPlayer } from "@engine/types";
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
function formatRankWithModifier(effectiveSR: number, modifier: number, adaptiveWeight: number): ReactNode {
  const baseRank = formatRankOnly(effectiveSR - modifier);
  
  if (modifier === 0) {
    return <>{baseRank}</>;
  }
  
  const manualMod = modifier - adaptiveWeight;
  
  // Show both types if both exist
  if (manualMod !== 0 && adaptiveWeight !== 0) {
    const manualSign = manualMod > 0 ? "+" : "";
    const adaptiveSign = adaptiveWeight > 0 ? "+" : "";
    return (
      <>
        {baseRank}{" "}
        <span className={manualMod > 0 ? "text-green-400" : "text-red-400"}>
          {manualSign}{manualMod}
        </span>
        <span className={adaptiveWeight > 0 ? "text-cyan-400" : "text-orange-400"}>
          {" "}{adaptiveSign}{adaptiveWeight}
        </span>
      </>
    );
  }
  
  // Only adaptive
  if (adaptiveWeight !== 0) {
    const sign = adaptiveWeight > 0 ? "+" : "";
    return (
      <>
        {baseRank}{" "}
        <span className={adaptiveWeight > 0 ? "text-cyan-400" : "text-orange-400"}>
          {sign}{adaptiveWeight}
        </span>
      </>
    );
  }
  
  // Only manual
  const sign = manualMod > 0 ? "+" : "";
  return (
    <>
      {baseRank}{" "}
      <span className={manualMod > 0 ? "text-green-400" : "text-red-400"}>
        {sign}{manualMod}
      </span>
    </>
  );
}

/** Get role color for header */
function getRoleColor(role: Role): string {
  switch (role) {
    case "Tank":
      return "text-yellow-400";
    case "DPS":
      return "text-red-400";
    case "Support":
      return "text-green-400";
  }
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

export function TeamColumn({ teamNumber, assignments, averageSR, onEditPlayer }: TeamColumnProps) {
  const [substituteOpen, setSubstituteOpen] = useState<string | null>(null);
  const [swapSource, setSwapSource] = useState<string | null>(null); // battletag of first player in swap
  
  const lockToTeam = useSessionStore((state) => state.lockToTeam);
  const lockToRole = useSessionStore((state) => state.lockToRole);
  const substitutePlayer = useSessionStore((state) => state.substitutePlayer);
  const swapPlayerRoles = useSessionStore((state) => state.swapPlayerRoles);
  const getLobbyPlayers = useSessionStore((state) => state.getLobbyPlayers);
  const lastResult = useSessionStore((state) => state.lastResult);
  // Subscribe to lock changes for re-renders
  useSessionStore((state) => state.lockedTeam1);
  useSessionStore((state) => state.lockedTeam2);
  useSessionStore((state) => state.lockedRoles);

  // Create lookup map for lobby players (includes current lock state)
  const lobbyPlayers = getLobbyPlayers();
  const lobbyMap = new Map<string, LobbyPlayer>(
    lobbyPlayers.map((lp) => [lp.battletag, lp])
  );

  // Get players currently on teams (to exclude from substitutes)
  const playersOnTeams = new Set<string>();
  if (lastResult) {
    lastResult.team1.forEach((ra) => playersOnTeams.add(ra.player.battletag));
    lastResult.team2.forEach((ra) => playersOnTeams.add(ra.player.battletag));
  }

  // Get eligible substitutes for a role (in lobby, not on team, can play role)
  const getEligibleSubstitutes = (role: Role): LobbyPlayer[] => {
    return lobbyPlayers.filter((lp) => 
      !playersOnTeams.has(lp.battletag) && 
      !lp.isAfk &&
      lp.rolesWilling.includes(role)
    ).sort((a, b) => getEffectiveSR(b, role) - getEffectiveSR(a, role));
  };

  // Handle swap button click
  const handleSwapClick = (battletag: string) => {
    if (!swapSource) {
      // First click - set as swap source
      setSwapSource(battletag);
    } else if (swapSource === battletag) {
      // Clicked same player - cancel
      setSwapSource(null);
    } else {
      // Second click - perform swap
      swapPlayerRoles(swapSource, battletag);
      setSwapSource(null);
    }
  };

  // Group assignments by role
  const byRole = ROLE_ORDER.map((role) => ({
    role,
    players: assignments.filter((a) => a.assignedRole === role),
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Team {teamNumber}</h3>
        <div className="text-lg font-semibold text-blue-400" title={`${averageSR.toFixed(0)} SR`}>
          {formatRankOnly(averageSR)}
        </div>
      </div>

      {/* Role sections */}
      <div className="space-y-3">
        {byRole.map(({ role, players }) => (
          <div key={role}>
            <div className={`text-sm font-medium mb-1 ${getRoleColor(role)}`}>
              {role}
            </div>
            <div className="space-y-1">
              {players.map((assignment) => {
                const battletag = assignment.player.battletag;
                const lobbyPlayer = lobbyMap.get(battletag);
                // Player is locked to THIS team only if lockedToTeam matches current team
                const isLocked = lobbyPlayer?.lockedToTeam === teamNumber;
                const modifier = getPlayerModifier(lobbyPlayer);
                const adaptive = getAdaptiveWeight(lobbyPlayer);
                const isSwapSource = swapSource === battletag;

                return (
                  <div
                    key={assignment.player.battletag}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg bg-gray-700 group transition-all
                      ${isLocked ? "ring-1 ring-purple-500" : ""}
                      ${isSwapSource ? "ring-2 ring-cyan-400 bg-cyan-900/30" : ""}
                    `}
                  >
                    <span
                      className={`
                        px-2 py-0.5 text-xs font-bold rounded flex-shrink-0
                        ${getRoleBadgeColor(assignment.assignedRole)}
                      `}
                    >
                      {assignment.assignedRole.charAt(0)}
                    </span>
                    <span className="flex-1 font-medium min-w-0">
                      {assignment.player.battletag.split("#")[0]}
                    </span>
                    {assignment.effectiveSR !== undefined && (
                      <span 
                        className="text-sm text-gray-400 flex-shrink-0"
                        title={`${assignment.effectiveSR.toLocaleString()} SR (manual: ${modifier - adaptive >= 0 ? "+" : ""}${modifier - adaptive}, adaptive: ${adaptive >= 0 ? "+" : ""}${adaptive})`}
                      >
                        {formatRankWithModifier(assignment.effectiveSR, modifier, adaptive)}
                      </span>
                    )}
                    {/* Swap button */}
                    <button
                      onClick={() => handleSwapClick(battletag)}
                      className={`
                        px-2 py-1 text-xs rounded transition-colors flex-shrink-0
                        ${isSwapSource
                          ? "bg-cyan-600 hover:bg-cyan-700"
                          : swapSource
                          ? "bg-cyan-600/50 hover:bg-cyan-600 animate-pulse"
                          : "bg-gray-600 hover:bg-cyan-600 opacity-0 group-hover:opacity-100"
                        }
                      `}
                      title={isSwapSource ? "Click to cancel" : swapSource ? "Click to swap with selected player" : "Swap roles with another player"}
                    >
                      ⇄
                    </button>
                    {/* Lock button */}
                    <button
                      onClick={() => {
                        console.log(`Lock button clicked for ${assignment.player.battletag}, isLocked: ${isLocked}, assignedRole: ${assignment.assignedRole}`);
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
                      className={`
                        px-2 py-1 text-xs rounded transition-colors flex-shrink-0
                        ${isLocked
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-gray-600 hover:bg-gray-500"
                        }
                      `}
                      title={isLocked ? "Unlock player" : `Lock to Team ${teamNumber}`}
                    >
                      {isLocked ? "🔒" : "🔓"}
                    </button>
                    {/* Substitute button */}
                    <div className="relative">
                      <button
                        onClick={() => setSubstituteOpen(substituteOpen === battletag ? null : battletag)}
                        className="px-2 py-1 text-xs bg-gray-600 hover:bg-orange-600 rounded transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                        title="Substitute player"
                      >
                        🔄
                      </button>
                      {substituteOpen === battletag && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 rounded-lg shadow-xl border border-gray-700 min-w-[200px] max-h-[300px] overflow-y-auto">
                          <div className="p-2 text-xs text-gray-400 border-b border-gray-700">
                            Sub for {assignment.player.battletag.split("#")[0]}
                          </div>
                          {getEligibleSubstitutes(assignment.assignedRole).length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 italic">
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
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between"
                              >
                                <span>{sub.battletag.split("#")[0]}</span>
                                <span className="text-gray-400 text-xs">
                                  {formatRankOnly(getEffectiveSR(sub, assignment.assignedRole))}
                                </span>
                              </button>
                            ))
                          )}
                          <button
                            onClick={() => setSubstituteOpen(null)}
                            className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-700 border-t border-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Edit button (appears on hover) */}
                    {onEditPlayer && (
                      <button
                        onClick={() => onEditPlayer(battletag)}
                        className="px-2 py-1 text-xs bg-gray-600 hover:bg-blue-600 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        title="Edit player"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                );
              })}
              {players.length === 0 && (
                <div className="text-gray-600 text-sm italic">No {role}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
