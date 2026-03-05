import type { RoleAssignment, TeamScore, SoftConstraint } from "@engine/types";
import archetypesConfig from "@config/archetypes.json";

// =============================================================================
// Team Scoring Functions for Stadium PUGs Balancer
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
 * Calculate role preference penalty for a team
 * Players assigned to non-preferred roles get penalized
 */
export function calculateRolePreferencePenalty(team: RoleAssignment[]): number {
  let penalty = 0;

  for (const ra of team) {
    const prefIndex = ra.player.rolePreference.indexOf(ra.assignedRole);
    if (prefIndex === -1) {
      // Role not in preference list at all - high penalty
      penalty += 100;
    } else if (prefIndex > 0) {
      // Playing non-first-choice role - scaled penalty
      penalty += prefIndex * 50;
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
 * Calculate loss streak penalty for team composition
 * We want players on loss streaks to be placed on the higher-SR team.
 * If a player with losses is on the lower-SR team, add penalty.
 */
export function calculateLossStreakPenalty(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  lossStreaks: Map<string, number>
): number {
  const team1SR = calculateTeamAverageSR(team1);
  const team2SR = calculateTeamAverageSR(team2);

  // Determine which team is "weaker"
  const lowerSRTeam = team1SR >= team2SR ? team2 : team1;

  let penalty = 0;

  // Penalty for loss-streak players NOT on higher-SR team
  for (const ra of lowerSRTeam) {
    const losses = lossStreaks.get(ra.player.battletag) || 0;
    if (losses > 0) {
      // Each loss streak level adds 75 penalty for being on the weaker team
      penalty += losses * 75;
    }
  }

  return penalty;
}

/**
 * Calculate team score breakdown
 */
export function calculateTeamScore(
  team1: RoleAssignment[],
  team2: RoleAssignment[]
): TeamScore {
  const team1SR = calculateTeamAverageSR(team1);
  const team2SR = calculateTeamAverageSR(team2);
  const { parityMet } = checkArchetypeParity(team1, team2);

  return {
    team1SR,
    team2SR,
    srDifference: Math.abs(team1SR - team2SR),
    archetypeParityMet: parityMet,
  };
}

/**
 * Score a team composition (lower is better)
 *
 * Scoring weights (from design doc):
 * - SR Balance: weight 1.0 (primary)
 * - Role preference: weight 50 per non-preferred role level
 * - One-trick conflicts: weight 500 per conflict
 * - Archetype parity: weight 200 if violated
 * - Soft constraints: weight 100 per violation
 * - Loss streak: weight 75 per loss level (penalty for losers on weaker team)
 */
export function scoreComposition(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  softConstraints: SoftConstraint[] = [],
  lossStreaks: Map<string, number> = new Map()
): number {
  let score = 0;

  // 1. SR Balance (primary) — weight: 1.0
  const teamScore = calculateTeamScore(team1, team2);
  score += teamScore.srDifference * 1.0;

  // 2. Role preference penalty — weight: 50 per preference level
  score += calculateRolePreferencePenalty(team1);
  score += calculateRolePreferencePenalty(team2);

  // 3. One-trick conflicts — weight: 500 per conflict
  score += countOneTrickConflicts(team1) * 500;
  score += countOneTrickConflicts(team2) * 500;

  // 4. Archetype parity — weight: 200 if violated
  if (!teamScore.archetypeParityMet) {
    score += 200;
  }

  // 5. Soft constraints — weight: 100 per violation
  score += countSoftConstraintViolations(team1, team2, softConstraints) * 100;

  // 6. Loss streak — weight: 75 per loss level for losers on weaker team
  score += calculateLossStreakPenalty(team1, team2, lossStreaks);

  return score;
}
