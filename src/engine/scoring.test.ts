import { describe, it, expect } from "vitest";
import {
  calculateTeamAverageSR,
  checkArchetypeParity,
  calculateRolePreferencePenalty,
  countOneTrickConflicts,
  countSoftConstraintViolations,
  scoreComposition,
} from "@engine/scoring";
import type { RoleAssignment, LobbyPlayer, SoftConstraint } from "@engine/types";

// Helper to create test role assignments
function createRoleAssignment(
  battletag: string,
  role: "Tank" | "DPS" | "Support",
  effectiveSR: number,
  overrides: Partial<LobbyPlayer> = {}
): RoleAssignment {
  const player: LobbyPlayer = {
    battletag,
    tankRank: null,
    dpsRank: null,
    supportRank: null,
    tankCompRank: null,
    dpsCompRank: null,
    supportCompRank: null,
    rolesWilling: [role],
    rolePreference: [role],
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

  return { player, assignedRole: role, effectiveSR };
}

describe("scoring", () => {
  describe("calculateTeamAverageSR", () => {
    it("should calculate average SR correctly", () => {
      const team = [
        createRoleAssignment("P1#1", "Tank", 3000),
        createRoleAssignment("P2#2", "DPS", 3200),
        createRoleAssignment("P3#3", "DPS", 3100),
        createRoleAssignment("P4#4", "Support", 2900),
        createRoleAssignment("P5#5", "Support", 3000),
      ];

      expect(calculateTeamAverageSR(team)).toBe(3040);
    });

    it("should return 0 for empty team", () => {
      expect(calculateTeamAverageSR([])).toBe(0);
    });
  });

  describe("checkArchetypeParity", () => {
    it("should return parityMet when balanced", () => {
      const team1 = [
        createRoleAssignment("P1#1", "DPS", 3000, { heroPool: ["Pharah", "Echo"] }), // flyers
      ];
      const team2 = [
        createRoleAssignment("P2#2", "DPS", 3000, { heroPool: ["Widowmaker", "Ashe"] }), // hitscans
      ];

      const result = checkArchetypeParity(team1, team2);
      expect(result.parityMet).toBe(true);
    });

    it("should detect missing hitscan vs flyer", () => {
      const team1 = [
        createRoleAssignment("P1#1", "DPS", 3000, { heroPool: ["Pharah", "Echo"] }), // flyers
      ];
      const team2 = [
        createRoleAssignment("P2#2", "DPS", 3000, { heroPool: ["Junkrat", "Mei"] }), // no hitscan
      ];

      const result = checkArchetypeParity(team1, team2);
      expect(result.parityMet).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe("calculateRolePreferencePenalty", () => {
    it("should return 0 for preferred roles", () => {
      const team = [
        createRoleAssignment("P1#1", "Tank", 3000, { 
          rolePreference: ["Tank", "DPS", "Support"] 
        }),
      ];

      expect(calculateRolePreferencePenalty(team)).toBe(0);
    });

    it("should not penalize second-choice role", () => {
      const team = [
        createRoleAssignment("P1#1", "DPS", 3000, { 
          rolesWilling: ["Tank", "DPS"],
          rolePreference: ["Tank", "DPS"] // Prefers Tank, assigned DPS (2nd choice)
        }),
      ];

      // DPS is index 1 (2nd choice) — not penalized
      expect(calculateRolePreferencePenalty(team)).toBe(0);
    });

    it("should penalize third-choice role", () => {
      const team = [
        createRoleAssignment("P1#1", "Support", 3000, { 
          rolesWilling: ["Tank", "DPS", "Support"],
          rolePreference: ["Tank", "DPS", "Support"] // Assigned 3rd choice
        }),
      ];

      // Support is index 2 (3rd choice) — penalized: raw = 2
      expect(calculateRolePreferencePenalty(team)).toBe(2);
    });

  });

  describe("countOneTrickConflicts", () => {
    it("should return 0 for no conflicts", () => {
      const team = [
        createRoleAssignment("P1#1", "DPS", 3000, { isOneTrick: true, oneTrickHero: "Tracer" }),
        createRoleAssignment("P2#2", "DPS", 3000, { isOneTrick: true, oneTrickHero: "Genji" }),
      ];

      expect(countOneTrickConflicts(team)).toBe(0);
    });

    it("should count duplicate one-tricks", () => {
      const team = [
        createRoleAssignment("P1#1", "DPS", 3000, { isOneTrick: true, oneTrickHero: "Tracer" }),
        createRoleAssignment("P2#2", "DPS", 3000, { isOneTrick: true, oneTrickHero: "Tracer" }),
      ];

      expect(countOneTrickConflicts(team)).toBe(1);
    });
  });

  describe("countSoftConstraintViolations", () => {
    const team1 = [
      createRoleAssignment("Alpha#1", "Tank", 3000),
      createRoleAssignment("Beta#2", "DPS", 3000),
    ];
    const team2 = [
      createRoleAssignment("Gamma#3", "Tank", 3000),
      createRoleAssignment("Delta#4", "DPS", 3000),
    ];

    it("should return 0 when together constraint is satisfied", () => {
      const constraints: SoftConstraint[] = [
        { type: "together", players: ["Alpha#1", "Beta#2"] },
      ];

      expect(countSoftConstraintViolations(team1, team2, constraints)).toBe(0);
    });

    it("should count violated together constraint", () => {
      const constraints: SoftConstraint[] = [
        { type: "together", players: ["Alpha#1", "Gamma#3"] },
      ];

      expect(countSoftConstraintViolations(team1, team2, constraints)).toBe(1);
    });

    it("should return 0 when apart constraint is satisfied", () => {
      const constraints: SoftConstraint[] = [
        { type: "apart", players: ["Alpha#1", "Gamma#3"] },
      ];

      expect(countSoftConstraintViolations(team1, team2, constraints)).toBe(0);
    });

    it("should count violated apart constraint", () => {
      const constraints: SoftConstraint[] = [
        { type: "apart", players: ["Alpha#1", "Beta#2"] },
      ];

      expect(countSoftConstraintViolations(team1, team2, constraints)).toBe(1);
    });

    it("should ignore constraints for players not in game", () => {
      const constraints: SoftConstraint[] = [
        { type: "together", players: ["Alpha#1", "NotPlaying#99"] },
      ];

      expect(countSoftConstraintViolations(team1, team2, constraints)).toBe(0);
    });
  });

  describe("scoreComposition", () => {
    it("should calculate composite score", () => {
      const team1 = [
        createRoleAssignment("P1#1", "Tank", 3200),
        createRoleAssignment("P2#2", "DPS", 3200),
        createRoleAssignment("P3#3", "DPS", 3200),
        createRoleAssignment("P4#4", "Support", 3200),
        createRoleAssignment("P5#5", "Support", 3200),
      ];
      const team2 = [
        createRoleAssignment("P6#6", "Tank", 3100),
        createRoleAssignment("P7#7", "DPS", 3100),
        createRoleAssignment("P8#8", "DPS", 3100),
        createRoleAssignment("P9#9", "Support", 3100),
        createRoleAssignment("P10#10", "Support", 3100),
      ];

      const score = scoreComposition(team1, team2);

      // Role matchup: Tank 100 + DPS 100 + Support 100 = 300, soft-normalized: 300/(300+4000) × 500 ≈ 34.88
      // All other factors = 0
      // Total ≈ 34.88
      expect(score).toBeCloseTo(34.88, 1);
    });

    it("should add penalties for constraints and conflicts", () => {
      const team1 = [
        createRoleAssignment("P1#1", "DPS", 3000, { isOneTrick: true, oneTrickHero: "Tracer" }),
        createRoleAssignment("P2#2", "DPS", 3000, { isOneTrick: true, oneTrickHero: "Tracer" }),
      ];
      const team2 = [createRoleAssignment("P3#3", "DPS", 3000)];

      const score = scoreComposition(team1, team2);

      // 1 one-trick conflict: 1/(1+4) × 200 = 40
      expect(score).toBeGreaterThanOrEqual(40);
    });
  });
});
