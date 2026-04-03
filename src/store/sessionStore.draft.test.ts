import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "./sessionStore";
import { usePlayerStore } from "./playerStore";
import type { Player } from "@engine/types";

// =============================================================================
// Test helpers
// =============================================================================

function createPlayer(
  battletag: string,
  rolesWilling: ("Tank" | "DPS" | "Support")[],
  overrides: Partial<Player> = {}
): Player {
  return {
    battletag,
    tankRank: rolesWilling.includes("Tank") ? "Pro 3" : null,
    dpsRank: rolesWilling.includes("DPS") ? "Pro 3" : null,
    supportRank: rolesWilling.includes("Support") ? "Pro 3" : null,
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    rolesWilling,
    rolePreference: rolesWilling,
    heroPool: ["Hero1"],
    isOneTrick: false,
    oneTrickHero: null,
    tankOneTrick: null,
    dpsOneTrick: null,
    supportOneTrick: null,
    regularCompRank: null,
    weightModifier: 0,
    notes: null,
    stadiumWins: 0,
    regular5v5Wins: 0,
    regular6v6Wins: 0,
    allTimeWins: 0,
    ...overrides,
  };
}

function seedLobby(battletags: string[], roles: ("Tank" | "DPS" | "Support")[][] = []) {
  const playerStore = usePlayerStore.getState();
  const session = useSessionStore.getState();

  battletags.forEach((bt, i) => {
    const r = roles[i] ?? ["Tank", "DPS", "Support"];
    playerStore.upsertPlayer(createPlayer(bt, r));
  });

  session.setLobby(battletags);
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
  usePlayerStore.setState(usePlayerStore.getInitialState());
});

// P3-001: clearTeams
describe("clearTeams", () => {
  it("clears team locks and results", () => {
    const s = useSessionStore.getState();
    seedLobby(["A#1", "B#2"]);

    // Set up some state
    s.lockToTeam("A#1", 1);
    s.lockToTeam("B#2", 2);
    s.lockToRole("A#1", "Tank");

    useSessionStore.getState().clearTeams();

    const after = useSessionStore.getState();
    expect(after.lockedTeam1.size).toBe(0);
    expect(after.lockedTeam2.size).toBe(0);
    expect(after.lockedRoles.size).toBe(0);
    expect(after.lastResult).toBeNull();
    expect(after.previousResult).toBeNull();
    expect(after.pendingMatchResult).toBeNull();
  });

  it("preserves lobby and session stats", () => {
    seedLobby(["A#1", "B#2"]);
    const s = useSessionStore.getState();
    s.lockToTeam("A#1", 1);

    // Set some stats that should survive
    useSessionStore.setState({
      adaptiveWeights: new Map([["A#1", 50]]),
      playerLossStreaks: new Map([["A#1", 2]]),
      satOutStreaks: new Map([["B#2", 1]]),
    });

    useSessionStore.getState().clearTeams();

    const after = useSessionStore.getState();
    expect(after.lobbyBattletags).toEqual(["A#1", "B#2"]);
    expect(after.adaptiveWeights.get("A#1")).toBe(50);
    expect(after.playerLossStreaks.get("A#1")).toBe(2);
    expect(after.satOutStreaks.get("B#2")).toBe(1);
  });

  it("preserves mustPlay state", () => {
    seedLobby(["A#1", "B#2"]);
    useSessionStore.getState().toggleMustPlay("A#1");
    useSessionStore.getState().lockToTeam("A#1", 1);

    useSessionStore.getState().clearTeams();

    expect(useSessionStore.getState().mustPlay.has("A#1")).toBe(true);
  });
});

// P3-002: assignToTeam
describe("assignToTeam", () => {
  it("assigns player to specified team", () => {
    seedLobby(["A#1"], [["Tank", "DPS"]]);

    useSessionStore.getState().assignToTeam("A#1", 1);

    const s = useSessionStore.getState();
    expect(s.lockedTeam1.has("A#1")).toBe(true);
    expect(s.lockedTeam2.has("A#1")).toBe(false);
  });

  it("auto-assigns role from rolePreference[0]", () => {
    seedLobby(["A#1"], [["Tank", "DPS", "Support"]]);
    // rolePreference defaults to rolesWilling, so [0] = "Tank"

    useSessionStore.getState().assignToTeam("A#1", 2);

    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("Tank");
  });

  it("does not overwrite existing role lock", () => {
    seedLobby(["A#1"], [["Tank", "DPS"]]);
    useSessionStore.getState().lockToRole("A#1", "DPS");

    useSessionStore.getState().assignToTeam("A#1", 1);

    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("DPS");
  });

  it("validates lobby membership (no-op for non-lobby players)", () => {
    seedLobby(["A#1"]);

    useSessionStore.getState().assignToTeam("NotInLobby#1", 1);

    expect(useSessionStore.getState().lockedTeam1.size).toBe(0);
  });

  it("handles re-assignment between teams", () => {
    seedLobby(["A#1"], [["Tank"]]);

    useSessionStore.getState().assignToTeam("A#1", 1);
    expect(useSessionStore.getState().lockedTeam1.has("A#1")).toBe(true);

    useSessionStore.getState().assignToTeam("A#1", 2);
    expect(useSessionStore.getState().lockedTeam1.has("A#1")).toBe(false);
    expect(useSessionStore.getState().lockedTeam2.has("A#1")).toBe(true);
  });
});

// P3-003: unassignFromTeam
describe("unassignFromTeam", () => {
  it("clears team and role lock", () => {
    seedLobby(["A#1"], [["Tank", "DPS"]]);

    useSessionStore.getState().assignToTeam("A#1", 1);
    expect(useSessionStore.getState().lockedTeam1.has("A#1")).toBe(true);
    expect(useSessionStore.getState().lockedRoles.has("A#1")).toBe(true);

    useSessionStore.getState().unassignFromTeam("A#1");

    const s = useSessionStore.getState();
    expect(s.lockedTeam1.has("A#1")).toBe(false);
    expect(s.lockedTeam2.has("A#1")).toBe(false);
    expect(s.lockedRoles.has("A#1")).toBe(false);
  });

  it("player appears in unassigned after unassignment", () => {
    seedLobby(["A#1", "B#2"], [["Tank"], ["DPS"]]);

    useSessionStore.getState().assignToTeam("A#1", 1);
    useSessionStore.getState().unassignFromTeam("A#1");

    const { unassigned } = useSessionStore.getState().getDraftState();
    expect(unassigned.some((p) => p.battletag === "A#1")).toBe(true);
  });
});

// P3-004: cycleRole
describe("cycleRole", () => {
  it("cycles through willing roles in order", () => {
    seedLobby(["A#1"], [["Tank", "DPS", "Support"]]);
    useSessionStore.getState().assignToTeam("A#1", 1);
    // Auto-assigned "Tank" (rolePreference[0])
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("Tank");

    useSessionStore.getState().cycleRole("A#1");
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("DPS");

    useSessionStore.getState().cycleRole("A#1");
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("Support");
  });

  it("wraps around at end", () => {
    seedLobby(["A#1"], [["Tank", "DPS"]]);
    useSessionStore.getState().assignToTeam("A#1", 1);
    // Auto-assigned "Tank"

    useSessionStore.getState().cycleRole("A#1");
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("DPS");

    useSessionStore.getState().cycleRole("A#1");
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("Tank");
  });

  it("no-op for single-role players", () => {
    seedLobby(["A#1"], [["Tank"]]);
    useSessionStore.getState().assignToTeam("A#1", 1);
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("Tank");

    useSessionStore.getState().cycleRole("A#1");
    expect(useSessionStore.getState().lockedRoles.get("A#1")).toBe("Tank");
  });
});

// P3-005: getDraftState
describe("getDraftState", () => {
  it("correctly partitions lobby into team1/team2/unassigned", () => {
    seedLobby(["A#1", "B#2", "C#3"], [["Tank"], ["DPS"], ["Support"]]);

    useSessionStore.getState().assignToTeam("A#1", 1);
    useSessionStore.getState().assignToTeam("B#2", 2);

    const { team1, team2, unassigned } = useSessionStore.getState().getDraftState();

    expect(team1.map((p) => p.battletag)).toEqual(["A#1"]);
    expect(team2.map((p) => p.battletag)).toEqual(["B#2"]);
    expect(unassigned.map((p) => p.battletag)).toEqual(["C#3"]);
  });

  it("excludes AFK players from unassigned pool", () => {
    seedLobby(["A#1", "B#2", "C#3"], [["Tank"], ["DPS"], ["Support"]]);
    useSessionStore.getState().toggleAfk("C#3");

    const { unassigned } = useSessionStore.getState().getDraftState();
    expect(unassigned.some((p) => p.battletag === "C#3")).toBe(false);
  });

  it("keeps AFK players visible if already assigned to team", () => {
    seedLobby(["A#1", "B#2"], [["Tank"], ["DPS"]]);
    useSessionStore.getState().assignToTeam("A#1", 1);
    useSessionStore.getState().toggleAfk("A#1");

    const { team1 } = useSessionStore.getState().getDraftState();
    expect(team1.some((p) => p.battletag === "A#1")).toBe(true);
  });

  it("returns empty arrays when no players in lobby", () => {
    const { team1, team2, unassigned } = useSessionStore.getState().getDraftState();
    expect(team1).toEqual([]);
    expect(team2).toEqual([]);
    expect(unassigned).toEqual([]);
  });
});

// P3-006: fillRemaining
describe("fillRemaining", () => {
  function seedFullLobby() {
    // 10 players for 5v5
    const bts = Array.from({ length: 10 }, (_, i) => `P${i + 1}#${i + 1}`);
    const roles: ("Tank" | "DPS" | "Support")[][] = [
      ["Tank"], ["Tank"],                     // 2 tanks
      ["DPS"], ["DPS"], ["DPS"], ["DPS"],     // 4 DPS
      ["Support"], ["Support"], ["Support"], ["Support"], // 4 supports
    ];
    seedLobby(bts, roles);
    return bts;
  }

  it("respects manually-assigned players as locks", () => {
    const bts = seedFullLobby();

    // Assign 2 players manually
    useSessionStore.getState().assignToTeam(bts[0], 1); // Tank to team 1
    useSessionStore.getState().assignToTeam(bts[1], 2); // Tank to team 2

    const result = useSessionStore.getState().fillRemaining();
    expect(result.error).toBeUndefined();

    // Should have switched to balance view
    expect(useSessionStore.getState().draftMode).toBe(false);

    // Result should exist
    const lastResult = useSessionStore.getState().lastResult;
    expect(lastResult).not.toBeNull();
    expect(lastResult!.team1.length).toBe(5);
    expect(lastResult!.team2.length).toBe(5);

    // Locked players should be on their locked teams
    const t1Battletags = lastResult!.team1.map((ra) => ra.player.battletag);
    const t2Battletags = lastResult!.team2.map((ra) => ra.player.battletag);
    expect(t1Battletags).toContain(bts[0]);
    expect(t2Battletags).toContain(bts[1]);
  });

  it("returns error when not enough players", () => {
    seedLobby(["A#1", "B#2"], [["Tank"], ["DPS"]]);
    useSessionStore.getState().assignToTeam("A#1", 1);

    const result = useSessionStore.getState().fillRemaining();
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Need");
  });

  it("switches to balance view on success", () => {
    seedFullLobby();
    useSessionStore.getState().setDraftMode(true);
    useSessionStore.getState().assignToTeam("P1#1", 1);

    useSessionStore.getState().fillRemaining();

    expect(useSessionStore.getState().draftMode).toBe(false);
    expect(useSessionStore.getState().lastResult).not.toBeNull();
  });
});

// Bug #1: Must-pick preservation on reshuffle
describe("setLastResult mustPlay preservation", () => {
  function seedFullLobby() {
    // 12 players for 5v5 (10 play, 2 sit out)
    const bts = Array.from({ length: 12 }, (_, i) => `P${i + 1}#${i + 1}`);
    const roles: ("Tank" | "DPS" | "Support")[][] = [
      ["Tank"], ["Tank"], ["Tank"],           // 3 tanks
      ["DPS"], ["DPS"], ["DPS"], ["DPS"], ["DPS"], // 5 DPS
      ["Support"], ["Support"], ["Support"], ["Support"], // 4 supports
    ];
    seedLobby(bts, roles);
    return bts;
  }

  it("preserves mustPlay status when setting a new result (reshuffle)", () => {
    seedFullLobby();
    
    // Simulate sat-out players from previous game by setting mustPlay manually
    // This mimics what recordMatchResult does after a game
    useSessionStore.setState({
      mustPlay: new Set(["P11#11", "P12#12"]),
      mustPlayPriority: new Map([["P11#11", 2], ["P12#12", 2]]),
    });

    // Create a mock result where P11 and P12 are on teams
    const mockResult = {
      team1: [
        { player: { battletag: "P1#1" } as any, assignedRole: "Tank" as const, effectiveSR: 3000 },
        { player: { battletag: "P3#3" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P5#5" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P7#7" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
        { player: { battletag: "P11#11" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
      ],
      team2: [
        { player: { battletag: "P2#2" } as any, assignedRole: "Tank" as const, effectiveSR: 3000 },
        { player: { battletag: "P4#4" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P6#6" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P8#8" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
        { player: { battletag: "P12#12" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
      ],
      score: { team1SR: 3000, team2SR: 3000, srDifference: 0, archetypeParityMet: true },
      warnings: [],
    };

    // Reshuffle - this should NOT clear mustPlay
    useSessionStore.getState().setLastResult(mockResult);

    const after = useSessionStore.getState();
    // mustPlay should be preserved - P11 and P12 are now on teams but their mustPlay
    // status from the previous match should remain until recordMatchResult is called
    expect(after.mustPlay.has("P11#11")).toBe(true);
    expect(after.mustPlay.has("P12#12")).toBe(true);
  });

  it("does not add new sat-out players to mustPlay on reshuffle", () => {
    seedFullLobby();
    
    // No one has mustPlay initially
    expect(useSessionStore.getState().mustPlay.size).toBe(0);

    // Create a mock result where P11 and P12 sit out
    const mockResult = {
      team1: [
        { player: { battletag: "P1#1" } as any, assignedRole: "Tank" as const, effectiveSR: 3000 },
        { player: { battletag: "P3#3" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P5#5" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P7#7" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
        { player: { battletag: "P9#9" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
      ],
      team2: [
        { player: { battletag: "P2#2" } as any, assignedRole: "Tank" as const, effectiveSR: 3000 },
        { player: { battletag: "P4#4" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P6#6" } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "P8#8" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
        { player: { battletag: "P10#10" } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
      ],
      score: { team1SR: 3000, team2SR: 3000, srDifference: 0, archetypeParityMet: true },
      warnings: [],
    };

    // This is a reshuffle, NOT a match completion
    // P11 and P12 are sitting out but should NOT become mustPlay
    // (mustPlay is only set by recordMatchResult or joining mid-match)
    useSessionStore.getState().setLastResult(mockResult);

    const after = useSessionStore.getState();
    expect(after.mustPlay.has("P11#11")).toBe(false);
    expect(after.mustPlay.has("P12#12")).toBe(false);
  });
});

// swapPlayerRoles - Bug #5: Swap players between teams
describe("swapPlayerRoles", () => {
  function setupTeamsWithResult() {
    seedLobby(
      ["Tank1#1", "DPS1#1", "DPS2#1", "Sup1#1", "Sup2#1", "Tank2#2", "DPS3#2", "DPS4#2", "Sup3#2", "Sup4#2"],
      [["Tank"], ["DPS"], ["DPS"], ["Support"], ["Support"], ["Tank"], ["DPS"], ["DPS"], ["Support"], ["Support"]]
    );
    
    const mockResult = {
      team1: [
        { player: { battletag: "Tank1#1", heroPool: ["Reinhardt"] } as any, assignedRole: "Tank" as const, effectiveSR: 3000 },
        { player: { battletag: "DPS1#1", heroPool: ["Soldier: 76"] } as any, assignedRole: "DPS" as const, effectiveSR: 3100 },
        { player: { battletag: "DPS2#1", heroPool: ["Genji"] } as any, assignedRole: "DPS" as const, effectiveSR: 3050 },
        { player: { battletag: "Sup1#1", heroPool: ["Ana"] } as any, assignedRole: "Support" as const, effectiveSR: 2900 },
        { player: { battletag: "Sup2#1", heroPool: ["Mercy"] } as any, assignedRole: "Support" as const, effectiveSR: 2950 },
      ],
      team2: [
        { player: { battletag: "Tank2#2", heroPool: ["Winston"] } as any, assignedRole: "Tank" as const, effectiveSR: 3000 },
        { player: { battletag: "DPS3#2", heroPool: ["Tracer"] } as any, assignedRole: "DPS" as const, effectiveSR: 3050 },
        { player: { battletag: "DPS4#2", heroPool: ["Reaper"] } as any, assignedRole: "DPS" as const, effectiveSR: 3000 },
        { player: { battletag: "Sup3#2", heroPool: ["Lucio"] } as any, assignedRole: "Support" as const, effectiveSR: 2950 },
        { player: { battletag: "Sup4#2", heroPool: ["Moira"] } as any, assignedRole: "Support" as const, effectiveSR: 3000 },
      ],
      score: { team1SR: 3000, team2SR: 3000, srDifference: 0, archetypeParityMet: true },
      warnings: [],
    };
    
    useSessionStore.getState().setLastResult(mockResult);
    return mockResult;
  }

  it("swaps roles between players on the same team", () => {
    setupTeamsWithResult();
    
    // Swap DPS1 and Sup1 on Team 1
    useSessionStore.getState().swapPlayerRoles("DPS1#1", "Sup1#1");
    
    const result = useSessionStore.getState().lastResult!;
    const dps1 = result.team1.find(ra => ra.player.battletag === "DPS1#1");
    const sup1 = result.team1.find(ra => ra.player.battletag === "Sup1#1");
    
    expect(dps1?.assignedRole).toBe("Support");
    expect(sup1?.assignedRole).toBe("DPS");
  });

  it("swaps players between different teams (Bug #5)", () => {
    setupTeamsWithResult();
    
    // Swap DPS1 (Team 1) with DPS3 (Team 2)
    useSessionStore.getState().swapPlayerRoles("DPS1#1", "DPS3#2");
    
    const result = useSessionStore.getState().lastResult!;
    
    // DPS1 should now be on Team 2 with DPS3's role (DPS)
    const dps1OnTeam2 = result.team2.find(ra => ra.player.battletag === "DPS1#1");
    expect(dps1OnTeam2).toBeDefined();
    expect(dps1OnTeam2?.assignedRole).toBe("DPS");
    
    // DPS3 should now be on Team 1 with DPS1's role (DPS)
    const dps3OnTeam1 = result.team1.find(ra => ra.player.battletag === "DPS3#2");
    expect(dps3OnTeam1).toBeDefined();
    expect(dps3OnTeam1?.assignedRole).toBe("DPS");
    
    // Both should be gone from their original teams
    expect(result.team1.find(ra => ra.player.battletag === "DPS1#1")).toBeUndefined();
    expect(result.team2.find(ra => ra.player.battletag === "DPS3#2")).toBeUndefined();
  });

  it("swaps players with different roles between teams", () => {
    setupTeamsWithResult();
    
    // Swap Tank1 (Tank, Team 1) with DPS3 (DPS, Team 2)
    useSessionStore.getState().swapPlayerRoles("Tank1#1", "DPS3#2");
    
    const result = useSessionStore.getState().lastResult!;
    
    // Tank1 should now be on Team 2 with DPS role
    const tank1OnTeam2 = result.team2.find(ra => ra.player.battletag === "Tank1#1");
    expect(tank1OnTeam2?.assignedRole).toBe("DPS");
    
    // DPS3 should now be on Team 1 with Tank role
    const dps3OnTeam1 = result.team1.find(ra => ra.player.battletag === "DPS3#2");
    expect(dps3OnTeam1?.assignedRole).toBe("Tank");
  });

  it("updates team locks correctly on cross-team swap", () => {
    setupTeamsWithResult();
    
    // Lock DPS1 to Team 1
    useSessionStore.getState().lockToTeam("DPS1#1", 1);
    useSessionStore.getState().lockToRole("DPS1#1", "DPS");
    
    // Swap with DPS3 on Team 2
    useSessionStore.getState().swapPlayerRoles("DPS1#1", "DPS3#2");
    
    const state = useSessionStore.getState();
    
    // DPS1 should now be locked to Team 2 (their new team)
    expect(state.lockedTeam1.has("DPS1#1")).toBe(false);
    expect(state.lockedTeam2.has("DPS1#1")).toBe(true);
  });

  it("does nothing when player not found", () => {
    setupTeamsWithResult();
    
    const before = useSessionStore.getState().lastResult;
    useSessionStore.getState().swapPlayerRoles("NotFound#1", "DPS1#1");
    const after = useSessionStore.getState().lastResult;
    
    // Result should be unchanged
    expect(after).toEqual(before);
  });
});

// setLobby - Bug #9: Duplicate prevention
describe("setLobby", () => {
  it("removes duplicate battletags (Bug #9 fix)", () => {
    // Create players
    usePlayerStore.getState().upsertPlayer(createPlayer("A#1", ["Tank"]));
    usePlayerStore.getState().upsertPlayer(createPlayer("B#2", ["DPS"]));
    usePlayerStore.getState().upsertPlayer(createPlayer("C#3", ["Support"]));
    
    // Try to set lobby with duplicates
    useSessionStore.getState().setLobby(["A#1", "B#2", "A#1", "C#3", "B#2", "A#1"]);
    
    const lobby = useSessionStore.getState().lobbyBattletags;
    
    // Should have exactly 3 unique players
    expect(lobby.length).toBe(3);
    expect(lobby).toContain("A#1");
    expect(lobby).toContain("B#2");
    expect(lobby).toContain("C#3");
  });
  
  it("preserves order of first occurrence when deduplicating", () => {
    usePlayerStore.getState().upsertPlayer(createPlayer("A#1", ["Tank"]));
    usePlayerStore.getState().upsertPlayer(createPlayer("B#2", ["DPS"]));
    usePlayerStore.getState().upsertPlayer(createPlayer("C#3", ["Support"]));
    
    // Set with duplicates - A, B, A, C, B, A
    useSessionStore.getState().setLobby(["A#1", "B#2", "A#1", "C#3", "B#2", "A#1"]);
    
    const lobby = useSessionStore.getState().lobbyBattletags;
    
    // Order should be A, B, C (first occurrence of each)
    expect(lobby).toEqual(["A#1", "B#2", "C#3"]);
  });

  it("handles empty array correctly", () => {
    seedLobby(["A#1", "B#2"]);
    expect(useSessionStore.getState().lobbyBattletags.length).toBe(2);
    
    useSessionStore.getState().setLobby([]);
    
    expect(useSessionStore.getState().lobbyBattletags).toEqual([]);
    expect(useSessionStore.getState().mustPlay.size).toBe(0);
  });
});

// addToLobby - duplicate prevention
describe("addToLobby", () => {
  it("does not add duplicate battletag", () => {
    usePlayerStore.getState().upsertPlayer(createPlayer("A#1", ["Tank"]));
    
    useSessionStore.getState().addToLobby("A#1");
    useSessionStore.getState().addToLobby("A#1");
    useSessionStore.getState().addToLobby("A#1");
    
    const lobby = useSessionStore.getState().lobbyBattletags;
    expect(lobby.length).toBe(1);
    expect(lobby).toEqual(["A#1"]);
  });
});
