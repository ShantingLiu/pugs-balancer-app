import type {
  LobbyPlayer,
  Role,
  RoleAssignment,
  TeamAssignment,
  Warning,
  SoftConstraint,
} from "@engine/types";
import { getEffectiveSR } from "@utils/rankMapper";
import {
  scoreComposition,
  calculateTeamScore,
  checkArchetypeParity,
  getOneTrickConflicts,
  getSoftConstraintViolations,
} from "@engine/scoring";

// =============================================================================
// Core Balancer Algorithm for Stadium PUGs Balancer
// =============================================================================

/**
 * Team composition requirements: 1 Tank, 2 DPS, 2 Support per team
 */
const TEAM_COMPOSITION: { role: Role; count: number }[] = [
  { role: "Tank", count: 1 },
  { role: "DPS", count: 2 },
  { role: "Support", count: 2 },
];

const MAX_CANDIDATES = 1000;

/**
 * Shuffle array in place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Group players by which roles they're willing to play
 */
export function groupPlayersByRole(
  players: LobbyPlayer[]
): Record<Role, LobbyPlayer[]> {
  const groups: Record<Role, LobbyPlayer[]> = {
    Tank: [],
    DPS: [],
    Support: [],
  };

  for (const player of players) {
    for (const role of player.rolesWilling) {
      groups[role].push(player);
    }
  }

  return groups;
}

/**
 * Check if a valid team composition is possible with given players
 */
export function canFormValidTeams(players: LobbyPlayer[]): {
  valid: boolean;
  missingRoles: { role: Role; have: number; need: number }[];
} {
  const groups = groupPlayersByRole(players);
  const missingRoles: { role: Role; have: number; need: number }[] = [];

  for (const { role, count } of TEAM_COMPOSITION) {
    const needed = count * 2; // For both teams
    const available = groups[role].length;
    if (available < needed) {
      missingRoles.push({ role, have: available, need: needed });
    }
  }

  return {
    valid: missingRoles.length === 0,
    missingRoles,
  };
}

/**
 * Represents a partial or complete team assignment during generation
 */
interface PartialAssignment {
  team1: RoleAssignment[];
  team2: RoleAssignment[];
  usedPlayers: Set<string>; // battletags
}

/**
 * Create a role assignment for a player
 */
function createRoleAssignment(
  player: LobbyPlayer,
  role: Role
): RoleAssignment {
  return {
    player,
    assignedRole: role,
    effectiveSR: getEffectiveSR(player, role),
  };
}

/**
 * Get the next unfilled slot in a partial assignment
 * Returns null if complete
 */
function getNextSlot(
  partial: PartialAssignment
): { team: 1 | 2; role: Role } | null {
  // Fill team 1 first, then team 2
  for (const teamNum of [1, 2] as const) {
    const team = teamNum === 1 ? partial.team1 : partial.team2;

    for (const { role, count } of TEAM_COMPOSITION) {
      const filled = team.filter((ra) => ra.assignedRole === role).length;
      if (filled < count) {
        return { team: teamNum, role };
      }
    }
  }

  return null; // Complete
}

/**
 * Get eligible players for a slot
 * @param relaxConstraints - If true, ignore team/role locks during eligibility
 */
function getEligiblePlayers(
  partial: PartialAssignment,
  role: Role,
  teamNum: 1 | 2,
  allPlayers: LobbyPlayer[],
  debugRoleLocked: LobbyPlayer[] = [],
  relaxConstraints: boolean = false
): LobbyPlayer[] {
  return allPlayers.filter((player) => {
    // Not already used
    if (partial.usedPlayers.has(player.battletag)) return false;

    // Willing to play this role - always required
    if (!player.rolesWilling.includes(role)) {
      // Debug: log if a role-locked player is rejected for not being willing
      if (debugRoleLocked.some((p) => p.battletag === player.battletag && p.lockedToRole === role)) {
        console.warn(`${player.battletag} is role-locked to ${role} but NOT willing to play ${role}!`);
      }
      return false;
    }

    // In relaxed mode, ignore locks - they become soft preferences
    if (relaxConstraints) {
      return true;
    }

    // Respect team locks
    if (player.lockedToTeam !== null && player.lockedToTeam !== teamNum) {
      return false;
    }

    // Respect role locks - if player is locked to a different role, skip
    if (player.lockedToRole !== null && player.lockedToRole !== role) {
      return false;
    }

    return true;
  });
}

/**
 * Generate candidate team compositions using backtracking
 * Includes randomization for variety on each call
 * @param relaxConstraints - If true, treat locks/must-play as soft preferences rather than hard requirements
 */
function generateCandidates(
  players: LobbyPlayer[],
  maxCandidates: number = MAX_CANDIDATES,
  relaxConstraints: boolean = false
): PartialAssignment[] {
  const candidates: PartialAssignment[] = [];
  let iterations = 0;
  const MAX_ITERATIONS = 100000; // Safety limit

  // Must-play players need to be verified at the end (unless relaxed)
  const mustPlayPlayers = relaxConstraints ? [] : players.filter((p) => p.mustPlay);
  
  // Locked players must be on their correct team (unless relaxed)
  const lockedPlayers = relaxConstraints ? [] : players.filter((p) => p.lockedToTeam !== null);
  
  // Role-locked players for verification (unless relaxed)
  const roleLockedPlayers = relaxConstraints ? [] : players.filter((p) => p.lockedToRole !== null);
  if (!relaxConstraints) {
    console.log("Role-locked players in generateCandidates:", roleLockedPlayers.map((p) => `${p.battletag} -> ${p.lockedToRole}`));
  }
  
  // Shuffle players for different generation order each call
  const shuffledPlayers = shuffleArray(players);

  // Start with empty assignment
  const initial: PartialAssignment = {
    team1: [],
    team2: [],
    usedPlayers: new Set(),
  };

  // Recursive backtracking
  function backtrack(partial: PartialAssignment): void {
    iterations++;
    if (iterations > MAX_ITERATIONS) return;
    if (candidates.length >= maxCandidates) return;

    const nextSlot = getNextSlot(partial);

    // Complete assignment
    if (nextSlot === null) {
      // Verify must-play players are all included
      const allUsed = [...partial.team1, ...partial.team2].map(
        (ra) => ra.player.battletag
      );
      const mustPlayIncluded = mustPlayPlayers.every((p) =>
        allUsed.includes(p.battletag)
      );

      // Verify locked players are on their correct teams
      const team1Battletags = new Set(partial.team1.map((ra) => ra.player.battletag));
      const team2Battletags = new Set(partial.team2.map((ra) => ra.player.battletag));
      const locksRespected = lockedPlayers.every((p) => {
        if (p.lockedToTeam === 1) return team1Battletags.has(p.battletag);
        if (p.lockedToTeam === 2) return team2Battletags.has(p.battletag);
        return true;
      });

      // Verify role-locked players are in their correct role
      const allAssignments = [...partial.team1, ...partial.team2];
      const roleLocksRespected = roleLockedPlayers.every((p) => {
        const assignment = allAssignments.find((a) => a.player.battletag === p.battletag);
        if (!assignment) return true; // Player not in this composition
        return assignment.assignedRole === p.lockedToRole;
      });

      if (mustPlayIncluded && locksRespected && roleLocksRespected) {
        candidates.push({
          team1: [...partial.team1],
          team2: [...partial.team2],
          usedPlayers: new Set(partial.usedPlayers),
        });
      }
      return;
    }

    const { team, role } = nextSlot;
    const eligible = getEligiblePlayers(partial, role, team, shuffledPlayers, [], relaxConstraints);

    // Prioritize: team-locked (for this team) > role-locked > must-play > others
    // Team-locked players MUST be included in their team, so put them first
    const teamLockedEligible = eligible.filter((p) => p.lockedToTeam === team);
    const roleLockedEligible = eligible.filter((p) => p.lockedToRole === role && p.lockedToTeam !== team);
    const mustPlayEligible = eligible.filter((p) => p.mustPlay && p.lockedToRole !== role && p.lockedToTeam !== team);
    const nonPriority = eligible.filter((p) => !p.mustPlay && p.lockedToRole !== role && p.lockedToTeam !== team);
    
    // Shuffle non-priority players to get different results each run
    const shuffledNonPriority = shuffleArray(nonPriority);
    
    // Sort must-play by priority (2=sat out > 1=joined mid-match), then sat-out streak, then role preference
    const sortedMustPlay = [...mustPlayEligible].sort((a, b) => {
      // Higher priority = should play first
      const priorityDiff = b.mustPlayPriority - a.mustPlayPriority;
      if (priorityDiff !== 0) return priorityDiff;
      // Higher sat-out streak = higher priority
      const streakDiff = b.consecutiveSatOut - a.consecutiveSatOut;
      if (streakDiff !== 0) return streakDiff;
      // If same streak, prefer players whose first choice is this role
      const aPrefers = a.rolePreference[0] === role ? -1 : 0;
      const bPrefers = b.rolePreference[0] === role ? -1 : 0;
      return aPrefers - bPrefers;
    });
    
    // Team-locked first, then role-locked, then must-play, then others
    const sortedEligible = [...teamLockedEligible, ...roleLockedEligible, ...sortedMustPlay, ...shuffledNonPriority];

    for (const player of sortedEligible) {
      const assignment = createRoleAssignment(player, role);

      // Make assignment
      const newPartial: PartialAssignment = {
        team1:
          team === 1 ? [...partial.team1, assignment] : [...partial.team1],
        team2:
          team === 2 ? [...partial.team2, assignment] : [...partial.team2],
        usedPlayers: new Set([...partial.usedPlayers, player.battletag]),
      };

      backtrack(newPartial);

      if (candidates.length >= maxCandidates) return;
    }
  }

  backtrack(initial);
  console.log("Backtracking complete. Iterations:", iterations, "Candidates:", candidates.length);
  return candidates;
}

/**
 * Main balancing function
 *
 * @param lobby - Players available for balancing (excluding AFK)
 * @param softConstraints - Optional soft constraints (together/apart)
 * @returns TeamAssignment with best balanced teams, or null if impossible
 */
export function balanceTeams(
  lobby: LobbyPlayer[],
  softConstraints: SoftConstraint[] = []
): TeamAssignment {
  console.log("balanceTeams called with", lobby.length, "players");
  const warnings: Warning[] = [];

  // Filter out AFK players
  const activePlayers = lobby.filter((p) => !p.isAfk);
  console.log("Active players:", activePlayers.length);

  // Log locked players
  const lockedPlayers = activePlayers.filter((p) => p.lockedToTeam !== null);
  console.log("Locked players in balancer:", lockedPlayers.map((p) => `${p.battletag} -> Team ${p.lockedToTeam}`));

  // Build loss streaks map from lobby players
  const lossStreaks = new Map<string, number>();
  for (const player of activePlayers) {
    if (player.consecutiveLosses > 0) {
      lossStreaks.set(player.battletag, player.consecutiveLosses);
    }
  }

  // Validate minimum players
  if (activePlayers.length < 10) {
    warnings.push({
      type: "insufficient_players",
      message: `Need at least 10 active players, have ${activePlayers.length}`,
      severity: "error",
    });

    // Return empty result
    return {
      team1: [],
      team2: [],
      warnings,
      score: { team1SR: 0, team2SR: 0, srDifference: 0, archetypeParityMet: false },
    };
  }

  // Check role coverage
  const { valid: canForm, missingRoles } = canFormValidTeams(activePlayers);
  if (!canForm) {
    for (const { role, have, need } of missingRoles) {
      warnings.push({
        type: "impossible_composition",
        message: `Not enough ${role} players: have ${have}, need ${need}`,
        severity: "error",
      });
    }
  }

  // Handle too many must-play players - prioritize those who sat out longest
  let mustPlayPlayers = activePlayers.filter((p) => p.mustPlay);
  const originalMustPlayCount = mustPlayPlayers.length;
  const hadMustPlayOverflow = mustPlayPlayers.length > 10;
  
  if (hadMustPlayOverflow) {
    // Sort by priority first (sat-out waiting > joined mid-match), then by sat-out streak
    const sortedByPriority = [...mustPlayPlayers].sort((a, b) => {
      const priorityDiff = b.mustPlayPriority - a.mustPlayPriority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.consecutiveSatOut - a.consecutiveSatOut;
    });
    const keepMustPlay = new Set(sortedByPriority.slice(0, 10).map((p) => p.battletag));
    
    // Update players - clear must-play for those not selected
    for (const player of activePlayers) {
      if (player.mustPlay && !keepMustPlay.has(player.battletag)) {
        player.mustPlay = false;
      }
    }
    // Update our local reference
    mustPlayPlayers = activePlayers.filter((p) => p.mustPlay);
  }

  // Get locked players (they must be included even if not must-play)
  const lockedPlayerBattletags = new Set(
    activePlayers.filter((p) => p.lockedToTeam !== null || p.lockedToRole !== null)
      .map((p) => p.battletag)
  );

  // HARD RULE: Players who sat out MUST play before players who didn't
  // Build the player pool strictly prioritizing must-play players
  let playerPool: LobbyPlayer[];
  
  // Priority players = must-play + locked (locked players may have just played but have explicit locks)
  const mustPlayAndLocked = activePlayers.filter(
    (p) => p.mustPlay || lockedPlayerBattletags.has(p.battletag)
  );
  
  // If we have at least 10 priority players with valid role coverage, use ONLY them
  if (mustPlayAndLocked.length >= 10) {
    const { valid: canFormPriority } = canFormValidTeams(mustPlayAndLocked);
    if (canFormPriority) {
      playerPool = mustPlayAndLocked;
      console.log("Using ONLY must-play + locked players:", playerPool.length);
    } else {
      // Need to supplement with non-must-play players for role coverage
      // Add the minimum number of non-must-play players needed for each missing role
      const groups = groupPlayersByRole(mustPlayAndLocked);
      const supplementPlayers: LobbyPlayer[] = [];
      
      for (const { role, count } of [{ role: "Tank" as Role, count: 2 }, { role: "DPS" as Role, count: 4 }, { role: "Support" as Role, count: 4 }]) {
        const have = groups[role].length;
        if (have < count) {
          const needed = count - have;
          // Find non-must-play players willing to play this role
          const available = activePlayers.filter(
            (p) => !p.mustPlay && 
                   !lockedPlayerBattletags.has(p.battletag) && 
                   p.rolesWilling.includes(role) &&
                   !supplementPlayers.includes(p)
          );
          supplementPlayers.push(...available.slice(0, needed));
        }
      }
      
      playerPool = [...mustPlayAndLocked, ...supplementPlayers];
      console.log("Using must-play + locked + supplements:", playerPool.length, "supplements:", supplementPlayers.length);
    }
  } else {
    // Not enough must-play players - use all but warn
    playerPool = activePlayers;
    console.log("Not enough must-play players, using full pool:", playerPool.length);
  }
  
  let candidates: PartialAssignment[] = [];
  let constraintsRelaxed = false;

  // Generate candidates from the selected player pool
  console.log("Generating candidates from player pool of", playerPool.length);
  candidates = generateCandidates(playerPool, MAX_CANDIDATES, false);
  console.log("Generated", candidates.length, "candidates");

  // If no candidates with strict constraints, retry with relaxed constraints
  if (candidates.length === 0) {
    console.log("No candidates with strict constraints, retrying with relaxed constraints...");
    candidates = generateCandidates(playerPool, MAX_CANDIDATES, true);
    console.log("Generated", candidates.length, "candidates with relaxed constraints");
    constraintsRelaxed = true;
  }
  
  // Last resort: use all players if player pool failed
  if (candidates.length === 0 && playerPool !== activePlayers) {
    console.log("Player pool failed, falling back to all players...");
    candidates = generateCandidates(activePlayers, MAX_CANDIDATES, true);
    console.log("Generated", candidates.length, "candidates from all players");
    constraintsRelaxed = true;
  }

  if (candidates.length === 0) {
    // Still no candidates - this shouldn't happen with 10+ players
    warnings.push({
      type: "impossible_composition",
      message: "Could not generate any valid team compositions - check role coverage",
      severity: "error",
    });

    return {
      team1: [],
      team2: [],
      warnings,
      score: { team1SR: 0, team2SR: 0, srDifference: 0, archetypeParityMet: false },
    };
  }

  // Get all must-play player battletags for penalty calculation
  const mustPlayBattletags = new Set(mustPlayPlayers.map((p) => p.battletag));

  // Helper to calculate must-play exclusion penalty
  // Heavy penalty (1000 per player) for excluding must-play players
  const calculateMustPlayPenalty = (candidate: PartialAssignment): number => {
    const playing = candidate.usedPlayers;
    let excluded = 0;
    for (const bt of mustPlayBattletags) {
      if (!playing.has(bt)) {
        excluded++;
      }
    }
    return excluded * 1000; // Very high penalty
  };

  // Score all candidates and find the best ones
  // Collect top candidates (within a small margin of the best)
  const SCORE_MARGIN = 50; // Accept candidates within 50 points of best
  
  let bestScore = Infinity;
  for (const candidate of candidates) {
    let score = scoreComposition(
      candidate.team1,
      candidate.team2,
      softConstraints,
      lossStreaks
    );
    // Add heavy penalty for excluding must-play players
    score += calculateMustPlayPenalty(candidate);
    if (score < bestScore) {
      bestScore = score;
    }
  }

  // Get all candidates within margin of best
  const topCandidates: PartialAssignment[] = [];
  for (const candidate of candidates) {
    let score = scoreComposition(
      candidate.team1,
      candidate.team2,
      softConstraints,
      lossStreaks
    );
    score += calculateMustPlayPenalty(candidate);
    if (score <= bestScore + SCORE_MARGIN) {
      topCandidates.push(candidate);
    }
  }

  // Randomly pick one of the top candidates for variety
  const bestCandidate = topCandidates[Math.floor(Math.random() * topCandidates.length)];

  // Calculate final score breakdown
  const teamScore = calculateTeamScore(bestCandidate.team1, bestCandidate.team2);

  // Generate warnings for the selected composition
  
  // Collect constraint violations to consolidate into one warning
  const allAssignments = [...bestCandidate.team1, ...bestCandidate.team2];
  const playingBattletags = new Set(allAssignments.map((ra) => ra.player.battletag));
  const team1Battletags = new Set(bestCandidate.team1.map((ra) => ra.player.battletag));
  const team2Battletags = new Set(bestCandidate.team2.map((ra) => ra.player.battletag));
  
  // Collect players who sat out despite being must-play
  const satOutMustPlay: string[] = [];
  for (const player of activePlayers) {
    if (player.mustPlay && !playingBattletags.has(player.battletag)) {
      satOutMustPlay.push(player.battletag.split("#")[0]);
    }
  }
  
  // Collect lock violations (only if constraints were relaxed)
  const lockViolations: string[] = [];
  if (constraintsRelaxed) {
    for (const player of activePlayers) {
      const name = player.battletag.split("#")[0];
      if (player.lockedToTeam === 1 && !team1Battletags.has(player.battletag) && playingBattletags.has(player.battletag)) {
        lockViolations.push(`${name} moved to Team 2`);
      } else if (player.lockedToTeam === 2 && !team2Battletags.has(player.battletag) && playingBattletags.has(player.battletag)) {
        lockViolations.push(`${name} moved to Team 1`);
      }
      if (player.lockedToRole) {
        const assignment = allAssignments.find((a) => a.player.battletag === player.battletag);
        if (assignment && assignment.assignedRole !== player.lockedToRole) {
          lockViolations.push(`${name} placed on ${assignment.assignedRole}`);
        }
      }
    }
  }
  
  // Build consolidated constraint warning - only if there are actual issues
  if (satOutMustPlay.length > 0 || lockViolations.length > 0) {
    const parts: string[] = [];
    
    // Only mention overflow if some must-play players actually sat out
    if (hadMustPlayOverflow && satOutMustPlay.length > 0) {
      parts.push(`${originalMustPlayCount} players waiting, ${satOutMustPlay.length} had to sit out`);
    } else if (satOutMustPlay.length > 0) {
      parts.push(`Sat out: ${satOutMustPlay.join(", ")}`);
    }
    
    if (lockViolations.length > 0) {
      parts.push(`Locks adjusted: ${lockViolations.join(", ")}`);
    }
    
    if (parts.length > 0) {
      warnings.push({
        type: "constraints_relaxed",
        message: parts.join(". "),
        severity: "warning",
      });
    }
  }

  // Add warning if SR difference is high
  if (teamScore.srDifference > 100) {
    warnings.push({
      type: "imbalanced_roles",
      message: `SR difference is ${teamScore.srDifference} (target: < 100)`,
      severity: "warning",
    });
  }

  // Add archetype parity warnings
  const { violations: archetypeViolations } = checkArchetypeParity(
    bestCandidate.team1,
    bestCandidate.team2
  );
  for (const violation of archetypeViolations) {
    warnings.push({
      type: "archetype_gap",
      message: violation,
      severity: "warning",
    });
  }

  // Add one-trick conflict warnings
  const team1OneTrickConflicts = getOneTrickConflicts(bestCandidate.team1, 1);
  const team2OneTrickConflicts = getOneTrickConflicts(bestCandidate.team2, 2);
  for (const conflict of [...team1OneTrickConflicts, ...team2OneTrickConflicts]) {
    warnings.push({
      type: "one_trick_conflict",
      message: conflict,
      severity: "warning",
    });
  }

  // Add soft constraint violation warnings
  const constraintViolations = getSoftConstraintViolations(
    bestCandidate.team1,
    bestCandidate.team2,
    softConstraints
  );
  for (const violation of constraintViolations) {
    warnings.push({
      type: "soft_constraint_ignored",
      message: violation,
      severity: "warning",
    });
  }

  return {
    team1: bestCandidate.team1,
    team2: bestCandidate.team2,
    warnings,
    score: teamScore,
  };
}
