import { describe, it, expect } from "vitest";
import {
  rankToSR,
  competitiveRankToSR,
  srToCompetitiveRank,
  getRoleRankSR,
  getRoleRankDisplay,
  getEffectiveSR,
} from "@utils/rankMapper";
import type { LobbyPlayer } from "@engine/types";

describe("rankMapper", () => {
  describe("rankToSR", () => {
    it("should convert Stadium rank with sub-rank", () => {
      expect(rankToSR("Pro 1")).toBe(3400);
      expect(rankToSR("Pro 2")).toBe(3300);
      expect(rankToSR("Pro 3")).toBe(3200);
      expect(rankToSR("Pro 4")).toBe(3100);
      expect(rankToSR("Pro 5")).toBe(3000);
    });

    it("should default to sub-rank 3 when not specified", () => {
      expect(rankToSR("Pro")).toBe(3200);
      expect(rankToSR("Elite")).toBe(2700);
    });

    it("should handle all Stadium rank tiers", () => {
      expect(rankToSR("Rookie 3")).toBe(1200);
      expect(rankToSR("Novice 3")).toBe(1700);
      expect(rankToSR("Contender 3")).toBe(2200);
      expect(rankToSR("Elite 3")).toBe(2700);
      expect(rankToSR("Pro 3")).toBe(3200);
      expect(rankToSR("All-Star 3")).toBe(3700);
      expect(rankToSR("Legend 3")).toBe(4200);
    });

    it("should throw for unknown rank tier", () => {
      expect(() => rankToSR("Diamond 3")).toThrow("Unknown Stadium rank tier");
    });

    it("should throw for invalid format", () => {
      expect(() => rankToSR("")).toThrow("Invalid rank format");
    });
  });

  describe("competitiveRankToSR", () => {
    it("should convert competitive ranks including Emerald between Platinum and Diamond", () => {
      expect(competitiveRankToSR("Gold 5")).toBe(2000);
      expect(competitiveRankToSR("Platinum 1")).toBe(2900);
      expect(competitiveRankToSR("Emerald 5")).toBe(3000);
      expect(competitiveRankToSR("Emerald 3")).toBe(3200);
      expect(competitiveRankToSR("Emerald 1")).toBe(3400);
      expect(competitiveRankToSR("Diamond 5")).toBe(3500);
      expect(competitiveRankToSR("Diamond 3")).toBe(3700);
      expect(competitiveRankToSR("Master 1")).toBe(4400);
      expect(competitiveRankToSR("Champion 1")).toBe(5400);
    });

    it("should round-trip SR values cleanly across Platinum, Emerald, Diamond, and Champion", () => {
      expect(srToCompetitiveRank(2900)).toBe("Platinum 1");
      expect(srToCompetitiveRank(3000)).toBe("Emerald 5");
      expect(srToCompetitiveRank(3200)).toBe("Emerald 3");
      expect(srToCompetitiveRank(3400)).toBe("Emerald 1");
      expect(srToCompetitiveRank(3500)).toBe("Diamond 5");
      expect(srToCompetitiveRank(5400)).toBe("Champion 1");
    });

    it("should throw for stadium ranks", () => {
      expect(() => competitiveRankToSR("Pro 3")).toThrow("Unknown competitive rank tier");
    });
  });

  describe("getRoleRankSR", () => {
    it("should return role-specific rank SR", () => {
      const player = {
        tankRank: "Pro 1",
        dpsRank: "Elite 3",
        supportRank: null,
        regularCompRank: "Diamond 2",
      };

      expect(getRoleRankSR(player, "Tank")).toBe(3400);
      expect(getRoleRankSR(player, "DPS")).toBe(2700);
    });

    it("should fallback to regular comp rank", () => {
      const player = {
        tankRank: null,
        dpsRank: null,
        supportRank: null,
        regularCompRank: "Diamond 2",
      };

      expect(getRoleRankSR(player, "Support")).toBe(3800);
    });

    it("should resolve separate Stadium, 5v5, and 6v6 rankings by game mode", () => {
      const player = {
        tankRank: "Pro 3",
        dpsRank: null,
        supportRank: null,
        tankCompRank: "Emerald 3",
        dpsCompRank: null,
        supportCompRank: null,
        tank6v6Rank: "Master 3",
        dps6v6Rank: null,
        support6v6Rank: null,
        regularCompRank: "Gold 3",
        regular6v6Rank: "Diamond 3",
      };

      expect(getRoleRankSR(player, "Tank", "stadium_5v5")).toBe(3200);
      expect(getRoleRankDisplay(player, "Tank", "stadium_5v5")).toBe("Pro 3");

      expect(getRoleRankSR(player, "Tank", "regular_5v5")).toBe(3200);
      expect(getRoleRankDisplay(player, "Tank", "regular_5v5")).toBe("Emerald 3");

      expect(getRoleRankSR(player, "Tank", "regular_6v6")).toBe(3700);
      expect(getRoleRankDisplay(player, "Tank", "regular_6v6")).toBe("Diamond 3");

      expect(getRoleRankSR(player, "DPS", "regular_6v6")).toBe(3700);
      expect(getRoleRankDisplay(player, "DPS", "regular_6v6")).toBe("Diamond 3");

      expect(getRoleRankSR(player, "Support", "regular_6v6")).toBe(3700);
      expect(getRoleRankDisplay(player, "Support", "regular_6v6")).toBe("Diamond 3");
    });

    it("should share legacy 6v6 rank across all roles when regular6v6Rank is absent", () => {
      const player = {
        tankRank: null,
        dpsRank: null,
        supportRank: null,
        tank6v6Rank: "Master 3",
        dps6v6Rank: null,
        support6v6Rank: null,
        regularCompRank: "Gold 3",
        regular6v6Rank: null,
      };

      expect(getRoleRankSR(player, "Tank", "regular_6v6")).toBe(4200);
      expect(getRoleRankSR(player, "DPS", "regular_6v6")).toBe(4200);
      expect(getRoleRankSR(player, "Support", "regular_6v6")).toBe(4200);
      expect(getRoleRankDisplay(player, "DPS", "regular_6v6")).toBe("Master 3");
    });

    it("should fallback cleanly to 5v5 comp rank in 6v6 mode if no 6v6 rank is set", () => {
      const player = {
        tankRank: "Pro 1",
        dpsRank: null,
        supportRank: null,
        tankCompRank: "Emerald 1",
        regularCompRank: null,
      };

      expect(getRoleRankSR(player, "Tank", "regular_6v6")).toBe(3400);
      expect(getRoleRankDisplay(player, "Tank", "regular_6v6")).toBe("Emerald 1");
    });

    it("should return null if no rank available", () => {
      const player = {
        tankRank: null,
        dpsRank: null,
        supportRank: null,
        regularCompRank: null,
      };

      expect(getRoleRankSR(player, "Tank")).toBeNull();
    });
  });

  describe("getEffectiveSR", () => {
    const baseLobbyPlayer: LobbyPlayer = {
      battletag: "Test#1234",
      tankRank: "Pro 3",
      dpsRank: null,
      supportRank: null,
      tankCompRank: null,
      dpsCompRank: null,
      supportCompRank: null,
      rolesWilling: ["Tank"],
      rolePreference: ["Tank"],
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
    };

    it("should return base SR with no modifiers", () => {
      expect(getEffectiveSR(baseLobbyPlayer, "Tank")).toBe(3200);
    });

    it("should apply weight modifier", () => {
      const player = { ...baseLobbyPlayer, weightModifier: 100 };
      expect(getEffectiveSR(player, "Tank")).toBe(3300);
    });

    it("should apply negative weight modifier", () => {
      const player = { ...baseLobbyPlayer, weightModifier: -100 };
      expect(getEffectiveSR(player, "Tank")).toBe(3100);
    });

    it("should prefer temp override over weight modifier", () => {
      const player = { ...baseLobbyPlayer, weightModifier: 100, tempWeightOverride: -50 };
      expect(getEffectiveSR(player, "Tank")).toBe(3150);
    });

    it("should use default SR when no rank available", () => {
      const player = { ...baseLobbyPlayer, tankRank: null };
      expect(getEffectiveSR(player, "Tank")).toBe(2500); // default SR
    });
  });
});
