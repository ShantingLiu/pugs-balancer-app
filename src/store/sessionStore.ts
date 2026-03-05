import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LobbyPlayer, Role, RoleAssignment, SoftConstraint, TeamAssignment } from "@engine/types";
import { usePlayerStore } from "./playerStore";
import { balanceTeams } from "@engine/balancer";
import { getEffectiveSR } from "@utils/rankMapper";
import { calculateTeamScore } from "@engine/scoring";

// =============================================================================
// Session Store - Manages current balancing session state
// =============================================================================

interface SessionState {
  /** Battletags of players in current lobby */
  lobbyBattletags: string[];

  /** Battletags of players that MUST play */
  mustPlay: Set<string>;

  /** Priority level for must-play (2 = sat out waiting, 1 = joined mid-match) */
  mustPlayPriority: Map<string, number>;

  /** Battletags locked to team 1 */
  lockedTeam1: Set<string>;

  /** Battletags locked to team 2 */
  lockedTeam2: Set<string>;

  /** Battletags locked to a specific role (battletag -> role) */
  lockedRoles: Map<string, Role>;

  /** Temporary weight overrides (battletag -> modifier) */
  tempWeightOverrides: Map<string, number>;

  /** Currently AFK players */
  afkPlayers: Set<string>;

  /** Soft constraints for this session */
  softConstraints: SoftConstraint[];

  /** Last generated result */
  lastResult: TeamAssignment | null;

  /** Previous result for visual diff on reshuffle */
  previousResult: TeamAssignment | null;

  /** Battletags of players who played last game (for sat-out tracking) */
  lastGamePlayers: Set<string>;

  /** Consecutive losses per player (battletag -> count) */
  playerLossStreaks: Map<string, number>;

  /** Consecutive games sat out per player (battletag -> count) */
  satOutStreaks: Map<string, number>;

  /** Total wins per player this session (battletag -> count) */
  totalWins: Map<string, number>;

  /** Total losses per player this session (battletag -> count) */
  totalLosses: Map<string, number>;

  /** Total games sat out per player this session (battletag -> count) */
  totalSatOut: Map<string, number>;

  /** Adaptive weight adjustments from match scores (battletag -> SR modifier) */
  adaptiveWeights: Map<string, number>;

  /** Pending match result - team that won, waiting for score input */
  pendingMatchResult: { winningTeam: 1 | 2 } | null;

  /** Last match final cash scores (for analysis) */
  lastMatchCashScores: { team1: number; team2: number } | null;
}

interface SessionActions {
  // Lobby management
  setLobby: (battletags: string[]) => void;
  addToLobby: (battletag: string) => void;
  removeFromLobby: (battletag: string) => void;
  clearLobby: () => void;

  // Must-play management
  toggleMustPlay: (battletag: string) => void;
  setMustPlay: (battletags: string[]) => void;
  clearMustPlay: () => void;

  // Team lock management
  lockToTeam: (battletag: string, team: 1 | 2 | null) => void;
  clearTeamLocks: () => void;

  // Role lock management
  lockToRole: (battletag: string, role: Role | null) => void;
  clearRoleLocks: () => void;

  // AFK management
  toggleAfk: (battletag: string) => void;
  setAfk: (battletag: string, isAfk: boolean) => void;
  clearAfk: () => void;

  // Temp weight management
  setTempWeight: (battletag: string, weight: number | null) => void;
  clearTempWeights: () => void;

  // Soft constraints
  addSoftConstraint: (constraint: SoftConstraint) => void;
  removeSoftConstraint: (players: [string, string]) => void;
  clearSoftConstraints: () => void;

  // Results management
  setLastResult: (result: TeamAssignment | null) => void;
  
  // Swap roles of two players on the same team
  swapPlayerRoles: (battletag1: string, battletag2: string) => void;
  
  // Substitute a player on a team with someone from lobby
  substitutePlayer: (outBattletag: string, inBattletag: string, lockSubstitute: boolean) => void;
  
  // End game - move current players to lastGamePlayers
  endGame: () => void;

  // Loss streak management
  recordMatchResult: (winningTeam: 1 | 2) => void;
  clearLossStreaks: () => void;
  clearSessionStats: () => void;

  // Adaptive weight management
  setPendingMatchResult: (winningTeam: 1 | 2) => void;
  confirmMatchScore: (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number) => void;
  cancelPendingMatch: () => void;
  getAdaptiveWeight: (battletag: string) => number;

  // Reset session
  resetSession: () => void;

  // Update all references when a player is renamed
  renamePlayerInSession: (oldBattletag: string, newBattletag: string) => void;

  // Get lobby players with session state applied
  getLobbyPlayers: () => LobbyPlayer[];
}

export type SessionStore = SessionState & SessionActions;

/**
 * Custom serialization for Sets and Maps to work with persist middleware
 */
const sessionStorage = {
  getItem: (name: string) => {
    try {
      const str = localStorage.getItem(name);
      if (!str) return null;
      const parsed = JSON.parse(str);
      if (parsed.state) {
        // Convert arrays back to Sets/Maps
        parsed.state.mustPlay = new Set(parsed.state.mustPlay || []);
        parsed.state.mustPlayPriority = new Map(parsed.state.mustPlayPriority || []);
        parsed.state.lockedTeam1 = new Set(parsed.state.lockedTeam1 || []);
        parsed.state.lockedTeam2 = new Set(parsed.state.lockedTeam2 || []);
        parsed.state.lockedRoles = new Map(parsed.state.lockedRoles || []);
        parsed.state.afkPlayers = new Set(parsed.state.afkPlayers || []);
        parsed.state.lastGamePlayers = new Set(parsed.state.lastGamePlayers || []);
        parsed.state.tempWeightOverrides = new Map(parsed.state.tempWeightOverrides || []);
        parsed.state.playerLossStreaks = new Map(parsed.state.playerLossStreaks || []);
        parsed.state.satOutStreaks = new Map(parsed.state.satOutStreaks || []);
        parsed.state.totalWins = new Map(parsed.state.totalWins || []);
        parsed.state.totalLosses = new Map(parsed.state.totalLosses || []);
        parsed.state.totalSatOut = new Map(parsed.state.totalSatOut || []);
        parsed.state.adaptiveWeights = new Map(parsed.state.adaptiveWeights || []);
        // Ensure softConstraints array exists
        parsed.state.softConstraints = parsed.state.softConstraints || [];
        parsed.state.lobbyBattletags = parsed.state.lobbyBattletags || [];
        parsed.state.pendingMatchResult = parsed.state.pendingMatchResult || null;
        parsed.state.lastMatchCashScores = parsed.state.lastMatchCashScores || null;
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse session storage, resetting:", e);
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: unknown) => {
    const toStore = value as { state: SessionState };
    // Convert Sets/Maps to arrays for JSON serialization
    const serializable = {
      ...toStore,
      state: {
        ...toStore.state,
        mustPlay: Array.from(toStore.state.mustPlay),
        mustPlayPriority: Array.from(toStore.state.mustPlayPriority.entries()),
        lockedTeam1: Array.from(toStore.state.lockedTeam1),
        lockedTeam2: Array.from(toStore.state.lockedTeam2),
        lockedRoles: Array.from(toStore.state.lockedRoles.entries()),
        afkPlayers: Array.from(toStore.state.afkPlayers),
        lastGamePlayers: Array.from(toStore.state.lastGamePlayers),
        tempWeightOverrides: Array.from(toStore.state.tempWeightOverrides.entries()),
        playerLossStreaks: Array.from(toStore.state.playerLossStreaks.entries()),
        satOutStreaks: Array.from(toStore.state.satOutStreaks.entries()),
        totalWins: Array.from(toStore.state.totalWins.entries()),
        totalLosses: Array.from(toStore.state.totalLosses.entries()),
        totalSatOut: Array.from(toStore.state.totalSatOut.entries()),
        adaptiveWeights: Array.from(toStore.state.adaptiveWeights.entries()),
      },
    };
    localStorage.setItem(name, JSON.stringify(serializable));
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

const initialState: SessionState = {
  lobbyBattletags: [],
  mustPlay: new Set(),
  mustPlayPriority: new Map(),
  lockedTeam1: new Set(),
  lockedTeam2: new Set(),
  lockedRoles: new Map(),
  tempWeightOverrides: new Map(),
  afkPlayers: new Set(),
  softConstraints: [],
  lastResult: null,
  previousResult: null,
  lastGamePlayers: new Set(),
  playerLossStreaks: new Map(),
  satOutStreaks: new Map(),
  totalWins: new Map(),
  totalLosses: new Map(),
  totalSatOut: new Map(),
  adaptiveWeights: new Map(),
  pendingMatchResult: null,
  lastMatchCashScores: null,
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Lobby management
      setLobby: (battletags: string[]) => {
        // When setting lobby, clear must-play for players no longer in lobby
        // and reset must-play entirely if lobby is being cleared
        if (battletags.length === 0) {
          set({ 
            lobbyBattletags: battletags,
            mustPlay: new Set(),
            lastResult: null,
          });
        } else {
          const newBattletagSet = new Set(battletags);
          set((state) => {
            // Keep only must-play for players still in lobby
            const newMustPlay = new Set<string>();
            for (const bt of state.mustPlay) {
              if (newBattletagSet.has(bt)) {
                newMustPlay.add(bt);
              }
            }
            return { 
              lobbyBattletags: battletags,
              mustPlay: newMustPlay,
            };
          });
        }
      },

      addToLobby: (battletag: string) => {
        set((state) => {
          if (state.lobbyBattletags.includes(battletag)) {
            return state; // Already in lobby
          }

          // Check if a game is in progress (teams have been generated)
          const gameInProgress = state.lastResult && 
            state.lastResult.team1.length > 0 && 
            state.lastResult.team2.length > 0;

          const newMustPlay = new Set(state.mustPlay);
          const newMustPlayPriority = new Map(state.mustPlayPriority);

          if (gameInProgress) {
            // Auto-set must-play with lower priority (1 = joined mid-match)
            newMustPlay.add(battletag);
            newMustPlayPriority.set(battletag, 1);
          }

          return {
            lobbyBattletags: [...state.lobbyBattletags, battletag],
            mustPlay: newMustPlay,
            mustPlayPriority: newMustPlayPriority,
          };
        });
      },

      removeFromLobby: (battletag: string) => {
        set((state) => ({
          lobbyBattletags: state.lobbyBattletags.filter((bt) => bt !== battletag),
          // Also clean up related state
          mustPlay: (() => {
            const newSet = new Set(state.mustPlay);
            newSet.delete(battletag);
            return newSet;
          })(),
          lockedTeam1: (() => {
            const newSet = new Set(state.lockedTeam1);
            newSet.delete(battletag);
            return newSet;
          })(),
          lockedTeam2: (() => {
            const newSet = new Set(state.lockedTeam2);
            newSet.delete(battletag);
            return newSet;
          })(),
          lockedRoles: (() => {
            const newMap = new Map(state.lockedRoles);
            newMap.delete(battletag);
            return newMap;
          })(),
          afkPlayers: (() => {
            const newSet = new Set(state.afkPlayers);
            newSet.delete(battletag);
            return newSet;
          })(),
          tempWeightOverrides: (() => {
            const newMap = new Map(state.tempWeightOverrides);
            newMap.delete(battletag);
            return newMap;
          })(),
        }));
      },

      clearLobby: () => {
        set({
          lobbyBattletags: [],
          mustPlay: new Set(),
          lockedTeam1: new Set(),
          lockedTeam2: new Set(),
          lockedRoles: new Map(),
          afkPlayers: new Set(),
          tempWeightOverrides: new Map(),
          softConstraints: [],
        });
      },

      // Must-play management
      toggleMustPlay: (battletag: string) => {
        set((state) => {
          const newSet = new Set(state.mustPlay);
          if (newSet.has(battletag)) {
            newSet.delete(battletag);
          } else {
            newSet.add(battletag);
          }
          return { mustPlay: newSet };
        });
      },

      setMustPlay: (battletags: string[]) => {
        set({ mustPlay: new Set(battletags) });
      },

      clearMustPlay: () => {
        set({ mustPlay: new Set() });
      },

      // Team lock management
      lockToTeam: (battletag: string, team: 1 | 2 | null) => {
        console.log(`lockToTeam called: ${battletag} -> Team ${team}`);
        set((state) => {
          const newTeam1 = new Set(state.lockedTeam1);
          const newTeam2 = new Set(state.lockedTeam2);

          // Remove from both teams first
          newTeam1.delete(battletag);
          newTeam2.delete(battletag);

          // Add to new team if specified
          if (team === 1) {
            newTeam1.add(battletag);
          } else if (team === 2) {
            newTeam2.add(battletag);
          }

          console.log("New locks after update - Team 1:", Array.from(newTeam1), "Team 2:", Array.from(newTeam2));
          return { lockedTeam1: newTeam1, lockedTeam2: newTeam2 };
        });
      },

      clearTeamLocks: () => {
        set({ lockedTeam1: new Set(), lockedTeam2: new Set() });
      },

      // Role lock management
      lockToRole: (battletag: string, role: Role | null) => {
        console.log(`lockToRole called: ${battletag} -> ${role}`);
        set((state) => {
          const newLockedRoles = new Map(state.lockedRoles);
          if (role === null) {
            newLockedRoles.delete(battletag);
          } else {
            newLockedRoles.set(battletag, role);
          }
          console.log("New role locks:", Array.from(newLockedRoles.entries()));
          return { lockedRoles: newLockedRoles };
        });
      },

      clearRoleLocks: () => {
        set({ lockedRoles: new Map() });
      },

      // AFK management
      toggleAfk: (battletag: string) => {
        const state = get();
        const newAfkPlayers = new Set(state.afkPlayers);
        const newMustPlay = new Set(state.mustPlay);
        const isBecomingAfk = !newAfkPlayers.has(battletag);
        
        if (isBecomingAfk) {
          // Marking as AFK - remove must-play
          newAfkPlayers.add(battletag);
          newMustPlay.delete(battletag);
        } else {
          // Unmarking as AFK - auto-set must-play
          newAfkPlayers.delete(battletag);
          newMustPlay.add(battletag);
        }

        // Check if this player is in the current result
        const isInResult = state.lastResult && (
          state.lastResult.team1.some((ra) => ra.player.battletag === battletag) ||
          state.lastResult.team2.some((ra) => ra.player.battletag === battletag)
        );

        // Update AFK/must-play state first
        set({ afkPlayers: newAfkPlayers, mustPlay: newMustPlay });

        // If player was in result and is becoming AFK, auto-reshuffle
        if (isBecomingAfk && isInResult) {
          // Small delay to allow state to settle
          setTimeout(() => {
            try {
              const updatedState = get();
              const lobbyPlayers = updatedState.getLobbyPlayers();
              if (lobbyPlayers.length >= 10) {
                // Clear must-play for reshuffle - those are for next match only
                const playersForBalance = lobbyPlayers.map((p) => ({ ...p, mustPlay: false }));
                const result = balanceTeams(playersForBalance, updatedState.softConstraints);
                // Use the setLastResult action to properly handle lock cleanup
                get().setLastResult(result);
              }
            } catch (error) {
              console.error("Auto-reshuffle after AFK failed:", error);
            }
          }, 0);
        }
      },

      setAfk: (battletag: string, isAfk: boolean) => {
        set((state) => {
          const newSet = new Set(state.afkPlayers);
          if (isAfk) {
            newSet.add(battletag);
          } else {
            newSet.delete(battletag);
          }
          return { afkPlayers: newSet };
        });
      },

      clearAfk: () => {
        set({ afkPlayers: new Set() });
      },

      // Temp weight management
      setTempWeight: (battletag: string, weight: number | null) => {
        set((state) => {
          const newMap = new Map(state.tempWeightOverrides);
          if (weight === null) {
            newMap.delete(battletag);
          } else {
            newMap.set(battletag, weight);
          }
          return { tempWeightOverrides: newMap };
        });
      },

      clearTempWeights: () => {
        set({ tempWeightOverrides: new Map() });
      },

      // Soft constraints
      addSoftConstraint: (constraint: SoftConstraint) => {
        set((state) => ({
          softConstraints: [...state.softConstraints, constraint],
        }));
      },

      removeSoftConstraint: (players: [string, string]) => {
        set((state) => ({
          softConstraints: state.softConstraints.filter(
            (c) =>
              !(
                (c.players[0] === players[0] && c.players[1] === players[1]) ||
                (c.players[0] === players[1] && c.players[1] === players[0])
              )
          ),
        }));
      },

      clearSoftConstraints: () => {
        set({ softConstraints: [] });
      },

      // Results management
      setLastResult: (result: TeamAssignment | null) => {
        console.log("setLastResult called with:", result ? `team1: ${result.team1.length}, team2: ${result.team2.length}` : "null");
        const state = get();
        
        // Save current result as previous (for visual diff on reshuffle)
        const previousResult = state.lastResult;
        
        if (!result) {
          set({ lastResult: null, previousResult });
          return;
        }

        // If result has no valid teams, just store it without modifying locks/must-play
        if (result.team1.length === 0 || result.team2.length === 0) {
          set({ lastResult: result, previousResult });
          return;
        }

        // Clear locks for players who ended up on a different team
        // This handles cases where the balancer couldn't honor a lock
        console.log("Current locks - Team 1:", Array.from(state.lockedTeam1), "Team 2:", Array.from(state.lockedTeam2));
        
        const team1Battletags = new Set(result.team1.map((ra) => ra.player.battletag));
        const team2Battletags = new Set(result.team2.map((ra) => ra.player.battletag));
        console.log("Result - Team 1:", Array.from(team1Battletags), "Team 2:", Array.from(team2Battletags));

        // Only keep locks that match where players actually ended up
        // BUT: preserve locks for players who sat out (not on either team)
        const newLockedTeam1 = new Set<string>();
        const newLockedTeam2 = new Set<string>();

        for (const bt of state.lockedTeam1) {
          // Keep lock if player is on Team 1, OR if player sat out (not on either team)
          if (team1Battletags.has(bt)) {
            newLockedTeam1.add(bt);
          } else if (!team2Battletags.has(bt)) {
            // Player sat out - keep their lock for next game
            newLockedTeam1.add(bt);
            console.log(`${bt} locked to Team 1 sat out, preserving lock`);
          } else {
            console.log(`WARNING: ${bt} was locked to Team 1 but ended up on Team 2!`);
          }
        }

        for (const bt of state.lockedTeam2) {
          // Keep lock if player is on Team 2, OR if player sat out (not on either team)
          if (team2Battletags.has(bt)) {
            newLockedTeam2.add(bt);
          } else if (!team1Battletags.has(bt)) {
            // Player sat out - keep their lock for next game
            newLockedTeam2.add(bt);
            console.log(`${bt} locked to Team 2 sat out, preserving lock`);
          } else {
            console.log(`WARNING: ${bt} was locked to Team 2 but ended up on Team 1!`);
          }
        }
        
        console.log("New locks - Team 1:", Array.from(newLockedTeam1), "Team 2:", Array.from(newLockedTeam2));

        // Mark players sitting out as must-play for next round (priority 2 = sat out waiting)
        const playingBattletags = new Set([...team1Battletags, ...team2Battletags]);
        const newMustPlay = new Set(state.mustPlay);
        const newMustPlayPriority = new Map(state.mustPlayPriority);
        for (const bt of state.lobbyBattletags) {
          // If not AFK and not playing, they should be must-play
          if (!state.afkPlayers.has(bt) && !playingBattletags.has(bt)) {
            newMustPlay.add(bt);
            // Set priority 2 (sat out) unless they already have a lower priority (joined mid-match)
            if (!newMustPlayPriority.has(bt)) {
              newMustPlayPriority.set(bt, 2);
            }
          }
        }

        // Clear must-play status for players who are actually playing
        for (const bt of playingBattletags) {
          newMustPlay.delete(bt);
          newMustPlayPriority.delete(bt);
        }

        // Preserve role locks for locked players who are in their correct role or sat out
        const allAssignments = [...result.team1, ...result.team2];
        const newLockedRoles = new Map<string, Role>();
        for (const [bt, role] of state.lockedRoles.entries()) {
          const assignment = allAssignments.find((a) => a.player.battletag === bt);
          if (!assignment) {
            // Player sat out - keep their role lock
            newLockedRoles.set(bt, role);
            console.log(`${bt} role-locked to ${role} sat out, preserving lock`);
          } else if (assignment.assignedRole === role) {
            // Player is in correct role - keep lock
            newLockedRoles.set(bt, role);
          } else {
            console.log(`WARNING: ${bt} was role-locked to ${role} but assigned ${assignment.assignedRole}!`);
          }
        }
        console.log("New role locks:", Array.from(newLockedRoles.entries()));

        set({
          lastResult: result,
          previousResult,
          lockedTeam1: newLockedTeam1,
          lockedTeam2: newLockedTeam2,
          lockedRoles: newLockedRoles,
          mustPlay: newMustPlay,
          mustPlayPriority: newMustPlayPriority,
        });
      },

      // Swap roles of two players on the same team
      swapPlayerRoles: (battletag1: string, battletag2: string) => {
        const state = get();
        if (!state.lastResult) return;

        // Find both players in the result
        let team1Array = [...state.lastResult.team1];
        let team2Array = [...state.lastResult.team2];

        // Find player 1
        let player1Index = team1Array.findIndex((ra) => ra.player.battletag === battletag1);
        let player1Team: 1 | 2 = 1;
        if (player1Index === -1) {
          player1Index = team2Array.findIndex((ra) => ra.player.battletag === battletag1);
          player1Team = 2;
        }

        // Find player 2
        let player2Index = team1Array.findIndex((ra) => ra.player.battletag === battletag2);
        let player2Team: 1 | 2 = 1;
        if (player2Index === -1) {
          player2Index = team2Array.findIndex((ra) => ra.player.battletag === battletag2);
          player2Team = 2;
        }

        // Both players must be found and on the same team
        if (player1Index === -1 || player2Index === -1) {
          console.warn("Cannot swap: one or both players not found");
          return;
        }
        if (player1Team !== player2Team) {
          console.warn("Cannot swap roles between players on different teams");
          return;
        }

        // Swap their roles
        const teamArray = player1Team === 1 ? team1Array : team2Array;
        const role1 = teamArray[player1Index].assignedRole;
        const role2 = teamArray[player2Index].assignedRole;

        teamArray[player1Index] = { ...teamArray[player1Index], assignedRole: role2 };
        teamArray[player2Index] = { ...teamArray[player2Index], assignedRole: role1 };

        // Update locked roles if either player was role-locked
        const newLockedRoles = new Map(state.lockedRoles);
        if (newLockedRoles.has(battletag1)) {
          newLockedRoles.set(battletag1, role2);
        }
        if (newLockedRoles.has(battletag2)) {
          newLockedRoles.set(battletag2, role1);
        }

        // Recalculate team SR scores
        const calcTeamSR = (team: typeof team1Array) =>
          team.reduce((sum, ra) => sum + ra.effectiveSR, 0) / team.length;

        const newTeam1SR = calcTeamSR(player1Team === 1 ? teamArray : team1Array);
        const newTeam2SR = calcTeamSR(player1Team === 2 ? teamArray : team2Array);

        set({
          lastResult: {
            team1: player1Team === 1 ? teamArray : team1Array,
            team2: player1Team === 2 ? teamArray : team2Array,
            warnings: state.lastResult.warnings,
            score: {
              ...state.lastResult.score,
              team1SR: newTeam1SR,
              team2SR: newTeam2SR,
              srDifference: Math.abs(newTeam1SR - newTeam2SR),
            },
          },
          lockedRoles: newLockedRoles,
        });
      },

      // Substitute a player on a team with someone from lobby
      substitutePlayer: (outBattletag: string, inBattletag: string, lockSubstitute: boolean) => {
        const state = get();
        if (!state.lastResult) return;

        const playerStore = usePlayerStore.getState();
        const inPlayer = playerStore.getPlayer(inBattletag);
        if (!inPlayer) return;

        // Find which team and role the outgoing player is in
        let teamNum: 1 | 2 | null = null;
        let role: Role | null = null;
        let effectiveSR = 0;

        for (const ra of state.lastResult.team1) {
          if (ra.player.battletag === outBattletag) {
            teamNum = 1;
            role = ra.assignedRole;
            break;
          }
        }
        if (!teamNum) {
          for (const ra of state.lastResult.team2) {
            if (ra.player.battletag === outBattletag) {
              teamNum = 2;
              role = ra.assignedRole;
              break;
            }
          }
        }

        if (!teamNum || !role) return;

        // Calculate effective SR for the incoming player in this role
        effectiveSR = getEffectiveSR(inPlayer as LobbyPlayer, role);

        // Create the new assignment for the incoming player
        const newAssignment: RoleAssignment = {
          player: inPlayer,
          assignedRole: role,
          effectiveSR,
        };

        // Replace in the appropriate team
        const newTeam1 = state.lastResult.team1.map((ra) =>
          ra.player.battletag === outBattletag ? newAssignment : ra
        );
        const newTeam2 = state.lastResult.team2.map((ra) =>
          ra.player.battletag === outBattletag ? newAssignment : ra
        );

        // Update locks
        const newLockedTeam1 = new Set(state.lockedTeam1);
        const newLockedTeam2 = new Set(state.lockedTeam2);
        const newLockedRoles = new Map(state.lockedRoles);

        // Remove locks from outgoing player
        newLockedTeam1.delete(outBattletag);
        newLockedTeam2.delete(outBattletag);
        newLockedRoles.delete(outBattletag);

        // Add locks for incoming player if requested
        if (lockSubstitute) {
          if (teamNum === 1) {
            newLockedTeam1.add(inBattletag);
          } else {
            newLockedTeam2.add(inBattletag);
          }
          newLockedRoles.set(inBattletag, role);
        }

        // Recalculate team scores
        const score = calculateTeamScore(newTeam1, newTeam2);

        set({
          lastResult: {
            team1: newTeam1,
            team2: newTeam2,
            warnings: state.lastResult.warnings,
            score,
          },
          lockedTeam1: newLockedTeam1,
          lockedTeam2: newLockedTeam2,
          lockedRoles: newLockedRoles,
        });
      },

      // End game - track who played for sat-out logic
      endGame: () => {
        const state = get();
        if (state.lastResult) {
          const playedBattletags = new Set<string>([
            ...state.lastResult.team1.map((ra) => ra.player.battletag),
            ...state.lastResult.team2.map((ra) => ra.player.battletag),
          ]);
          
          // Track sat-out streaks
          const newSatOutStreaks = new Map(state.satOutStreaks);
          
          // Players who played have their sat-out streak reset
          for (const bt of playedBattletags) {
            newSatOutStreaks.delete(bt);
          }
          
          // Players in lobby but not in last game get their streak incremented
          const satOutPlayers: string[] = [];
          for (const bt of state.lobbyBattletags) {
            if (!state.afkPlayers.has(bt) && !playedBattletags.has(bt)) {
              satOutPlayers.push(bt);
              const currentStreak = newSatOutStreaks.get(bt) ?? 0;
              newSatOutStreaks.set(bt, currentStreak + 1);
            }
          }

          set({
            lastGamePlayers: playedBattletags,
            mustPlay: new Set(satOutPlayers),
            satOutStreaks: newSatOutStreaks,
            lastResult: null,
          });
        }
      },

      // Loss streak management AND sat-out tracking
      recordMatchResult: (winningTeam: 1 | 2) => {
        const state = get();
        if (!state.lastResult) return;

        const playedBattletags = new Set<string>([
          ...state.lastResult.team1.map((ra) => ra.player.battletag),
          ...state.lastResult.team2.map((ra) => ra.player.battletag),
        ]);

        // Update loss streaks
        const newLossStreaks = new Map(state.playerLossStreaks);
        const winners = winningTeam === 1 ? state.lastResult.team1 : state.lastResult.team2;
        const losers = winningTeam === 1 ? state.lastResult.team2 : state.lastResult.team1;

        // Track total wins/losses
        const newTotalWins = new Map(state.totalWins);
        const newTotalLosses = new Map(state.totalLosses);

        // Reset winners' loss streaks and increment total wins
        for (const ra of winners) {
          newLossStreaks.delete(ra.player.battletag);
          const currentWins = newTotalWins.get(ra.player.battletag) || 0;
          newTotalWins.set(ra.player.battletag, currentWins + 1);
        }

        // Note: allTimeWins in playerStore stays immutable (CSV baseline)
        // Session wins are tracked in totalWins Map
        // Leaderboard shows: allTimeWins + totalWins

        // Increment losers' loss streaks and total losses
        for (const ra of losers) {
          const current = newLossStreaks.get(ra.player.battletag) || 0;
          newLossStreaks.set(ra.player.battletag, current + 1);
          const currentLosses = newTotalLosses.get(ra.player.battletag) || 0;
          newTotalLosses.set(ra.player.battletag, currentLosses + 1);
        }

        // Track sat-out streaks and totals
        const newSatOutStreaks = new Map(state.satOutStreaks);
        const newTotalSatOut = new Map(state.totalSatOut);
        
        // Players who played have their sat-out streak reset
        for (const bt of playedBattletags) {
          newSatOutStreaks.delete(bt);
        }
        
        // Players in lobby but not in last game get their streak incremented and become must-play
        const satOutPlayers: string[] = [];
        for (const bt of state.lobbyBattletags) {
          if (!state.afkPlayers.has(bt) && !playedBattletags.has(bt)) {
            satOutPlayers.push(bt);
            const currentStreak = newSatOutStreaks.get(bt) ?? 0;
            newSatOutStreaks.set(bt, currentStreak + 1);
            const currentTotal = newTotalSatOut.get(bt) || 0;
            newTotalSatOut.set(bt, currentTotal + 1);
          }
        }

        console.log("recordMatchResult: satOutPlayers =", satOutPlayers);
        console.log("recordMatchResult: clearing all locks and lastResult");

        set({ 
          playerLossStreaks: newLossStreaks,
          satOutStreaks: newSatOutStreaks,
          totalWins: newTotalWins,
          totalLosses: newTotalLosses,
          totalSatOut: newTotalSatOut,
          mustPlay: new Set(satOutPlayers),
          lastGamePlayers: playedBattletags,
          lastResult: null, // Clear result so UI shows lobby
          lockedTeam1: new Set(), // Clear all locks after match
          lockedTeam2: new Set(),
          lockedRoles: new Map(),
        });
      },

      clearLossStreaks: () => {
        set({ playerLossStreaks: new Map() });
      },

      clearSessionStats: () => {
        set({
          totalWins: new Map(),
          totalLosses: new Map(),
          totalSatOut: new Map(),
          playerLossStreaks: new Map(),
          satOutStreaks: new Map(),
          adaptiveWeights: new Map(),
        });
      },

      // Adaptive weight management
      setPendingMatchResult: (winningTeam: 1 | 2) => {
        set({ pendingMatchResult: { winningTeam } });
      },

      confirmMatchScore: (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number) => {
        const state = get();
        if (!state.pendingMatchResult || !state.lastResult) {
          set({ pendingMatchResult: null });
          return;
        }

        const { winningTeam } = state.pendingMatchResult;
        const losingTeam = winningTeam === 1 ? 2 : 1;

        // Store cash scores if provided
        const lastMatchCashScores = (team1Cash !== undefined && team2Cash !== undefined)
          ? { team1: team1Cash, team2: team2Cash }
          : null;

        // Calculate roll factor: how dominant was the win?
        // Score difference normalized. E.g., 4-0 out of first-to-4 is max roll
        // Roll factor ranges from 0 (close game like 4-3) to 1 (stomp like 4-0)
        const scoreDiff = winnerScore - loserScore;
        const maxPossibleDiff = winnerScore; // If loser got 0, diff equals winnerScore
        const rollFactor = maxPossibleDiff > 0 ? scoreDiff / maxPossibleDiff : 0;

        // Base SR adjustment: ±50 SR, scaled by roll factor
        // Close games (rollFactor ~0) = minimal adjustment
        // Stomps (rollFactor ~1) = full ±50 adjustment
        const baseAdjustment = Math.round(50 * rollFactor);

        // Get players on each team
        const winners = state.lastResult[winningTeam === 1 ? "team1" : "team2"];
        const losers = state.lastResult[losingTeam === 1 ? "team1" : "team2"];

        // First, decay existing adaptive weights by 50%
        const newAdaptiveWeights = new Map<string, number>();
        for (const [bt, weight] of state.adaptiveWeights) {
          const decayed = Math.round(weight / 2);
          if (Math.abs(decayed) >= 5) { // Only keep if still significant
            newAdaptiveWeights.set(bt, decayed);
          }
        }

        // Apply new adjustment to winners (increase SR = harder matchmaking)
        for (const ra of winners) {
          const bt = ra.player.battletag;
          const current = newAdaptiveWeights.get(bt) ?? 0;
          const newWeight = Math.max(-200, Math.min(200, current + baseAdjustment));
          newAdaptiveWeights.set(bt, newWeight);
        }

        // Apply new adjustment to losers (decrease SR = easier matchmaking)
        for (const ra of losers) {
          const bt = ra.player.battletag;
          const current = newAdaptiveWeights.get(bt) ?? 0;
          const newWeight = Math.max(-200, Math.min(200, current - baseAdjustment));
          newAdaptiveWeights.set(bt, newWeight);
        }

        // Now call the original recordMatchResult logic
        set({ 
          adaptiveWeights: newAdaptiveWeights,
          pendingMatchResult: null,
          lastMatchCashScores,
        });

        // Trigger the rest of matchResult handling
        get().recordMatchResult(winningTeam);
      },

      cancelPendingMatch: () => {
        set({ pendingMatchResult: null });
      },

      getAdaptiveWeight: (battletag: string) => {
        return get().adaptiveWeights.get(battletag) ?? 0;
      },

      // Reset session
      resetSession: () => {
        set({ ...initialState });
      },

      // Update all references when a player is renamed
      renamePlayerInSession: (oldBattletag: string, newBattletag: string) => {
        set((state) => {
          // Helper to rename in a Set
          const renameInSet = (s: Set<string>): Set<string> => {
            if (!s.has(oldBattletag)) return s;
            const newSet = new Set(s);
            newSet.delete(oldBattletag);
            newSet.add(newBattletag);
            return newSet;
          };

          // Helper to rename key in a Map
          const renameInMap = <T>(m: Map<string, T>): Map<string, T> => {
            if (!m.has(oldBattletag)) return m;
            const newMap = new Map(m);
            const value = newMap.get(oldBattletag)!;
            newMap.delete(oldBattletag);
            newMap.set(newBattletag, value);
            return newMap;
          };

          // Update lobbyBattletags array
          const newLobbyBattletags = state.lobbyBattletags.map((bt) =>
            bt === oldBattletag ? newBattletag : bt
          );

          // Update soft constraints
          const newSoftConstraints = state.softConstraints.map((constraint) => ({
            players: [
              constraint.players[0] === oldBattletag ? newBattletag : constraint.players[0],
              constraint.players[1] === oldBattletag ? newBattletag : constraint.players[1],
            ] as [string, string],
            type: constraint.type,
          }));

          return {
            lobbyBattletags: newLobbyBattletags,
            mustPlay: renameInSet(state.mustPlay),
            mustPlayPriority: renameInMap(state.mustPlayPriority),
            lockedTeam1: renameInSet(state.lockedTeam1),
            lockedTeam2: renameInSet(state.lockedTeam2),
            lockedRoles: renameInMap(state.lockedRoles),
            afkPlayers: renameInSet(state.afkPlayers),
            tempWeightOverrides: renameInMap(state.tempWeightOverrides),
            softConstraints: newSoftConstraints,
            lastGamePlayers: renameInSet(state.lastGamePlayers),
            playerLossStreaks: renameInMap(state.playerLossStreaks),
            satOutStreaks: renameInMap(state.satOutStreaks),
            totalWins: renameInMap(state.totalWins),
            totalLosses: renameInMap(state.totalLosses),
            totalSatOut: renameInMap(state.totalSatOut),
            adaptiveWeights: renameInMap(state.adaptiveWeights),
          };
        });
      },

      // Get lobby players with session state applied
      getLobbyPlayers: (): LobbyPlayer[] => {
        const state = get();
        const playerStore = usePlayerStore.getState();
        
        return state.lobbyBattletags
          .map((battletag): LobbyPlayer | null => {
            const player = playerStore.getPlayer(battletag);
            if (!player) return null;

            const lockedToTeam = state.lockedTeam1.has(battletag)
              ? 1
              : state.lockedTeam2.has(battletag)
              ? 2
              : null;

            return {
              ...player,
              mustPlay: state.mustPlay.has(battletag),
              mustPlayPriority: state.mustPlayPriority.get(battletag) ?? 0,
              consecutiveSatOut: state.satOutStreaks.get(battletag) ?? 0,
              lockedToTeam,
              lockedToRole: state.lockedRoles.get(battletag) ?? null,
              tempWeightOverride: state.tempWeightOverrides.get(battletag) ?? null,
              adaptiveWeight: state.adaptiveWeights.get(battletag) ?? 0,
              isAfk: state.afkPlayers.has(battletag),
              consecutiveLosses: state.playerLossStreaks.get(battletag) ?? 0,
            };
          })
          .filter((p): p is LobbyPlayer => p !== null);
      },
    }),
    {
      name: "pugs-balancer-session",
      storage: sessionStorage,
    }
  )
);
