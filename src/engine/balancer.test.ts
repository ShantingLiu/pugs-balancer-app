import { describe, it, expect } from "vitest";
import { balanceTeams, groupPlayersByRole, canFormValidTeams } from "@engine/balancer";
import type { LobbyPlayer } from "@engine/types";

// Helper to create test players
function createLobbyPlayer(
  battletag: string,
  rolesWilling: ("Tank" | "DPS" | "Support")[],
  overrides: Partial<LobbyPlayer> = {}
): LobbyPlayer {
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
    heroPool: [],
    isOneTrick: false,
    oneTrickHero: null,
    tankOneTrick: null,
    dpsOneTrick: null,
    supportOneTrick: null,
    regularCompRank: null,
    weightModifier: 0,
    notes: null,
    mustPlay: false,
    consecutiveSatOut: 0,
    lockedToTeam: null,
    lockedToRole: null,
    tempWeightOverride: null,
    adaptiveWeight: 0,
    isAfk: false,
    consecutiveLosses: 0,
    mustPlayPriority: 0,
    allTimeWins: 0,
    ...overrides,
  };
}

describe("balancer", () => {
  describe("groupPlayersByRole", () => {
    it("should group players by willing roles", () => {
      const players = [
        createLobbyPlayer("Tank1#1234", ["Tank"]),
        createLobbyPlayer("DPS1#1234", ["DPS"]),
        createLobbyPlayer("Flex1#1234", ["Tank", "DPS", "Support"]),
      ];

      const groups = groupPlayersByRole(players);

      expect(groups.Tank).toHaveLength(2); // Tank1 and Flex1
      expect(groups.DPS).toHaveLength(2); // DPS1 and Flex1
      expect(groups.Support).toHaveLength(1); // Flex1
    });
  });

  describe("canFormValidTeams", () => {
    it("should return valid for proper composition", () => {
      const players = [
        createLobbyPlayer("Tank1#1", ["Tank"]),
        createLobbyPlayer("Tank2#2", ["Tank"]),
        createLobbyPlayer("DPS1#3", ["DPS"]),
        createLobbyPlayer("DPS2#4", ["DPS"]),
        createLobbyPlayer("DPS3#5", ["DPS"]),
        createLobbyPlayer("DPS4#6", ["DPS"]),
        createLobbyPlayer("Support1#7", ["Support"]),
        createLobbyPlayer("Support2#8", ["Support"]),
        createLobbyPlayer("Support3#9", ["Support"]),
        createLobbyPlayer("Support4#10", ["Support"]),
      ];

      const result = canFormValidTeams(players);

      expect(result.valid).toBe(true);
      expect(result.missingRoles).toHaveLength(0);
    });

    it("should return invalid when missing tanks", () => {
      const players = [
        createLobbyPlayer("Tank1#1", ["Tank"]),
        // Missing second tank
        createLobbyPlayer("DPS1#3", ["DPS"]),
        createLobbyPlayer("DPS2#4", ["DPS"]),
        createLobbyPlayer("DPS3#5", ["DPS"]),
        createLobbyPlayer("DPS4#6", ["DPS"]),
        createLobbyPlayer("Support1#7", ["Support"]),
        createLobbyPlayer("Support2#8", ["Support"]),
        createLobbyPlayer("Support3#9", ["Support"]),
        createLobbyPlayer("Support4#10", ["Support"]),
      ];

      const result = canFormValidTeams(players);

      expect(result.valid).toBe(false);
      expect(result.missingRoles).toContainEqual({ role: "Tank", have: 1, need: 2 });
    });
  });

  describe("balanceTeams", () => {
    it("should return error for < 10 players", () => {
      const players = [
        createLobbyPlayer("Tank1#1", ["Tank"]),
        createLobbyPlayer("DPS1#2", ["DPS"]),
      ];

      const result = balanceTeams(players);

      expect(result.team1).toHaveLength(0);
      expect(result.team2).toHaveLength(0);
      expect(result.warnings.some((w) => w.type === "insufficient_players")).toBe(true);
    });

    it("should exclude AFK players", () => {
      const players = [
        createLobbyPlayer("Tank1#1", ["Tank"]),
        createLobbyPlayer("Tank2#2", ["Tank"]),
        createLobbyPlayer("DPS1#3", ["DPS"]),
        createLobbyPlayer("DPS2#4", ["DPS"]),
        createLobbyPlayer("DPS3#5", ["DPS"]),
        createLobbyPlayer("DPS4#6", ["DPS"]),
        createLobbyPlayer("Support1#7", ["Support"]),
        createLobbyPlayer("Support2#8", ["Support"]),
        createLobbyPlayer("Support3#9", ["Support"]),
        createLobbyPlayer("Support4#10", ["Support"]),
        createLobbyPlayer("AFKPlayer#11", ["Tank"], { isAfk: true }),
      ];

      const result = balanceTeams(players);

      const allAssigned = [...result.team1, ...result.team2];
      expect(allAssigned.every((a) => a.player.battletag !== "AFKPlayer#11")).toBe(true);
    });

    it("should produce valid team composition (1T/2D/2S)", () => {
      const players = [
        createLobbyPlayer("Tank1#1", ["Tank"]),
        createLobbyPlayer("Tank2#2", ["Tank"]),
        createLobbyPlayer("DPS1#3", ["DPS"]),
        createLobbyPlayer("DPS2#4", ["DPS"]),
        createLobbyPlayer("DPS3#5", ["DPS"]),
        createLobbyPlayer("DPS4#6", ["DPS"]),
        createLobbyPlayer("Support1#7", ["Support"]),
        createLobbyPlayer("Support2#8", ["Support"]),
        createLobbyPlayer("Support3#9", ["Support"]),
        createLobbyPlayer("Support4#10", ["Support"]),
      ];

      const result = balanceTeams(players);

      // Check team 1 composition
      const t1Tanks = result.team1.filter((a) => a.assignedRole === "Tank");
      const t1DPS = result.team1.filter((a) => a.assignedRole === "DPS");
      const t1Support = result.team1.filter((a) => a.assignedRole === "Support");
      expect(t1Tanks).toHaveLength(1);
      expect(t1DPS).toHaveLength(2);
      expect(t1Support).toHaveLength(2);

      // Check team 2 composition
      const t2Tanks = result.team2.filter((a) => a.assignedRole === "Tank");
      const t2DPS = result.team2.filter((a) => a.assignedRole === "DPS");
      const t2Support = result.team2.filter((a) => a.assignedRole === "Support");
      expect(t2Tanks).toHaveLength(1);
      expect(t2DPS).toHaveLength(2);
      expect(t2Support).toHaveLength(2);
    });

    it("should respect team locks", () => {
      const players = [
        createLobbyPlayer("LockedTank#1", ["Tank"], { lockedToTeam: 1 }),
        createLobbyPlayer("Tank2#2", ["Tank"]),
        createLobbyPlayer("DPS1#3", ["DPS"]),
        createLobbyPlayer("DPS2#4", ["DPS"]),
        createLobbyPlayer("DPS3#5", ["DPS"]),
        createLobbyPlayer("DPS4#6", ["DPS"]),
        createLobbyPlayer("Support1#7", ["Support"]),
        createLobbyPlayer("Support2#8", ["Support"]),
        createLobbyPlayer("Support3#9", ["Support"]),
        createLobbyPlayer("Support4#10", ["Support"]),
      ];

      const result = balanceTeams(players);

      const lockedPlayer = result.team1.find((a) => a.player.battletag === "LockedTank#1");
      expect(lockedPlayer).toBeDefined();
    });

    it("should include must-play players", () => {
      const players = [
        createLobbyPlayer("MustPlayTank#1", ["Tank"], { mustPlay: true }),
        createLobbyPlayer("Tank2#2", ["Tank"]),
        createLobbyPlayer("Tank3#3", ["Tank"]), // Extra tank
        createLobbyPlayer("DPS1#4", ["DPS"]),
        createLobbyPlayer("DPS2#5", ["DPS"]),
        createLobbyPlayer("DPS3#6", ["DPS"]),
        createLobbyPlayer("DPS4#7", ["DPS"]),
        createLobbyPlayer("Support1#8", ["Support"]),
        createLobbyPlayer("Support2#9", ["Support"]),
        createLobbyPlayer("Support3#10", ["Support"]),
        createLobbyPlayer("Support4#11", ["Support"]),
      ];

      const result = balanceTeams(players);

      const allAssigned = [...result.team1, ...result.team2];
      const mustPlayer = allAssigned.find((a) => a.player.battletag === "MustPlayTank#1");
      expect(mustPlayer).toBeDefined();
    });
  });
});
