import type { RoleAssignment, TeamScore, SoftConstraint, GameMode, Role } from "@engine/types";
import { getModeConfig } from "@engine/modeConfig";
import archetypesConfig from "@config/archetypes.json";

// =============================================================================
// Team Scoring Functions for PUGs Balancer
// =============================================================================

// Archetype data from config
const ARCHETYPES = archetypesConfig.archetypes as Record<string, string[]>;
const FLYERS = ARCHETYPES.flyer || [];
const HITSCANS = ARCHETYPES.hitscan || [];

/**
 * Calculate average SR for a team
 */
export function calculateTeamAverageSR(team: RoleAssignment[]): number {
  if (team.length === 0) return 0;
  const totalSR = team.reduce((sum, ra) => sum + ra.effectiveSR, 0);
  return Math.round(totalSR / team.length);
}

/**
 * Check if a team has a player who can play a specific archetype
 */
function teamHasArchetype(team: RoleAssignment[], archetypeHeroes: string[]): boolean {
  return team.some((ra) =>
    ra.player.heroPool.some((hero) => archetypeHeroes.includes(hero))
  );
}

/**
 * Check archetype parity between teams (flyer vs hitscan)
 */
export function checkArchetypeParity(
  team1: RoleAssignment[],
  team2: RoleAssignment[]
): { parityMet: boolean; violations: string[] } {
  const violations: string[] = [];

  const team1HasFlyer = teamHasArchetype(team1, FLYERS);
  const team2HasFlyer = teamHasArchetype(team2, FLYERS);
  const team1HasHitscan = teamHasArchetype(team1, HITSCANS);
  const team2HasHitscan = teamHasArchetype(team2, HITSCANS);

  // If team has flyer, opponent needs hitscan
  if (team1HasFlyer && !team2HasHitscan) {
    violations.push("Team 1 has flyer but Team 2 lacks hitscan");
  }
  if (team2HasFlyer && !team1HasHitscan) {
    violations.push("Team 2 has flyer but Team 1 lacks hitscan");
  }

  return {
    parityMet: violations.length === 0,
    violations,
  };
}

/**
 * Calculate role preference penalty for a team (raw metric).
 * Only penalizes 3rd-choice or worse roles (index >= 2).
 * 2nd-choice is acceptable in PUGs and not penalized.
 */
export function calculateRolePreferencePenalty(team: RoleAssignment[]): number {
  let penalty = 0;

  for (const ra of team) {
    const prefIndex = ra.player.rolePreference.indexOf(ra.assignedRole);
    if (prefIndex >= 2) {
      penalty += prefIndex;
    }
  }

  return penalty;
}

/**
 * Get the one-trick hero for a player in their assigned role
 * Returns null if they're not a one-trick for that role
 */
function getOneTrickHeroForRole(player: RoleAssignment["player"], role: "Tank" | "DPS" | "Support"): string | null {
  // Check role-specific one-trick first
  switch (role) {
    case "Tank":
      if (player.tankOneTrick) return player.tankOneTrick;
      break;
    case "DPS":
      if (player.dpsOneTrick) return player.dpsOneTrick;
      break;
    case "Support":
      if (player.supportOneTrick) return player.supportOneTrick;
      break;
  }
  
  // Fall back to legacy global one-trick (only if roles match)
  // This maintains backward compatibility for players without role-specific one-tricks
  if (player.isOneTrick && player.oneTrickHero) {
    return player.oneTrickHero;
  }
  
  return null;
}

/**
 * Count one-trick conflicts on a team
 * Two players one-tricking the same hero = conflict
 */
export function countOneTrickConflicts(team: RoleAssignment[]): number {
  const oneTrickHeroes: string[] = [];
  let conflicts = 0;

  for (const ra of team) {
    const oneTrickHero = getOneTrickHeroForRole(ra.player, ra.assignedRole);
    if (oneTrickHero) {
      if (oneTrickHeroes.includes(oneTrickHero)) {
        conflicts++;
      } else {
        oneTrickHeroes.push(oneTrickHero);
      }
    }
  }

  return conflicts;
}

/**
 * Get list of one-trick conflicts for warnings
 */
export function getOneTrickConflicts(team: RoleAssignment[], teamNum: 1 | 2): string[] {
  const heroToPlayers: Record<string, string[]> = {};

  for (const ra of team) {
    const hero = getOneTrickHeroForRole(ra.player, ra.assignedRole);
    if (hero) {
      if (!heroToPlayers[hero]) {
        heroToPlayers[hero] = [];
      }
      heroToPlayers[hero].push(ra.player.battletag.split("#")[0]);
    }
  }

  const conflicts: string[] = [];
  for (const [hero, players] of Object.entries(heroToPlayers)) {
    if (players.length > 1) {
      conflicts.push(`Team ${teamNum}: ${players.join(" & ")} both one-trick ${hero}`);
    }
  }

  return conflicts;
}

/**
 * Count soft constraint violations
 */
export function countSoftConstraintViolations(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  constraints: SoftConstraint[]
): number {
  let violations = 0;

  const team1Tags = new Set(team1.map((ra) => ra.player.battletag));
  const team2Tags = new Set(team2.map((ra) => ra.player.battletag));

  for (const constraint of constraints) {
    const [playerA, playerB] = constraint.players;
    const aInTeam1 = team1Tags.has(playerA);
    const aInTeam2 = team2Tags.has(playerA);
    const bInTeam1 = team1Tags.has(playerB);
    const bInTeam2 = team2Tags.has(playerB);

    // Both players must be in the game for constraint to apply
    const aPlaying = aInTeam1 || aInTeam2;
    const bPlaying = bInTeam1 || bInTeam2;
    if (!aPlaying || !bPlaying) continue;

    const sameTeam = (aInTeam1 && bInTeam1) || (aInTeam2 && bInTeam2);

    if (constraint.type === "together" && !sameTeam) {
      violations++;
    } else if (constraint.type === "apart" && sameTeam) {
      violations++;
    }
  }

  return violations;
}

/**
 * Get soft constraint violation messages for warnings
 */
export function getSoftConstraintViolations(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  constraints: SoftConstraint[]
): string[] {
  const violations: string[] = [];

  const team1Tags = new Set(team1.map((ra) => ra.player.battletag));
  const team2Tags = new Set(team2.map((ra) => ra.player.battletag));

  for (const constraint of constraints) {
    const [playerA, playerB] = constraint.players;
    const aInTeam1 = team1Tags.has(playerA);
    const aInTeam2 = team2Tags.has(playerA);
    const bInTeam1 = team1Tags.has(playerB);
    const bInTeam2 = team2Tags.has(playerB);

    const aPlaying = aInTeam1 || aInTeam2;
    const bPlaying = bInTeam1 || bInTeam2;
    if (!aPlaying || !bPlaying) continue;

    const sameTeam = (aInTeam1 && bInTeam1) || (aInTeam2 && bInTeam2);
    const nameA = playerA.split("#")[0];
    const nameB = playerB.split("#")[0];

    if (constraint.type === "together" && !sameTeam) {
      violations.push(`${nameA} and ${nameB} prefer to be together but are on different teams`);
    } else if (constraint.type === "apart" && sameTeam) {
      violations.push(`${nameA} and ${nameB} prefer to be apart but are on the same team`);
    }
  }

  return violations;
}

/**
 * Calculate standard deviation of SR values
 */
function calculateSRStdDev(team: RoleAssignment[]): number {
  if (team.length <= 1) return 0;
  const avg = team.reduce((sum, ra) => sum + ra.effectiveSR, 0) / team.length;
  const variance = team.reduce((sum, ra) => sum + (ra.effectiveSR - avg) ** 2, 0) / team.length;
  return Math.sqrt(variance);
}

/**
 * Calculate SR variance disparity between teams.
 * Teams should have similar internal skill spread.
 */
export function calculateVariancePenalty(
  team1: RoleAssignment[],
  team2: RoleAssignment[]
): number {
  const stdDev1 = calculateSRStdDev(team1);
  const stdDev2 = calculateSRStdDev(team2);
  return Math.abs(stdDev1 - stdDev2);
}

/**
 * Calculate per-role SR gap penalty.
 * Compares average SR for each role across teams (Tank vs Tank, DPS vs DPS, etc.).
 */
export function calculateRoleMatchupPenalty(
  team1: RoleAssignment[],
  team2: RoleAssignment[]
): number {
  const roles: Role[] = ["Tank", "DPS", "Support"];
  let totalGap = 0;

  for (const role of roles) {
    const t1Players = team1.filter((ra) => ra.assignedRole === role);
    const t2Players = team2.filter((ra) => ra.assignedRole === role);

    if (t1Players.length === 0 || t2Players.length === 0) continue;

    const t1Avg = t1Players.reduce((sum, ra) => sum + ra.effectiveSR, 0) / t1Players.length;
    const t2Avg = t2Players.reduce((sum, ra) => sum + ra.effectiveSR, 0) / t2Players.length;
    totalGap += Math.abs(t1Avg - t2Avg);
  }

  return totalGap;
}

/**
 * Calculate team score breakdown
 * 
 * @param team1 - First team's role assignments
 * @param team2 - Second team's role assignments
 * @param mode - Game mode (determines whether archetype parity is checked)
 */
export function calculateTeamScore(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  mode: GameMode = "stadium_5v5"
): TeamScore {
  const team1SR = calculateTeamAverageSR(team1);
  const team2SR = calculateTeamAverageSR(team2);
  
  // Only check archetype parity if mode requires it
  const modeConfig = getModeConfig(mode);
  const archetypeParityMet = modeConfig.checkArchetypes 
    ? checkArchetypeParity(team1, team2).parityMet 
    : true;

  return {
    team1SR,
    team2SR,
    srDifference: Math.abs(team1SR - team2SR),
    archetypeParityMet,
  };
}

/**
 * Score a team composition (lower is better).
 *
 * All metrics are soft-normalized to (0, 1) using x/(x+k) then multiplied by
 * importance weights. Unlike hard clipping (min(x/k,1)), this always provides
 * gradient — the optimizer can always distinguish worse from better, even in
 * extreme cases.
 *
 * Soft normalization half-points (value of k where output = 0.5):
 *   Role pref:      20    (all 10 players on 3rd-choice role; 2nd-choice not penalized)
 *   One-trick:      4     (2 conflicts per team)
 *   Archetype:      1     (binary)
 *   Soft constr:    5     (reasonable max constraints)
 *   Variance:       800   (large stdev disparity)
 *   Role matchup:   4000  (3 roles × ~1300 SR gap each)
 *
 * Importance weights (higher = more important):
 *   Role Matchup:   500
 *   One-Trick:      200   (Stadium only)
 *   Archetype:      150   (Stadium only)
 *   Soft Constr:    120
 *   Variance:       100
 *   Role Pref:       50
 */
export function scoreComposition(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  softConstraints: SoftConstraint[] = [],
  mode: GameMode = "stadium_5v5"
): number {
  let score = 0;
  const modeConfig = getModeConfig(mode);

  const teamScore = calculateTeamScore(team1, team2, mode);

  // 1. Role preference — soft-normalized (half-point at 20)
  const rawPref = calculateRolePreferencePenalty(team1) + calculateRolePreferencePenalty(team2);
  score += (rawPref / (rawPref + 20)) * 50;

  // 2. One-trick conflicts (Stadium only) — soft-normalized (half-point at 4)
  if (modeConfig.checkOneTricks) {
    const rawOTC = countOneTrickConflicts(team1) + countOneTrickConflicts(team2);
    score += (rawOTC / (rawOTC + 4)) * 200;
  }

  // 3. Archetype parity (Stadium only) — binary
  if (modeConfig.checkArchetypes && !teamScore.archetypeParityMet) {
    score += 150;
  }

  // 4. Soft constraints — soft-normalized (half-point at 5)
  const rawConstraints = countSoftConstraintViolations(team1, team2, softConstraints);
  score += (rawConstraints / (rawConstraints + 5)) * 120;

  // 5. SR variance disparity — soft-normalized (half-point at 800)
  const rawVariance = calculateVariancePenalty(team1, team2);
  score += (rawVariance / (rawVariance + 800)) * 100;

  // 6. Per-role SR matchup — soft-normalized (half-point at 4000)
  const rawMatchup = calculateRoleMatchupPenalty(team1, team2);
  score += (rawMatchup / (rawMatchup + 4000)) * 500;

  return score;
}
