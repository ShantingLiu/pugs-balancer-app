import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameMode, LobbyPlayer, Role, RoleAssignment, SoftConstraint, TeamAssignment } from "@engine/types";
import { usePlayerStore } from "./playerStore";
import { balanceTeams } from "@engine/balancer";
import { getEffectiveSR } from "@utils/rankMapper";
import { calculateTeamScore } from "@engine/scoring";
import { getModeConfig } from "@engine/modeConfig";

// =============================================================================
// Session Store - Manages current balancing session state
// =============================================================================

interface SessionState {
  /** Current game mode */
  gameMode: GameMode;

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

  /** Total wins per player this session by mode (mode -> battletag -> count) */
  totalWins: Record<GameMode, Map<string, number>>;

  /** Total losses per player this session by mode (mode -> battletag -> count) */
  totalLosses: Record<GameMode, Map<string, number>>;

  /** Total games sat out per player this session (battletag -> count) */
  totalSatOut: Map<string, number>;

  /** Adaptive weight adjustments from match scores (battletag -> SR modifier) */
  adaptiveWeights: Map<string, number>;

  /** Pending match result - team that won, waiting for score input */
  pendingMatchResult: { winningTeam: 1 | 2 } | null;

  /** Last match final cash scores (for analysis) */
  lastMatchCashScores: { team1: number; team2: number } | null;

  /** Whether to show weight modifiers in team display (hide from players) */
  showWeightModifiers: boolean;

  /** Font scale for accessibility */
  fontScale: "normal" | "large" | "x-large";

  /** Whether draft mode is active (captain pick flow) */
  draftMode: boolean;
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

  // Draft mode
  setDraftMode: (enabled: boolean) => void;
  clearTeams: () => void;
  assignToTeam: (battletag: string, team: 1 | 2, role?: Role) => void;
  unassignFromTeam: (battletag: string) => void;
  cycleRole: (battletag: string) => void;
  getDraftState: () => { team1: LobbyPlayer[]; team2: LobbyPlayer[]; unassigned: LobbyPlayer[] };
  fillRemaining: () => { error?: string };

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

  // Win consolidation for sync
  clearSessionWins: () => void;

  // Adaptive weight management
  setPendingMatchResult: (winningTeam: 1 | 2) => void;
  confirmMatchScore: (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number, winnerAdj?: number, loserAdj?: number) => void;
  cancelPendingMatch: () => void;
  getAdaptiveWeight: (battletag: string) => number;
  clearAdaptiveWeights: () => void;
  
  // Auto-balance after match ends
  autoBalanceAfterMatch: () => void;

  // Balance only the drafted players (lockedTeam1 + lockedTeam2)
  balanceDraftedPlayers: () => { error?: string };

  // Reset session
  resetSession: () => void;

  // Game mode management
  setGameMode: (mode: GameMode) => void;

  // Toggle weight modifier visibility
  toggleShowWeightModifiers: () => void;

  // Cycle font scale for accessibility
  cycleFontScale: () => void;

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
        // Handle migration from old flat totalWins/totalLosses to mode-keyed structure
        if (parsed.state.totalWins instanceof Array || parsed.state.totalWins === undefined) {
          // Old format was [["battletag", wins], ...] - migrate to stadium_5v5
          const oldWins = new Map(parsed.state.totalWins || []);
          parsed.state.totalWins = {
            stadium_5v5: oldWins,
            regular_5v5: new Map(),
            regular_6v6: new Map(),
          };
        } else {
          // New format - deserialize nested Maps
          parsed.state.totalWins = {
            stadium_5v5: new Map(parsed.state.totalWins.stadium_5v5 || []),
            regular_5v5: new Map(parsed.state.totalWins.regular_5v5 || []),
            regular_6v6: new Map(parsed.state.totalWins.regular_6v6 || []),
          };
        }
        if (parsed.state.totalLosses instanceof Array || parsed.state.totalLosses === undefined) {
          const oldLosses = new Map(parsed.state.totalLosses || []);
          parsed.state.totalLosses = {
            stadium_5v5: oldLosses,
            regular_5v5: new Map(),
            regular_6v6: new Map(),
          };
        } else {
          parsed.state.totalLosses = {
            stadium_5v5: new Map(parsed.state.totalLosses.stadium_5v5 || []),
            regular_5v5: new Map(parsed.state.totalLosses.regular_5v5 || []),
            regular_6v6: new Map(parsed.state.totalLosses.regular_6v6 || []),
          };
        }
        parsed.state.totalSatOut = new Map(parsed.state.totalSatOut || []);
        parsed.state.adaptiveWeights = new Map(parsed.state.adaptiveWeights || []);
        // Ensure softConstraints array exists
        parsed.state.softConstraints = parsed.state.softConstraints || [];
        parsed.state.lobbyBattletags = parsed.state.lobbyBattletags || [];
        parsed.state.pendingMatchResult = parsed.state.pendingMatchResult || null;
        parsed.state.lastMatchCashScores = parsed.state.lastMatchCashScores || null;
        // Default gameMode for existing sessions
        parsed.state.gameMode = parsed.state.gameMode || "stadium_5v5";
        // Default draftMode for existing sessions
        parsed.state.draftMode = parsed.state.draftMode ?? false;
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse session storage:", e);
      
      // Backup corrupted data before clearing
      try {
        const rawStr = localStorage.getItem(name);
        if (rawStr) {
          const backupKey = `${name}_backup_${Date.now()}`;
          localStorage.setItem(backupKey, rawStr);
          console.warn(`Corrupted session data backed up to: ${backupKey}`);
        }
      } catch {
        // Backup failed, proceed with reset
      }
      
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
        totalWins: {
          stadium_5v5: Array.from(toStore.state.totalWins.stadium_5v5.entries()),
          regular_5v5: Array.from(toStore.state.totalWins.regular_5v5.entries()),
          regular_6v6: Array.from(toStore.state.totalWins.regular_6v6.entries()),
        },
        totalLosses: {
          stadium_5v5: Array.from(toStore.state.totalLosses.stadium_5v5.entries()),
          regular_5v5: Array.from(toStore.state.totalLosses.regular_5v5.entries()),
          regular_6v6: Array.from(toStore.state.totalLosses.regular_6v6.entries()),
        },
        totalSatOut: Array.from(toStore.state.totalSatOut.entries()),
        adaptiveWeights: Array.from(toStore.state.adaptiveWeights.entries()),
      },
    };
    localStorage.setItem(name, JSON.stringify(serializable));
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

/** Helper to create empty mode-keyed wins/losses structure */
function createEmptyModeWins(): Record<GameMode, Map<string, number>> {
  return {
    stadium_5v5: new Map(),
    regular_5v5: new Map(),
    regular_6v6: new Map(),
  };
}

const initialState: SessionState = {
  gameMode: "stadium_5v5",
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
  totalWins: createEmptyModeWins(),
  totalLosses: createEmptyModeWins(),
  totalSatOut: new Map(),
  adaptiveWeights: new Map(),
  pendingMatchResult: null,
  lastMatchCashScores: null,
  showWeightModifiers: true,
  fontScale: "normal" as const,
  draftMode: false,
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

          return { lockedTeam1: newTeam1, lockedTeam2: newTeam2 };
        });
      },

      clearTeamLocks: () => {
        set({ lockedTeam1: new Set(), lockedTeam2: new Set() });
      },

      // Role lock management
      lockToRole: (battletag: string, role: Role | null) => {
        set((state) => {
          const newLockedRoles = new Map(state.lockedRoles);
          if (role === null) {
            newLockedRoles.delete(battletag);
          } else {
            newLockedRoles.set(battletag, role);
          }
          return { lockedRoles: newLockedRoles };
        });
      },

      clearRoleLocks: () => {
        set({ lockedRoles: new Map() });
      },

      // Draft mode
      setDraftMode: (enabled: boolean) => {
        set({ draftMode: enabled });
      },

      clearTeams: () => {
        set({
          lastResult: null,
          previousResult: null,
          lockedTeam1: new Set(),
          lockedTeam2: new Set(),
          lockedRoles: new Map(),
          pendingMatchResult: null,
        });
      },

      assignToTeam: (battletag: string, team: 1 | 2, role?: Role) => {
        const state = get();
        if (!state.lobbyBattletags.includes(battletag)) return;

        const newTeam1 = new Set(state.lockedTeam1);
        const newTeam2 = new Set(state.lockedTeam2);

        // Remove from both teams first
        newTeam1.delete(battletag);
        newTeam2.delete(battletag);

        // Add to specified team
        if (team === 1) {
          newTeam1.add(battletag);
        } else {
          newTeam2.add(battletag);
        }

        // Use provided role, or auto-assign from preference if not already locked
        const newLockedRoles = new Map(state.lockedRoles);
        if (role) {
          newLockedRoles.set(battletag, role);
        } else if (!newLockedRoles.has(battletag)) {
          const playerStore = usePlayerStore.getState();
          const player = playerStore.getPlayer(battletag);
          if (player && player.rolePreference.length > 0) {
            newLockedRoles.set(battletag, player.rolePreference[0]);
          }
        }

        set({ lockedTeam1: newTeam1, lockedTeam2: newTeam2, lockedRoles: newLockedRoles });
      },

      unassignFromTeam: (battletag: string) => {
        set((state) => {
          const newTeam1 = new Set(state.lockedTeam1);
          const newTeam2 = new Set(state.lockedTeam2);
          const newLockedRoles = new Map(state.lockedRoles);

          newTeam1.delete(battletag);
          newTeam2.delete(battletag);
          newLockedRoles.delete(battletag);

          return { lockedTeam1: newTeam1, lockedTeam2: newTeam2, lockedRoles: newLockedRoles };
        });
      },

      cycleRole: (battletag: string) => {
        const state = get();
        const playerStore = usePlayerStore.getState();
        const player = playerStore.getPlayer(battletag);
        if (!player || player.rolesWilling.length <= 1) return;

        const currentRole = state.lockedRoles.get(battletag);
        const currentIndex = currentRole ? player.rolesWilling.indexOf(currentRole) : -1;
        const nextIndex = (currentIndex + 1) % player.rolesWilling.length;

        const newLockedRoles = new Map(state.lockedRoles);
        newLockedRoles.set(battletag, player.rolesWilling[nextIndex]);
        set({ lockedRoles: newLockedRoles });
      },

      getDraftState: () => {
        const lobbyPlayers = get().getLobbyPlayers();

        const team1: LobbyPlayer[] = [];
        const team2: LobbyPlayer[] = [];
        const unassigned: LobbyPlayer[] = [];

        for (const player of lobbyPlayers) {
          if (player.lockedToTeam === 1) {
            team1.push(player);
          } else if (player.lockedToTeam === 2) {
            team2.push(player);
          } else if (!player.isAfk) {
            unassigned.push(player);
          }
        }

        return { team1, team2, unassigned };
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
              const modeConfig = getModeConfig(updatedState.gameMode);
              const requiredPlayers = modeConfig.teamSize * 2;
              if (lobbyPlayers.length >= requiredPlayers) {
                // Clear must-play for reshuffle - those are for next match only
                const playersForBalance = lobbyPlayers.map((p) => ({ ...p, mustPlay: false }));
                const result = balanceTeams(playersForBalance, updatedState.softConstraints, updatedState.gameMode);
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
        
        const team1Battletags = new Set(result.team1.map((ra) => ra.player.battletag));
        const team2Battletags = new Set(result.team2.map((ra) => ra.player.battletag));

        // Only keep locks for players who actually ended up on their locked team.
        // Drop locks for players who sat out or ended up on the wrong team.
        const newLockedTeam1 = new Set<string>();
        const newLockedTeam2 = new Set<string>();

        for (const bt of state.lockedTeam1) {
          if (team1Battletags.has(bt)) {
            newLockedTeam1.add(bt);
          }
        }

        for (const bt of state.lockedTeam2) {
          if (team2Battletags.has(bt)) {
            newLockedTeam2.add(bt);
          }
        }

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

        // Only preserve role locks for players who are playing in their locked role
        const allAssignments = [...result.team1, ...result.team2];
        const newLockedRoles = new Map<string, Role>();
        for (const [bt, role] of state.lockedRoles.entries()) {
          const assignment = allAssignments.find((a) => a.player.battletag === bt);
          if (assignment && assignment.assignedRole === role) {
            newLockedRoles.set(bt, role);
          }
        }

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

        // Swap their roles and recalculate effectiveSR for the new role
        const teamArray = player1Team === 1 ? team1Array : team2Array;
        const role1 = teamArray[player1Index].assignedRole;
        const role2 = teamArray[player2Index].assignedRole;

        const lobbyPlayers = state.getLobbyPlayers();
        const lp1 = lobbyPlayers.find((p) => p.battletag === battletag1);
        const lp2 = lobbyPlayers.find((p) => p.battletag === battletag2);

        if (lp1 && lp2) {
          teamArray[player1Index] = {
            ...teamArray[player1Index],
            assignedRole: role2,
            effectiveSR: getEffectiveSR(lp1, role2, state.gameMode),
          };
          teamArray[player2Index] = {
            ...teamArray[player2Index],
            assignedRole: role1,
            effectiveSR: getEffectiveSR(lp2, role1, state.gameMode),
          };
        } else {
          teamArray[player1Index] = { ...teamArray[player1Index], assignedRole: role2 };
          teamArray[player2Index] = { ...teamArray[player2Index], assignedRole: role1 };
        }

        // Update locked roles if either player was role-locked
        const newLockedRoles = new Map(state.lockedRoles);
        if (newLockedRoles.has(battletag1)) {
          newLockedRoles.set(battletag1, role2);
        }
        if (newLockedRoles.has(battletag2)) {
          newLockedRoles.set(battletag2, role1);
        }

        // Recalculate team scores
        const finalTeam1 = player1Team === 1 ? teamArray : team1Array;
        const finalTeam2 = player1Team === 2 ? teamArray : team2Array;
        const score = calculateTeamScore(finalTeam1, finalTeam2, state.gameMode);

        set({
          lastResult: {
            team1: finalTeam1,
            team2: finalTeam2,
            warnings: state.lastResult.warnings,
            score,
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
        
        // Get battletags for each team — from lastResult or from draft locks
        let team1Bts: string[];
        let team2Bts: string[];
        if (state.lastResult) {
          team1Bts = state.lastResult.team1.map((ra) => ra.player.battletag);
          team2Bts = state.lastResult.team2.map((ra) => ra.player.battletag);
        } else if (state.lockedTeam1.size > 0 || state.lockedTeam2.size > 0) {
          team1Bts = [...state.lockedTeam1];
          team2Bts = [...state.lockedTeam2];
        } else {
          return;
        }

        const playedBattletags = new Set<string>([...team1Bts, ...team2Bts]);

        // Update loss streaks
        const newLossStreaks = new Map(state.playerLossStreaks);
        const winnerBts = winningTeam === 1 ? team1Bts : team2Bts;
        const loserBts = winningTeam === 1 ? team2Bts : team1Bts;

        // Track total wins/losses for current mode
        const currentMode = state.gameMode;
        const newModeWins = new Map(state.totalWins[currentMode]);
        const newModeLosses = new Map(state.totalLosses[currentMode]);

        // Reset winners' loss streaks and increment total wins for current mode
        for (const bt of winnerBts) {
          newLossStreaks.delete(bt);
          const currentWins = newModeWins.get(bt) || 0;
          newModeWins.set(bt, currentWins + 1);
        }

        // Note: mode-specific wins in playerStore stays immutable (CSV baseline)
        // Session wins are tracked in totalWins[mode] Map
        // Leaderboard shows: playerModeWins + totalWins[mode]

        // Increment losers' loss streaks and total losses for current mode
        for (const bt of loserBts) {
          const current = newLossStreaks.get(bt) || 0;
          newLossStreaks.set(bt, current + 1);
          const currentLosses = newModeLosses.get(bt) || 0;
          newModeLosses.set(bt, currentLosses + 1);
        }

        // Build updated mode wins/losses objects
        const newTotalWins = {
          ...state.totalWins,
          [currentMode]: newModeWins,
        };
        const newTotalLosses = {
          ...state.totalLosses,
          [currentMode]: newModeLosses,
        };

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
          totalWins: createEmptyModeWins(),
          totalLosses: createEmptyModeWins(),
          totalSatOut: new Map(),
          playerLossStreaks: new Map(),
          satOutStreaks: new Map(),
          adaptiveWeights: new Map(),
        });
      },

      clearSessionWins: () => {
        set({ totalWins: createEmptyModeWins() });
      },

      // Adaptive weight management
      clearAdaptiveWeights: () => {
        set({ adaptiveWeights: new Map() });
      },

      setPendingMatchResult: (winningTeam: 1 | 2) => {
        set({ pendingMatchResult: { winningTeam } });
      },

      confirmMatchScore: (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number, winnerAdj?: number, loserAdj?: number) => {
        const state = get();
        if (!state.pendingMatchResult) {
          set({ pendingMatchResult: null });
          return;
        }

        // Get battletags for each team — from lastResult or from draft locks
        let team1Bts: string[];
        let team2Bts: string[];
        if (state.lastResult) {
          team1Bts = state.lastResult.team1.map((ra) => ra.player.battletag);
          team2Bts = state.lastResult.team2.map((ra) => ra.player.battletag);
        } else if (state.lockedTeam1.size > 0 || state.lockedTeam2.size > 0) {
          team1Bts = [...state.lockedTeam1];
          team2Bts = [...state.lockedTeam2];
        } else {
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
        const scoreDiff = winnerScore - loserScore;
        const maxPossibleDiff = winnerScore;
        const rollFactor = maxPossibleDiff > 0 ? scoreDiff / maxPossibleDiff : 0;

        const autoAdjustment = Math.round(50 * rollFactor);
        const winnerAdjustment = winnerAdj ?? autoAdjustment;
        const loserAdjustment = loserAdj ?? autoAdjustment;

        const winnerBts = winningTeam === 1 ? team1Bts : team2Bts;
        const loserBts = losingTeam === 1 ? team1Bts : team2Bts;

        // First, decay existing adaptive weights by 50%
        const newAdaptiveWeights = new Map<string, number>();
        for (const [bt, weight] of state.adaptiveWeights) {
          const decayed = Math.round(weight / 2);
          if (Math.abs(decayed) >= 5) {
            newAdaptiveWeights.set(bt, decayed);
          }
        }

        // Apply new adjustment to winners (increase SR = harder matchmaking)
        for (const bt of winnerBts) {
          const current = newAdaptiveWeights.get(bt) ?? 0;
          const newWeight = Math.max(-200, Math.min(200, current + winnerAdjustment));
          newAdaptiveWeights.set(bt, newWeight);
        }

        // Apply new adjustment to losers (decrease SR = easier matchmaking)
        for (const bt of loserBts) {
          const current = newAdaptiveWeights.get(bt) ?? 0;
          const newWeight = Math.max(-200, Math.min(200, current - loserAdjustment));
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

      autoBalanceAfterMatch: () => {
        const state = get();
        const lobbyPlayers = state.getLobbyPlayers();
        const modeConfig = getModeConfig(state.gameMode);
        const requiredPlayers = modeConfig.teamSize * 2;
        
        if (lobbyPlayers.length >= requiredPlayers) {
          const newResult = balanceTeams(lobbyPlayers, state.softConstraints, state.gameMode);
          set({ lastResult: newResult });
        }
      },

      balanceDraftedPlayers: () => {
        const state = get();
        const modeConfig = getModeConfig(state.gameMode);
        const requiredPlayers = modeConfig.teamSize * 2;
        const draftedBattletags = new Set([...state.lockedTeam1, ...state.lockedTeam2]);

        if (draftedBattletags.size < requiredPlayers) {
          return { error: `Need ${requiredPlayers} drafted players, have ${draftedBattletags.size}` };
        }

        // Get lobby players for only the drafted subset, with locks cleared so balancer can freely assign
        const lobbyPlayers = state.getLobbyPlayers()
          .filter((p) => draftedBattletags.has(p.battletag))
          .map((p) => ({ ...p, lockedToTeam: null as (1 | 2 | null) }));

        const newResult = balanceTeams(lobbyPlayers, state.softConstraints, state.gameMode);

        // Re-assign drafted players to their balanced teams, staying in draft mode
        const newLockedTeam1 = new Set<string>();
        const newLockedTeam2 = new Set<string>();
        const newLockedRoles = new Map<string, Role>();

        for (const assignment of newResult.team1) {
          newLockedTeam1.add(assignment.player.battletag);
          newLockedRoles.set(assignment.player.battletag, assignment.assignedRole);
        }
        for (const assignment of newResult.team2) {
          newLockedTeam2.add(assignment.player.battletag);
          newLockedRoles.set(assignment.player.battletag, assignment.assignedRole);
        }

        set({
          lockedTeam1: newLockedTeam1,
          lockedTeam2: newLockedTeam2,
          lockedRoles: newLockedRoles,
        });

        return {};
      },

      fillRemaining: () => {
        const state = get();
        const lobbyPlayers = state.getLobbyPlayers();
        const modeConfig = getModeConfig(state.gameMode);
        const requiredPlayers = modeConfig.teamSize * 2;

        // Count non-AFK available players
        const availablePlayers = lobbyPlayers.filter((p) => !p.isAfk);
        if (availablePlayers.length < requiredPlayers) {
          return { error: `Need ${requiredPlayers} players but only ${availablePlayers.length} available (${lobbyPlayers.length - availablePlayers.length} AFK)` };
        }

        // Run balancer — assigned players already have lockedToTeam/lockedToRole set,
        // so the balancer respects them natively
        const result = balanceTeams(lobbyPlayers, state.softConstraints, state.gameMode);

        if (result.team1.length === 0 || result.team2.length === 0) {
          return { error: "Could not form valid teams. Check role composition — assigned players may conflict with available roles." };
        }

        // Store result and switch to balance view
        get().setLastResult(result);
        set({ draftMode: false });
        return {};
      },

      // Reset session
      resetSession: () => {
        set({ ...initialState });
      },

      // Game mode management
      setGameMode: (mode: GameMode) => {
        // Switching modes preserves session stats (mode-specific wins/losses are separate)
        // but resets balancing state (result, locks, etc.)
        set((state) => ({
          gameMode: mode,
          // Reset balancing state
          lastResult: null,
          previousResult: null,
          lastGamePlayers: new Set<string>(),
          playerLossStreaks: new Map<string, number>(),
          satOutStreaks: new Map<string, number>(),
          // Preserve mode-specific wins/losses
          totalWins: state.totalWins,
          totalLosses: state.totalLosses,
          totalSatOut: new Map<string, number>(),
          adaptiveWeights: new Map<string, number>(),
          pendingMatchResult: null,
          lastMatchCashScores: null,
          // Preserve lobby and constraints, but clear team/role locks
          // (slot counts differ between modes so stale locks would be invalid)
          lobbyBattletags: state.lobbyBattletags,
          mustPlay: state.mustPlay,
          mustPlayPriority: state.mustPlayPriority,
          lockedTeam1: new Set<string>(),
          lockedTeam2: new Set<string>(),
          lockedRoles: new Map<string, Role>(),
          tempWeightOverrides: state.tempWeightOverrides,
          afkPlayers: state.afkPlayers,
          softConstraints: state.softConstraints,
        }));
      },

      // Toggle weight modifier visibility
      toggleShowWeightModifiers: () => {
        set((state) => ({ showWeightModifiers: !state.showWeightModifiers }));
      },

      // Cycle font scale for accessibility
      cycleFontScale: () => {
        set((state) => {
          const order = ["normal", "large", "x-large"] as const;
          const idx = order.indexOf(state.fontScale);
          return { fontScale: order[(idx + 1) % order.length] };
        });
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

          // Helper to rename in mode-keyed wins/losses structure
          const renameInModeWins = (record: Record<GameMode, Map<string, number>>): Record<GameMode, Map<string, number>> => ({
            stadium_5v5: renameInMap(record.stadium_5v5),
            regular_5v5: renameInMap(record.regular_5v5),
            regular_6v6: renameInMap(record.regular_6v6),
          });

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
            totalWins: renameInModeWins(state.totalWins),
            totalLosses: renameInModeWins(state.totalLosses),
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
