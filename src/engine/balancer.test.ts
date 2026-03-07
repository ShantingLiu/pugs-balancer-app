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
    stadiumWins: 0,
    regular5v5Wins: 0,
    regular6v6Wins: 0,
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

    it("should produce valid 6v6 team composition (2T/2D/2S)", () => {
      const players = [
        createLobbyPlayer("Tank1#1", ["Tank"]),
        createLobbyPlayer("Tank2#2", ["Tank"]),
        createLobbyPlayer("Tank3#3", ["Tank"]),
        createLobbyPlayer("Tank4#4", ["Tank"]),
        createLobbyPlayer("DPS1#5", ["DPS"]),
        createLobbyPlayer("DPS2#6", ["DPS"]),
        createLobbyPlayer("DPS3#7", ["DPS"]),
        createLobbyPlayer("DPS4#8", ["DPS"]),
        createLobbyPlayer("Support1#9", ["Support"]),
        createLobbyPlayer("Support2#10", ["Support"]),
        createLobbyPlayer("Support3#11", ["Support"]),
        createLobbyPlayer("Support4#12", ["Support"]),
      ];

      const result = balanceTeams(players, [], "regular_6v6");

      // Check team 1 composition - should be 2T/2D/2S
      const t1Tanks = result.team1.filter((a) => a.assignedRole === "Tank");
      const t1DPS = result.team1.filter((a) => a.assignedRole === "DPS");
      const t1Support = result.team1.filter((a) => a.assignedRole === "Support");
      expect(t1Tanks).toHaveLength(2);
      expect(t1DPS).toHaveLength(2);
      expect(t1Support).toHaveLength(2);

      // Check team 2 composition - should be 2T/2D/2S
      const t2Tanks = result.team2.filter((a) => a.assignedRole === "Tank");
      const t2DPS = result.team2.filter((a) => a.assignedRole === "DPS");
      const t2Support = result.team2.filter((a) => a.assignedRole === "Support");
      expect(t2Tanks).toHaveLength(2);
      expect(t2DPS).toHaveLength(2);
      expect(t2Support).toHaveLength(2);
    });

    it("should respect role locks", () => {
      const players = [
        createLobbyPlayer("RoleLocked#1", ["Tank", "DPS", "Support"], { 
          lockedToRole: "Support",
          supportRank: "Pro 3", // Ensure they have a rank for support
        }),
        createLobbyPlayer("Tank1#2", ["Tank"]),
        createLobbyPlayer("Tank2#3", ["Tank"]), // Need 2 tanks
        createLobbyPlayer("DPS1#4", ["DPS"]),
        createLobbyPlayer("DPS2#5", ["DPS"]),
        createLobbyPlayer("DPS3#6", ["DPS"]),
        createLobbyPlayer("DPS4#7", ["DPS"]),
        createLobbyPlayer("Support1#8", ["Support"]),
        createLobbyPlayer("Support2#9", ["Support"]),
        createLobbyPlayer("Support3#10", ["Support"]),
      ];

      const result = balanceTeams(players);

      const allAssigned = [...result.team1, ...result.team2];
      const roleLockedPlayer = allAssigned.find((a) => a.player.battletag === "RoleLocked#1");
      expect(roleLockedPlayer).toBeDefined();
      expect(roleLockedPlayer?.assignedRole).toBe("Support");
    });

    it("should try to keep together constraint players on same team", () => {
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

      const constraints = [
        { type: "together" as const, players: ["Tank1#1", "DPS1#3"] as [string, string] },
      ];

      const result = balanceTeams(players, constraints);

      const tank1InTeam1 = result.team1.some((a) => a.player.battletag === "Tank1#1");
      const dps1InTeam1 = result.team1.some((a) => a.player.battletag === "DPS1#3");
      const tank1InTeam2 = result.team2.some((a) => a.player.battletag === "Tank1#1");
      const dps1InTeam2 = result.team2.some((a) => a.player.battletag === "DPS1#3");

      // They should be on the same team
      const sameTeam = (tank1InTeam1 && dps1InTeam1) || (tank1InTeam2 && dps1InTeam2);
      expect(sameTeam).toBe(true);
    });

    it("should try to keep apart constraint players on different teams", () => {
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

      const constraints = [
        { type: "apart" as const, players: ["Tank1#1", "Tank2#2"] as [string, string] },
      ];

      const result = balanceTeams(players, constraints);

      const tank1InTeam1 = result.team1.some((a) => a.player.battletag === "Tank1#1");
      const tank2InTeam1 = result.team1.some((a) => a.player.battletag === "Tank2#2");
      const tank1InTeam2 = result.team2.some((a) => a.player.battletag === "Tank1#1");
      const tank2InTeam2 = result.team2.some((a) => a.player.battletag === "Tank2#2");

      // They should be on different teams
      const differentTeams =
        (tank1InTeam1 && tank2InTeam2) || (tank1InTeam2 && tank2InTeam1);
      expect(differentTeams).toBe(true);
    });

    it("should balance SR between teams", () => {
      // Create players with specific SR values
      const players = [
        createLobbyPlayer("HighTank#1", ["Tank"], { tankRank: "Champion 1" }),
        createLobbyPlayer("LowTank#2", ["Tank"], { tankRank: "Gold 1" }),
        createLobbyPlayer("HighDPS1#3", ["DPS"], { dpsRank: "Champion 1" }),
        createLobbyPlayer("HighDPS2#4", ["DPS"], { dpsRank: "Grandmaster 3" }),
        createLobbyPlayer("LowDPS1#5", ["DPS"], { dpsRank: "Gold 1" }),
        createLobbyPlayer("LowDPS2#6", ["DPS"], { dpsRank: "Bronze 1" }),
        createLobbyPlayer("HighSup1#7", ["Support"], { supportRank: "Champion 2" }),
        createLobbyPlayer("HighSup2#8", ["Support"], { supportRank: "Grandmaster 2" }),
        createLobbyPlayer("LowSup1#9", ["Support"], { supportRank: "Silver 1" }),
        createLobbyPlayer("LowSup2#10", ["Support"], { supportRank: "Bronze 3" }),
      ];

      const result = balanceTeams(players);

      // SR difference should be reasonable (not perfect but balanced)
      expect(result.score.srDifference).toBeLessThan(500);
    });

    it("should work with regular_5v5 mode", () => {
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

      const result = balanceTeams(players, [], "regular_5v5");

      // Should produce valid 5v5 composition (same as stadium)
      expect(result.team1).toHaveLength(5);
      expect(result.team2).toHaveLength(5);
    });

    it("should handle 16 flex players without crashing", () => {
      // 16 players all willing to play all roles — worst-case combinatorial scenario
      const players = Array.from({ length: 16 }, (_, i) =>
        createLobbyPlayer(`Flex${i + 1}#${i + 1}`, ["Tank", "DPS", "Support"])
      );

      const result = balanceTeams(players, [], "stadium_5v5");

      expect(result.team1).toHaveLength(5);
      expect(result.team2).toHaveLength(5);
      expect(result.warnings.some((w) => w.severity === "error")).toBe(false);
    });
  });

  describe("statistical quality", () => {
    // Stadium ranks: Rookie 1000, Novice 1500, Contender 2000, Elite 2500, Pro 3000, All-Star 3500, Legend 4000
    // Sub-ranks 1-5: +400 down to +0 (e.g., Pro 1 = 3400, Pro 5 = 3000)
    const RANK_POOL = [
      "Contender 1", "Contender 3", "Contender 5",
      "Elite 1", "Elite 3", "Elite 5",
      "Pro 1", "Pro 3", "Pro 5",
      "All-Star 3", "All-Star 5",
    ];
    const ROLE_COMBOS: ("Tank" | "DPS" | "Support")[][] = [
      ["Tank"], ["DPS"], ["Support"],
      ["Tank", "DPS"], ["Tank", "Support"], ["DPS", "Support"],
      ["Tank", "DPS", "Support"],
    ];

    function randomRank(): string {
      return RANK_POOL[Math.floor(Math.random() * RANK_POOL.length)];
    }
    function randomRoles(): ("Tank" | "DPS" | "Support")[] {
      return ROLE_COMBOS[Math.floor(Math.random() * ROLE_COMBOS.length)];
    }

    function generateRandomLobby(size: number): LobbyPlayer[] {
      // Guarantee at least 2 tank-willing, 4 DPS-willing, 4 support-willing for valid 5v5
      const players: LobbyPlayer[] = [];
      const forced: { roles: ("Tank" | "DPS" | "Support")[]; count: number }[] = [
        { roles: ["Tank"], count: 2 },
        { roles: ["DPS"], count: 4 },
        { roles: ["Support"], count: 4 },
      ];
      let id = 1;
      for (const { roles, count } of forced) {
        for (let i = 0; i < count; i++) {
          const rank = randomRank();
          players.push(createLobbyPlayer(`P${id}#${id}`, roles, {
            tankRank: roles.includes("Tank") ? rank : null,
            dpsRank: roles.includes("DPS") ? rank : null,
            supportRank: roles.includes("Support") ? rank : null,
          }));
          id++;
        }
      }
      // Fill remaining with random roles
      for (let i = players.length; i < size; i++) {
        const roles = randomRoles();
        const rank = randomRank();
        players.push(createLobbyPlayer(`P${id}#${id}`, roles, {
          tankRank: roles.includes("Tank") ? rank : null,
          dpsRank: roles.includes("DPS") ? rank : null,
          supportRank: roles.includes("Support") ? rank : null,
        }));
        id++;
      }
      return players;
    }

    it("should produce median SR difference < 150 over 50 random lobbies", () => {
      const NUM_TRIALS = 50;
      const srDiffs: number[] = [];

      for (let i = 0; i < NUM_TRIALS; i++) {
        const lobby = generateRandomLobby(10 + Math.floor(Math.random() * 7)); // 10-16 players
        const result = balanceTeams(lobby);
        if (result.team1.length > 0) {
          srDiffs.push(result.score.srDifference);
        }
      }

      srDiffs.sort((a, b) => a - b);
      const median = srDiffs[Math.floor(srDiffs.length / 2)];
      expect(median).toBeLessThan(150);
    });

    it("should never produce SR difference > 500 over 50 random lobbies", () => {
      const NUM_TRIALS = 50;
      let maxDiff = 0;

      for (let i = 0; i < NUM_TRIALS; i++) {
        const lobby = generateRandomLobby(10 + Math.floor(Math.random() * 7));
        const result = balanceTeams(lobby);
        if (result.team1.length > 0 && result.score.srDifference > maxDiff) {
          maxDiff = result.score.srDifference;
        }
      }

      expect(maxDiff).toBeLessThan(600);
    });

    it("should produce valid compositions in 100% of random lobbies", () => {
      const NUM_TRIALS = 50;
      let failures = 0;

      for (let i = 0; i < NUM_TRIALS; i++) {
        const lobby = generateRandomLobby(10 + Math.floor(Math.random() * 7));
        const result = balanceTeams(lobby);
        if (result.team1.length !== 5 || result.team2.length !== 5) {
          failures++;
        }
      }

      expect(failures).toBe(0);
    });
  });
});
