import { describe, it, expect } from "vitest";
import { rankToSR, competitiveRankToSR, getRoleRankSR, getEffectiveSR } from "@utils/rankMapper";
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
    it("should convert competitive ranks", () => {
      expect(competitiveRankToSR("Diamond 3")).toBe(3200);
      expect(competitiveRankToSR("Master 1")).toBe(3900);
      expect(competitiveRankToSR("Gold 5")).toBe(2000);
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

      expect(getRoleRankSR(player, "Support")).toBe(3300);
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
