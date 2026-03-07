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
