import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "@engine/types";

// =============================================================================
// Player Store - Manages imported player roster
// =============================================================================

interface PlayerState {
  /** All imported players keyed by battletag */
  players: Map<string, Player>;

  /** Last import timestamp */
  lastImportedAt: number | null;
}

interface PlayerActions {
  /** Replace all players (typically from CSV import) */
  setPlayers: (players: Player[]) => void;

  /** Add or update a single player */
  upsertPlayer: (player: Player) => void;

  /** Update an existing player */
  updatePlayer: (battletag: string, updates: Partial<Player>) => void;

  /** Rename a player (change their battletag) */
  renamePlayer: (oldBattletag: string, newBattletag: string) => boolean;

  /** Remove a player by battletag */
  removePlayer: (battletag: string) => void;

  /** Increment allTimeWins for a list of battletags */
  incrementAllTimeWins: (battletags: string[]) => void;

  /** Clear all players */
  clearPlayers: () => void;

  /** Get a player by battletag */
  getPlayer: (battletag: string) => Player | undefined;

  /** Get all players as array */
  getAllPlayers: () => Player[];
}

export type PlayerStore = PlayerState & PlayerActions;

/**
 * Custom serialization for Map to work with persist middleware
 */
const mapStorage = {
  getItem: (name: string) => {
    try {
      const str = localStorage.getItem(name);
      if (!str) return null;
      const parsed = JSON.parse(str);
      // Convert players array back to Map
      if (parsed.state?.players) {
        const playersMap = new Map(parsed.state.players);
        // Migration: ensure allTimeWins exists for all players
        for (const [bt, player] of playersMap) {
          if ((player as Player).allTimeWins === undefined || (player as Player).allTimeWins === null) {
            playersMap.set(bt, { ...(player as Player), allTimeWins: 0 });
          }
        }
        parsed.state.players = playersMap;
      } else if (parsed.state) {
        parsed.state.players = new Map();
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse player storage, resetting:", e);
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: unknown) => {
    const toStore = value as { state: PlayerState };
    // Convert Map to array for JSON serialization
    const serializable = {
      ...toStore,
      state: {
        ...toStore.state,
        players: Array.from(toStore.state.players.entries()),
      },
    };
    localStorage.setItem(name, JSON.stringify(serializable));
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      // Initial state
      players: new Map(),
      lastImportedAt: null,

      // Actions
      setPlayers: (players: Player[]) => {
        const playerMap = new Map<string, Player>();
        for (const player of players) {
          playerMap.set(player.battletag, player);
        }
        set({
          players: playerMap,
          lastImportedAt: Date.now(),
        });
      },

      upsertPlayer: (player: Player) => {
        set((state) => {
          const newPlayers = new Map(state.players);
          newPlayers.set(player.battletag, player);
          return { players: newPlayers };
        });
      },

      updatePlayer: (battletag: string, updates: Partial<Player>) => {
        set((state) => {
          const existing = state.players.get(battletag);
          if (!existing) return state;

          const newPlayers = new Map(state.players);
          newPlayers.set(battletag, { ...existing, ...updates });
          return { players: newPlayers };
        });
      },

      renamePlayer: (oldBattletag: string, newBattletag: string) => {
        const state = get();
        const existing = state.players.get(oldBattletag);
        if (!existing) return false;
        if (state.players.has(newBattletag)) return false; // New name already taken

        // Update the player's battletag and add under new key
        const renamedPlayer: Player = { ...existing, battletag: newBattletag };
        const newPlayers = new Map(state.players);
        newPlayers.delete(oldBattletag);
        newPlayers.set(newBattletag, renamedPlayer);
        set({ players: newPlayers });
        return true;
      },

      removePlayer: (battletag: string) => {
        set((state) => {
          const newPlayers = new Map(state.players);
          newPlayers.delete(battletag);
          return { players: newPlayers };
        });
      },

      incrementAllTimeWins: (battletags: string[]) => {
        console.log("incrementAllTimeWins called with:", battletags);
        set((state) => {
          const newPlayers = new Map(state.players);
          for (const bt of battletags) {
            const player = newPlayers.get(bt);
            if (player) {
              const currentWins = player.allTimeWins ?? 0;
              const newWins = currentWins + 1;
              console.log(`  ${bt}: ${currentWins} -> ${newWins}`);
              newPlayers.set(bt, { ...player, allTimeWins: newWins });
            } else {
              console.log(`  ${bt}: player not found in store`);
            }
          }
          return { players: newPlayers };
        });
      },

      clearPlayers: () => {
        set({
          players: new Map(),
          lastImportedAt: null,
        });
      },

      getPlayer: (battletag: string) => {
        return get().players.get(battletag);
      },

      getAllPlayers: () => {
        return Array.from(get().players.values());
      },
    }),
    {
      name: "pugs-balancer-players",
      storage: mapStorage,
    }
  )
);
