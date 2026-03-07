import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import type { Player } from "@engine/types";

// =============================================================================
// Integration tests for Captain Draft flows
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

function seedFullLobby() {
  const store = usePlayerStore.getState();
  const players = [
    createPlayer("T1#1", ["Tank"]),
    createPlayer("T2#2", ["Tank"]),
    createPlayer("D1#1", ["DPS"]),
    createPlayer("D2#2", ["DPS"]),
    createPlayer("D3#3", ["DPS"]),
    createPlayer("D4#4", ["DPS"]),
    createPlayer("S1#1", ["Support"]),
    createPlayer("S2#2", ["Support"]),
    createPlayer("S3#3", ["Support"]),
    createPlayer("S4#4", ["Support"]),
  ];
  players.forEach((p) => store.upsertPlayer(p));
  useSessionStore.getState().setLobby(players.map((p) => p.battletag));
  return players.map((p) => p.battletag);
}

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
  usePlayerStore.setState(usePlayerStore.getInitialState());
});

// P3-008: Post-match choice behavior
describe("post-match choice flow", () => {
  it("clearTeams + setDraftMode simulates Draft Next Game", () => {
    seedFullLobby();
    const s = useSessionStore.getState();

    // Simulate a balance result
    s.autoBalanceAfterMatch();
    expect(useSessionStore.getState().lastResult).not.toBeNull();

    // "Draft Next Game" action
    useSessionStore.getState().clearTeams();
    useSessionStore.getState().setDraftMode(true);

    const after = useSessionStore.getState();
    expect(after.lastResult).toBeNull();
    expect(after.lockedTeam1.size).toBe(0);
    expect(after.lockedTeam2.size).toBe(0);
    expect(after.draftMode).toBe(true);
    // Lobby should be preserved
    expect(after.lobbyBattletags.length).toBe(10);
  });

  it("autoBalanceAfterMatch simulates Auto-Balance Next Game", () => {
    seedFullLobby();

    useSessionStore.getState().autoBalanceAfterMatch();

    const after = useSessionStore.getState();
    expect(after.lastResult).not.toBeNull();
    expect(after.lastResult!.team1.length).toBe(5);
    expect(after.lastResult!.team2.length).toBe(5);
  });
});

// P3-009: Draft/Balance toggle
describe("Draft/Balance toggle", () => {
  it("setDraftMode toggles between modes", () => {
    expect(useSessionStore.getState().draftMode).toBe(false);

    useSessionStore.getState().setDraftMode(true);
    expect(useSessionStore.getState().draftMode).toBe(true);

    useSessionStore.getState().setDraftMode(false);
    expect(useSessionStore.getState().draftMode).toBe(false);
  });

  it("draftMode persists state when switching", () => {
    seedFullLobby();
    const s = useSessionStore.getState();

    // Assign some players in draft mode
    s.setDraftMode(true);
    s.assignToTeam("T1#1", 1);
    s.assignToTeam("D1#1", 2);

    // Switch to balance mode — locks should persist
    s.setDraftMode(false);

    const after = useSessionStore.getState();
    expect(after.lockedTeam1.has("T1#1")).toBe(true);
    expect(after.lockedTeam2.has("D1#1")).toBe(true);
  });
});

// P3-010: Full draft flow
describe("full draft flow", () => {
  it("assign 5 players per team with valid roles", () => {
    seedFullLobby();
    const s = useSessionStore.getState();

    // Assign all 10 players: 1T/2D/2S per team
    s.assignToTeam("T1#1", 1);
    s.assignToTeam("D1#1", 1);
    s.assignToTeam("D2#2", 1);
    s.assignToTeam("S1#1", 1);
    s.assignToTeam("S2#2", 1);

    s.assignToTeam("T2#2", 2);
    s.assignToTeam("D3#3", 2);
    s.assignToTeam("D4#4", 2);
    s.assignToTeam("S3#3", 2);
    s.assignToTeam("S4#4", 2);

    const { team1, team2, unassigned } = useSessionStore.getState().getDraftState();
    expect(team1.length).toBe(5);
    expect(team2.length).toBe(5);
    expect(unassigned.length).toBe(0);

    // Verify role assignments are correct
    const t1Roles = team1.map((p) => p.lockedToRole).sort();
    expect(t1Roles).toEqual(["DPS", "DPS", "Support", "Support", "Tank"]);

    const t2Roles = team2.map((p) => p.lockedToRole).sort();
    expect(t2Roles).toEqual(["DPS", "DPS", "Support", "Support", "Tank"]);
  });
});

// P3-011: Hybrid flow
describe("hybrid draft flow", () => {
  it("assign 3 per team then Fill Remaining fills rest", () => {
    seedFullLobby();
    const s = useSessionStore.getState();
    s.setDraftMode(true);

    // Captains pick 3 each
    s.assignToTeam("T1#1", 1);
    s.assignToTeam("D1#1", 1);
    s.assignToTeam("S1#1", 1);

    s.assignToTeam("T2#2", 2);
    s.assignToTeam("D3#3", 2);
    s.assignToTeam("S3#3", 2);

    // Fill remaining should auto-balance the last 4 players
    const result = useSessionStore.getState().fillRemaining();
    expect(result.error).toBeUndefined();

    const after = useSessionStore.getState();
    expect(after.draftMode).toBe(false); // Switches to balance view
    expect(after.lastResult).not.toBeNull();
    expect(after.lastResult!.team1.length).toBe(5);
    expect(after.lastResult!.team2.length).toBe(5);

    // Verify locked players ended up on their locked team
    const t1Bts = after.lastResult!.team1.map((ra) => ra.player.battletag);
    expect(t1Bts).toContain("T1#1");
    expect(t1Bts).toContain("D1#1");
    expect(t1Bts).toContain("S1#1");

    const t2Bts = after.lastResult!.team2.map((ra) => ra.player.battletag);
    expect(t2Bts).toContain("T2#2");
    expect(t2Bts).toContain("D3#3");
    expect(t2Bts).toContain("S3#3");
  });
});

// P3-012: Post-match → draft flow
describe("post-match to draft flow", () => {
  it("confirm match → clear teams → draft view → assign new teams", () => {
    seedFullLobby();
    const s = useSessionStore.getState();

    // 1. Generate initial teams
    s.autoBalanceAfterMatch();
    expect(useSessionStore.getState().lastResult).not.toBeNull();

    // 2. Record match result (Team 1 won)
    useSessionStore.getState().setPendingMatchResult(1);
    useSessionStore.getState().confirmMatchScore(4, 0);

    // 3. Choose "Draft Next Game"
    useSessionStore.getState().clearTeams();
    useSessionStore.getState().setDraftMode(true);

    const afterClear = useSessionStore.getState();
    expect(afterClear.lastResult).toBeNull();
    expect(afterClear.draftMode).toBe(true);
    expect(afterClear.lobbyBattletags.length).toBe(10);

    // 4. Assign new teams
    useSessionStore.getState().assignToTeam("T1#1", 2); // Switch sides!
    useSessionStore.getState().assignToTeam("T2#2", 1);

    const { team1, team2 } = useSessionStore.getState().getDraftState();
    expect(team1.some((p) => p.battletag === "T2#2")).toBe(true);
    expect(team2.some((p) => p.battletag === "T1#1")).toBe(true);
  });
});
