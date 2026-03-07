import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Player } from "@engine/types";

// =============================================================================
// Mock sheetStore — must be declared before playerStore import
// =============================================================================

const mockMarkUnsynced = vi.fn();

vi.mock("@store/sheetStore", () => ({
  useSheetStore: {
    getState: () => ({
      spreadsheetId: mockSpreadsheetId,
      markUnsynced: mockMarkUnsynced,
    }),
  },
}));

let mockSpreadsheetId: string | null = "sheet-123";

// =============================================================================
// Import playerStore *after* mock setup
// =============================================================================

// We need a fresh store for each test — use the store creator directly
// Since zustand stores are singletons, we reset state in beforeEach
const { usePlayerStore } = await import("@store/playerStore");

// =============================================================================
// Test helpers
// =============================================================================

function makePlayer(battletag: string): Player {
  return {
    battletag,
    rolesWilling: [],
    rolePreference: [],
    tankRank: null,
    dpsRank: null,
    supportRank: null,
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    regularCompRank: null,
    heroPool: [],
    isOneTrick: false,
    oneTrickHero: null,
    tankOneTrick: null,
    dpsOneTrick: null,
    supportOneTrick: null,
    weightModifier: 0,
    notes: null,
    allTimeWins: 0,
    stadiumWins: 0,
    regular5v5Wins: 0,
    regular6v6Wins: 0,
  };
}

// =============================================================================
// Tests — P2-009 through P2-013: Unsynced Change Tracking
// =============================================================================

describe("playerStore unsynced change tracking", () => {
  beforeEach(() => {
    // Clear players without triggering notifyUnsynced
    mockSpreadsheetId = null;
    usePlayerStore.getState().clearPlayers();
    // Now set defaults and clear mocks
    mockSpreadsheetId = "sheet-123";
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // P2-009: setPlayers → markUnsynced
  // ---------------------------------------------------------------------------

  describe("setPlayers (P2-009)", () => {
    it("calls markUnsynced when connected to a sheet", () => {
      usePlayerStore.getState().setPlayers([makePlayer("Hero#1234")]);
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when not connected", () => {
      mockSpreadsheetId = null;
      usePlayerStore.getState().setPlayers([makePlayer("Hero#1234")]);
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-010: upsertPlayer → markUnsynced
  // ---------------------------------------------------------------------------

  describe("upsertPlayer (P2-010)", () => {
    it("calls markUnsynced when connected to a sheet", () => {
      usePlayerStore.getState().upsertPlayer(makePlayer("New#1234"));
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when not connected", () => {
      mockSpreadsheetId = null;
      usePlayerStore.getState().upsertPlayer(makePlayer("New#1234"));
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-011: updatePlayer → markUnsynced
  // ---------------------------------------------------------------------------

  describe("updatePlayer (P2-011)", () => {
    it("calls markUnsynced when connected and player exists", () => {
      usePlayerStore.getState().setPlayers([makePlayer("P#1")]);
      vi.clearAllMocks();
      usePlayerStore.getState().updatePlayer("P#1", { allTimeWins: 5 });
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when not connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("P#1")]);
      vi.clearAllMocks();
      mockSpreadsheetId = null;
      usePlayerStore.getState().updatePlayer("P#1", { allTimeWins: 5 });
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-012: removePlayer → markUnsynced
  // ---------------------------------------------------------------------------

  describe("removePlayer (P2-012)", () => {
    it("calls markUnsynced when connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("Bye#1")]);
      vi.clearAllMocks();
      usePlayerStore.getState().removePlayer("Bye#1");
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when not connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("Bye#1")]);
      vi.clearAllMocks();
      mockSpreadsheetId = null;
      usePlayerStore.getState().removePlayer("Bye#1");
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // P2-013: renamePlayer → markUnsynced
  // ---------------------------------------------------------------------------

  describe("renamePlayer (P2-013)", () => {
    it("calls markUnsynced when connected and rename succeeds", () => {
      usePlayerStore.getState().setPlayers([makePlayer("Old#1")]);
      vi.clearAllMocks();
      const result = usePlayerStore.getState().renamePlayer("Old#1", "New#1");
      expect(result).toBe(true);
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when rename fails (player not found)", () => {
      const result = usePlayerStore
        .getState()
        .renamePlayer("Nope#1", "New#1");
      expect(result).toBe(false);
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });

    it("does NOT call markUnsynced when not connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("Old#1")]);
      vi.clearAllMocks();
      mockSpreadsheetId = null;
      usePlayerStore.getState().renamePlayer("Old#1", "New#1");
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // incrementAllTimeWins → markUnsynced
  // ---------------------------------------------------------------------------

  describe("incrementAllTimeWins", () => {
    it("calls markUnsynced when connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("W#1")]);
      vi.clearAllMocks();
      usePlayerStore.getState().incrementAllTimeWins(["W#1"]);
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when not connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("W#1")]);
      vi.clearAllMocks();
      mockSpreadsheetId = null;
      usePlayerStore.getState().incrementAllTimeWins(["W#1"]);
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // clearPlayers → markUnsynced
  // ---------------------------------------------------------------------------

  describe("clearPlayers", () => {
    it("calls markUnsynced when connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("C#1")]);
      vi.clearAllMocks();
      usePlayerStore.getState().clearPlayers();
      expect(mockMarkUnsynced).toHaveBeenCalledTimes(1);
    });

    it("does NOT call markUnsynced when not connected", () => {
      usePlayerStore.getState().setPlayers([makePlayer("C#1")]);
      vi.clearAllMocks();
      mockSpreadsheetId = null;
      usePlayerStore.getState().clearPlayers();
      expect(mockMarkUnsynced).not.toHaveBeenCalled();
    });
  });
});
