import type {
  LobbyPlayer,
  Role,
  RoleAssignment,
  TeamAssignment,
  Warning,
  SoftConstraint,
  GameMode,
} from "@engine/types";
import { getEffectiveSR } from "@utils/rankMapper";
import {
  scoreComposition,
  calculateTeamScore,
  checkArchetypeParity,
  getOneTrickConflicts,
  getSoftConstraintViolations,
  getHardConstraintViolations,
  countHardConstraintViolations,
} from "@engine/scoring";
import { getModeConfig, getValidCompositions } from "@engine/modeConfig";

// =============================================================================
// Core Balancer Algorithm for PUGs Balancer
// =============================================================================

/**
 * Get team composition for a given mode
 * Returns array of role/count pairs for building teams
 */
function getTeamComposition(mode: GameMode): { role: Role; count: number }[] {
  const validComps = getValidCompositions(mode);
  // Use the first valid composition (for 5v5, this is the only one: 1T/2D/2S)
  // For 6v6, this picks the first valid (typically 1T/4D/1S or 1T/3D/2S depending on sort)
  // Later we can optimize to try multiple compositions
  const comp = validComps[0];
  const result: { role: Role; count: number }[] = [];
  if (comp.Tank > 0) result.push({ role: "Tank", count: comp.Tank });
  if (comp.DPS > 0) result.push({ role: "DPS", count: comp.DPS });
  if (comp.Support > 0) result.push({ role: "Support", count: comp.Support });
  return result;
}

/**
 * Scoring function type for the optimizer
 */
type CompositionScorer = (team1: RoleAssignment[], team2: RoleAssignment[]) => number;

/** Fisher-Yates shuffle (in-place) */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Try to place a player into any open slot matching their constraints */
function tryPlacePlayer(
  player: LobbyPlayer,
  needed: Map<string, number>,
  respectTeamLocks: boolean,
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  mode: GameMode
): boolean {
  const teams = Math.random() < 0.5 ? [1, 2] as const : [2, 1] as const;
  for (const team of teams) {
    if (respectTeamLocks && player.lockedToTeam !== null && player.lockedToTeam !== team) continue;
    for (const role of player.rolesWilling) {
      // Role locks are ALWAYS respected (hard constraint) - Bug #26 fix
      if (player.lockedToRole !== null && player.lockedToRole !== role) continue;
      const key = `${team}-${role}`;
      if ((needed.get(key) || 0) > 0) {
        const ra = createRoleAssignment(player, role, mode);
        (team === 1 ? team1 : team2).push(ra);
        needed.set(key, needed.get(key)! - 1);
        return true;
      }
    }
  }
  return false;
}

/**
 * Generate one valid random assignment of players to team slots.
 * Places locked players first, then must-play, then fills remaining slots.
 * Returns null if no valid assignment can be constructed with this shuffle.
 * 
 * Note: Role locks are ALWAYS respected (hard constraint).
 * Team locks can be optionally relaxed via respectTeamLocks.
 */
function generateInitialAssignment(
  players: LobbyPlayer[],
  mode: GameMode,
  respectTeamLocks: boolean,
  mustPlayBattletags: Set<string>
): { team1: RoleAssignment[]; team2: RoleAssignment[]; bench: LobbyPlayer[] } | null {
  const teamComposition = getTeamComposition(mode);

  // Build needed counts per team+role (e.g., "1-Tank" -> 1, "1-DPS" -> 2)
  const needed = new Map<string, number>();
  for (const team of [1, 2] as const) {
    for (const { role, count } of teamComposition) {
      needed.set(`${team}-${role}`, count);
    }
  }

  const team1: RoleAssignment[] = [];
  const team2: RoleAssignment[] = [];
  const used = new Set<string>();

  // Shuffle for randomness across restarts
  const shuffled = [...players];
  shuffleArray(shuffled);

  // Phase 1: Place fully locked players (team + role) - always honors role locks
  for (const p of shuffled) {
    // Players with role locks should be placed in their locked role
    if (p.lockedToRole !== null) {
      // If also team-locked and we respect team locks, place on that team
      if (respectTeamLocks && p.lockedToTeam !== null) {
        const key = `${p.lockedToTeam}-${p.lockedToRole}`;
        if ((needed.get(key) || 0) > 0 && p.rolesWilling.includes(p.lockedToRole)) {
          const ra = createRoleAssignment(p, p.lockedToRole, mode);
          (p.lockedToTeam === 1 ? team1 : team2).push(ra);
          used.add(p.battletag);
          needed.set(key, needed.get(key)! - 1);
        }
      } else if (p.lockedToTeam === null || !respectTeamLocks) {
        // Role-locked but not team-locked (or team locks relaxed): place on any team with a slot
        for (const team of [1, 2] as const) {
          const key = `${team}-${p.lockedToRole}`;
          if ((needed.get(key) || 0) > 0 && p.rolesWilling.includes(p.lockedToRole)) {
            const ra = createRoleAssignment(p, p.lockedToRole, mode);
            (team === 1 ? team1 : team2).push(ra);
            used.add(p.battletag);
            needed.set(key, needed.get(key)! - 1);
            break;
          }
        }
      }
    }
  }

  // Phase 2: Place must-play players (respects role locks via tryPlacePlayer)
  for (const p of shuffled) {
    if (used.has(p.battletag)) continue;
    if (!mustPlayBattletags.has(p.battletag)) continue;
    if (tryPlacePlayer(p, needed, respectTeamLocks, team1, team2, mode)) {
      used.add(p.battletag);
    }
  }

  // Phase 3: Fill remaining slots from available players
  for (const p of shuffled) {
    if (used.has(p.battletag)) continue;
    let anySlotLeft = false;
    for (const v of needed.values()) { if (v > 0) { anySlotLeft = true; break; } }
    if (!anySlotLeft) break;
    if (tryPlacePlayer(p, needed, respectTeamLocks, team1, team2, mode)) {
      used.add(p.battletag);
    }
  }

  // Verify all slots filled and must-play constraints met
  for (const v of needed.values()) { if (v > 0) return null; }
  for (const bt of mustPlayBattletags) { if (!used.has(bt)) return null; }

  const bench = players.filter(p => !used.has(p.battletag));
  return { team1, team2, bench };
}

/**
 * Run hill-climbing optimization with simulated annealing on an initial assignment.
 * Tries random swaps (inter-team, 2-opt, bench, intra-team role) and keeps improvements.
 * Early iterations accept slightly worse moves to escape shallow local minima;
 * temperature decays to zero so late iterations are strictly greedy.
 * Mutates team1/team2/bench in place, returns the final score.
 * 
 * Note: Role locks are ALWAYS respected (hard constraint).
 * Team locks can be optionally relaxed via respectTeamLocks.
 * Hard constraints (together/apart) are ALWAYS respected - swaps that violate are rejected.
 */
function hillClimb(
  team1: RoleAssignment[],
  team2: RoleAssignment[],
  bench: LobbyPlayer[],
  mode: GameMode,
  scorer: CompositionScorer,
  respectTeamLocks: boolean,
  mustPlayBattletags: Set<string>,
  iterations: number,
  hardConstraints: SoftConstraint[]
): number {
  let currentScore = scorer(team1, team2);
  let bestScore = currentScore;
  let bestTeam1 = team1.slice();
  let bestTeam2 = team2.slice();
  let bestBench = bench.slice();

  // Simulated annealing: start temperature allows accepting moves ~5 score worse
  // with ~37% probability; decays to 0 over the iteration budget.
  const T0 = 5;

  for (let iter = 0; iter < iterations; iter++) {
    const temperature = T0 * (1 - iter / iterations);
    const r = Math.random();

    if (r < 0.35) {
      // Inter-team player swap: swap one player from each team
      const i1 = Math.floor(Math.random() * team1.length);
      const i2 = Math.floor(Math.random() * team2.length);
      const p1 = team1[i1], p2 = team2[i2];

      if (!p1.player.rolesWilling.includes(p2.assignedRole)) continue;
      if (!p2.player.rolesWilling.includes(p1.assignedRole)) continue;

      const lp1 = p1.player as LobbyPlayer, lp2 = p2.player as LobbyPlayer;
      
      // Team locks - only enforced if respectTeamLocks is true
      if (respectTeamLocks) {
        if (lp1.lockedToTeam === 1 || lp2.lockedToTeam === 2) continue;
      }
      
      // Role locks - ALWAYS enforced (Bug #26 fix)
      if (lp1.lockedToRole !== null && lp1.lockedToRole !== p2.assignedRole) continue;
      if (lp2.lockedToRole !== null && lp2.lockedToRole !== p1.assignedRole) continue;

      // Each player takes the other's slot (team + role)
      team1[i1] = createRoleAssignment(p2.player as LobbyPlayer, p1.assignedRole, mode);
      team2[i2] = createRoleAssignment(p1.player as LobbyPlayer, p2.assignedRole, mode);

      // Hard constraints - ALWAYS enforced. Reject swap if it would violate.
      if (countHardConstraintViolations(team1, team2, hardConstraints) > 0) {
        team1[i1] = p1;
        team2[i2] = p2;
        continue;
      }

      const newScore = scorer(team1, team2);
      const delta = newScore - currentScore;
      if (delta < 0 || (temperature > 0 && Math.random() < Math.exp(-delta / temperature))) {
        currentScore = newScore;
        if (newScore < bestScore) { bestScore = newScore; bestTeam1 = team1.slice(); bestTeam2 = team2.slice(); bestBench = bench.slice(); }
      } else {
        team1[i1] = p1;
        team2[i2] = p2;
      }
    } else if (r < 0.40) {
      // 2-opt: two simultaneous inter-team swaps to break plateaus
      if (team1.length < 2 || team2.length < 2) continue;

      const i1a = Math.floor(Math.random() * team1.length);
      const i2a = Math.floor(Math.random() * team2.length);
      let i1b = Math.floor(Math.random() * (team1.length - 1));
      if (i1b >= i1a) i1b++;
      let i2b = Math.floor(Math.random() * (team2.length - 1));
      if (i2b >= i2a) i2b++;

      const p1a = team1[i1a], p2a = team2[i2a];
      const p1b = team1[i1b], p2b = team2[i2b];

      if (!p1a.player.rolesWilling.includes(p2a.assignedRole)) continue;
      if (!p2a.player.rolesWilling.includes(p1a.assignedRole)) continue;
      if (!p1b.player.rolesWilling.includes(p2b.assignedRole)) continue;
      if (!p2b.player.rolesWilling.includes(p1b.assignedRole)) continue;

      const lp1a = p1a.player as LobbyPlayer, lp2a = p2a.player as LobbyPlayer;
      const lp1b = p1b.player as LobbyPlayer, lp2b = p2b.player as LobbyPlayer;
      
      // Team locks - only enforced if respectTeamLocks is true
      if (respectTeamLocks) {
        if (lp1a.lockedToTeam === 1 || lp2a.lockedToTeam === 2) continue;
        if (lp1b.lockedToTeam === 1 || lp2b.lockedToTeam === 2) continue;
      }
      
      // Role locks - ALWAYS enforced (Bug #26 fix)
      if (lp1a.lockedToRole !== null && lp1a.lockedToRole !== p2a.assignedRole) continue;
      if (lp2a.lockedToRole !== null && lp2a.lockedToRole !== p1a.assignedRole) continue;
      if (lp1b.lockedToRole !== null && lp1b.lockedToRole !== p2b.assignedRole) continue;
      if (lp2b.lockedToRole !== null && lp2b.lockedToRole !== p1b.assignedRole) continue;

      team1[i1a] = createRoleAssignment(p2a.player as LobbyPlayer, p1a.assignedRole, mode);
      team2[i2a] = createRoleAssignment(p1a.player as LobbyPlayer, p2a.assignedRole, mode);
      team1[i1b] = createRoleAssignment(p2b.player as LobbyPlayer, p1b.assignedRole, mode);
      team2[i2b] = createRoleAssignment(p1b.player as LobbyPlayer, p2b.assignedRole, mode);

      // Hard constraints - ALWAYS enforced. Reject swap if it would violate.
      if (countHardConstraintViolations(team1, team2, hardConstraints) > 0) {
        team1[i1a] = p1a;
        team2[i2a] = p2a;
        team1[i1b] = p1b;
        team2[i2b] = p2b;
        continue;
      }

      const newScore = scorer(team1, team2);
      const delta = newScore - currentScore;
      if (delta < 0 || (temperature > 0 && Math.random() < Math.exp(-delta / temperature))) {
        currentScore = newScore;
        if (newScore < bestScore) { bestScore = newScore; bestTeam1 = team1.slice(); bestTeam2 = team2.slice(); bestBench = bench.slice(); }
      } else {
        team1[i1a] = p1a;
        team2[i2a] = p2a;
        team1[i1b] = p1b;
        team2[i2b] = p2b;
      }
    } else if (r < 0.70 && bench.length > 0) {
      // Bench swap: replace a playing player with a benched one
      const useTeam1 = Math.random() < 0.5;
      const teamArr = useTeam1 ? team1 : team2;
      const teamNum = useTeam1 ? 1 : 2;
      const ti = Math.floor(Math.random() * teamArr.length);
      const bi = Math.floor(Math.random() * bench.length);

      const playing = teamArr[ti];
      const benched = bench[bi];

      if (mustPlayBattletags.has(playing.player.battletag)) continue;
      if (!benched.rolesWilling.includes(playing.assignedRole)) continue;

      // Team locks - only enforced if respectTeamLocks is true
      if (respectTeamLocks) {
        if ((playing.player as LobbyPlayer).lockedToTeam !== null) continue;
        if (benched.lockedToTeam !== null && benched.lockedToTeam !== teamNum) continue;
      }
      
      // Role locks - ALWAYS enforced (Bug #26 fix)
      if (benched.lockedToRole !== null && benched.lockedToRole !== playing.assignedRole) continue;

      teamArr[ti] = createRoleAssignment(benched, playing.assignedRole, mode);
      bench[bi] = playing.player as LobbyPlayer;

      // Hard constraints - ALWAYS enforced. Reject swap if it would violate.
      if (countHardConstraintViolations(team1, team2, hardConstraints) > 0) {
        bench[bi] = benched;
        teamArr[ti] = playing;
        continue;
      }

      const newScore = scorer(team1, team2);
      const delta = newScore - currentScore;
      if (delta < 0 || (temperature > 0 && Math.random() < Math.exp(-delta / temperature))) {
        currentScore = newScore;
        if (newScore < bestScore) { bestScore = newScore; bestTeam1 = team1.slice(); bestTeam2 = team2.slice(); bestBench = bench.slice(); }
      } else {
        bench[bi] = benched;
        teamArr[ti] = playing;
      }
    } else {
      // Intra-team role swap: swap roles of two players on the same team
      const teamArr = Math.random() < 0.5 ? team1 : team2;
      if (teamArr.length < 2) continue;

      const idx1 = Math.floor(Math.random() * teamArr.length);
      let idx2 = Math.floor(Math.random() * (teamArr.length - 1));
      if (idx2 >= idx1) idx2++;

      const p1 = teamArr[idx1], p2 = teamArr[idx2];
      if (p1.assignedRole === p2.assignedRole) continue;

      if (!p1.player.rolesWilling.includes(p2.assignedRole)) continue;
      if (!p2.player.rolesWilling.includes(p1.assignedRole)) continue;

      // Role locks - ALWAYS enforced (Bug #26 fix) - no team lock check needed for intra-team swap
      const lp1 = p1.player as LobbyPlayer, lp2 = p2.player as LobbyPlayer;
      if (lp1.lockedToRole !== null && lp1.lockedToRole !== p2.assignedRole) continue;
      if (lp2.lockedToRole !== null && lp2.lockedToRole !== p1.assignedRole) continue;

      teamArr[idx1] = createRoleAssignment(p1.player as LobbyPlayer, p2.assignedRole, mode);
      teamArr[idx2] = createRoleAssignment(p2.player as LobbyPlayer, p1.assignedRole, mode);

      const newScore = scorer(team1, team2);
      const delta = newScore - currentScore;
      if (delta < 0 || (temperature > 0 && Math.random() < Math.exp(-delta / temperature))) {
        currentScore = newScore;
        if (newScore < bestScore) { bestScore = newScore; bestTeam1 = team1.slice(); bestTeam2 = team2.slice(); bestBench = bench.slice(); }
      } else {
        teamArr[idx1] = p1;
        teamArr[idx2] = p2;
      }
    }
  }

  // Restore best-ever state (annealing may have wandered away)
  for (let i = 0; i < team1.length; i++) team1[i] = bestTeam1[i];
  for (let i = 0; i < team2.length; i++) team2[i] = bestTeam2[i];
  bench.length = 0;
  bench.push(...bestBench);

  return bestScore;
}

const NUM_RESTARTS = 20;
const ITERATIONS_PER_RESTART = 1000;

/**
 * Find the best team composition using multi-restart hill climbing.
 * Generates random valid assignments and iteratively improves them via swaps.
 * Scales to any lobby size — bounded by iteration count, not combinations.
 */
/**
 * Find the best team composition using multi-restart hill climbing.
 * Generates random valid assignments and iteratively improves them via swaps.
 * Scales to any lobby size — bounded by iteration count, not combinations.
 * 
 * Note: Role locks are ALWAYS respected (hard constraint).
 * Team locks can be optionally relaxed via respectTeamLocks.
 * Hard constraints (together/apart) are ALWAYS respected.
 */
function findBestComposition(
  players: LobbyPlayer[],
  mode: GameMode,
  scorer: CompositionScorer,
  respectTeamLocks: boolean,
  mustPlayBattletags: Set<string>,
  hardConstraints: SoftConstraint[]
): PartialAssignment | null {
  let globalBestScore = Infinity;
  let globalBestResult: PartialAssignment | null = null;

  for (let restart = 0; restart < NUM_RESTARTS; restart++) {
    const initial = generateInitialAssignment(players, mode, respectTeamLocks, mustPlayBattletags);
    if (!initial) continue;

    const { team1, team2, bench } = initial;

    // Skip this restart if initial assignment violates hard constraints
    if (countHardConstraintViolations(team1, team2, hardConstraints) > 0) {
      continue;
    }

    const finalScore = hillClimb(
      team1, team2, bench, mode, scorer,
      respectTeamLocks, mustPlayBattletags, ITERATIONS_PER_RESTART,
      hardConstraints
    );

    if (finalScore < globalBestScore) {
      globalBestScore = finalScore;
      globalBestResult = {
        team1: [...team1],
        team2: [...team2],
        usedPlayers: new Set([
          ...team1.map(ra => ra.player.battletag),
          ...team2.map(ra => ra.player.battletag),
        ]),
      };
    }
  }

  return globalBestResult;
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
export function canFormValidTeams(
  players: LobbyPlayer[],
  mode: GameMode = "stadium_5v5"
): {
  valid: boolean;
  missingRoles: { role: Role; have: number; need: number }[];
} {
  const groups = groupPlayersByRole(players);
  const missingRoles: { role: Role; have: number; need: number }[] = [];
  const teamComposition = getTeamComposition(mode);

  for (const { role, count } of teamComposition) {
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
 * Check if role locks create impossible constraints
 * Returns array of conflict descriptions
 */
function checkRoleLockConflicts(
  players: LobbyPlayer[],
  mode: GameMode = "stadium_5v5"
): string[] {
  const conflicts: string[] = [];
  const teamComposition = getTeamComposition(mode);
  
  // Count role-locked players by role
  const lockedByRole: Record<Role, string[]> = {
    Tank: [],
    DPS: [],
    Support: [],
  };
  
  for (const player of players) {
    if (player.lockedToRole) {
      lockedByRole[player.lockedToRole].push(player.battletag.split("#")[0]);
    }
  }
  
  // Check if any role has more locks than available slots
  for (const { role, count } of teamComposition) {
    const totalSlots = count * 2; // For both teams
    const lockedCount = lockedByRole[role].length;
    
    if (lockedCount > totalSlots) {
      conflicts.push(
        `${lockedCount} players locked to ${role} but only ${totalSlots} ${role} slots available`
      );
    }
  }
  
  return conflicts;
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
 * 
 * @param player - Player to assign
 * @param role - Role to assign them to
 * @param mode - Game mode (for SR calculation)
 */
function createRoleAssignment(
  player: LobbyPlayer,
  role: Role,
  mode: GameMode = "stadium_5v5"
): RoleAssignment {
  return {
    player,
    assignedRole: role,
    effectiveSR: getEffectiveSR(player, role, mode),
  };
}

/**
 * Main balancing function
 *
 * @param lobby - Players available for balancing (excluding AFK)
 * @param softConstraints - Optional soft constraints (together/apart)
 * @param mode - Game mode (determines scoring rules and required players)
 * @returns TeamAssignment with best balanced teams, or null if impossible
 */
export function balanceTeams(
  lobby: LobbyPlayer[],
  softConstraints: SoftConstraint[] = [],
  mode: GameMode = "stadium_5v5"
): TeamAssignment {
  const warnings: Warning[] = [];
  const modeConfig = getModeConfig(mode);
  const requiredPlayers = modeConfig.teamSize * 2;

  // Filter out AFK players
  const activePlayers = lobby.filter((p) => !p.isAfk);

  // Validate minimum players
  if (activePlayers.length < requiredPlayers) {
    warnings.push({
      type: "insufficient_players",
      message: `Need at least ${requiredPlayers} active players for ${modeConfig.label}, have ${activePlayers.length}`,
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
  const { valid: canForm, missingRoles } = canFormValidTeams(activePlayers, mode);
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
  const hadMustPlayOverflow = mustPlayPlayers.length > requiredPlayers;
  
  if (hadMustPlayOverflow) {
    // Sort by priority first (sat-out waiting > joined mid-match), then by sat-out streak
    const sortedByPriority = [...mustPlayPlayers].sort((a, b) => {
      const priorityDiff = b.mustPlayPriority - a.mustPlayPriority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.consecutiveSatOut - a.consecutiveSatOut;
    });
    const keepMustPlay = new Set(sortedByPriority.slice(0, requiredPlayers).map((p) => p.battletag));
    
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
  
  // If we have at least the required number of priority players with valid role coverage, use ONLY them
  if (mustPlayAndLocked.length >= requiredPlayers) {
    const { valid: canFormPriority } = canFormValidTeams(mustPlayAndLocked, mode);
    if (canFormPriority) {
      playerPool = mustPlayAndLocked;
    } else {
      // Need to supplement with non-must-play players for role coverage
      // Add the minimum number of non-must-play players needed for each missing role
      const groups = groupPlayersByRole(mustPlayAndLocked);
      const supplementPlayers: LobbyPlayer[] = [];
      const teamComposition = getTeamComposition(mode);
      
      for (const { role, count } of teamComposition) {
        const have = groups[role].length;
        const needed = count * 2; // For both teams
        if (have < needed) {
          const deficit = needed - have;
          // Find non-must-play players willing to play this role
          const available = activePlayers.filter(
            (p) => !p.mustPlay && 
                   !lockedPlayerBattletags.has(p.battletag) && 
                   p.rolesWilling.includes(role) &&
                   !supplementPlayers.includes(p)
          );
          supplementPlayers.push(...available.slice(0, deficit));
        }
      }
      
      playerPool = [...mustPlayAndLocked, ...supplementPlayers];
    }
  } else {
    // Not enough must-play players - use all
    playerPool = activePlayers;
  }
  
  let constraintsRelaxed = false;

  // Get all must-play player battletags
  const mustPlayBattletags = new Set(mustPlayPlayers.map((p) => p.battletag));

  // Bug #28 fix: Check for impossible role lock combinations UPFRONT
  // This detects when must-play players have role locks that can't all be satisfied
  const roleLockConflicts = checkRoleLockConflicts(activePlayers, mode);
  if (roleLockConflicts.length > 0) {
    // Check if any conflicting role lock involves must-play players
    const mustPlayWithRoleLocks = mustPlayPlayers.filter(p => p.lockedToRole !== null);
    if (mustPlayWithRoleLocks.length > 0) {
      // Count role-locked must-play players by role
      const mustPlayByRole: Record<Role, number> = { Tank: 0, DPS: 0, Support: 0 };
      for (const p of mustPlayWithRoleLocks) {
        if (p.lockedToRole) mustPlayByRole[p.lockedToRole]++;
      }
      
      // Check if must-play role locks exceed available slots
      const teamComposition = getTeamComposition(mode);
      for (const { role, count } of teamComposition) {
        const totalSlots = count * 2;
        if (mustPlayByRole[role] > totalSlots) {
          warnings.push({
            type: "impossible_composition",
            message: `Cannot satisfy role locks: ${mustPlayByRole[role]} must-play players locked to ${role} but only ${totalSlots} ${role} slots exist`,
            severity: "error",
          });
          return {
            team1: [],
            team2: [],
            warnings,
            score: { team1SR: 0, team2SR: 0, srDifference: 0, archetypeParityMet: false },
          };
        }
      }
    }
  }

  // Scorer: evaluates complete team compositions (lower = better)
  const scorer: CompositionScorer = (team1, team2) => {
    return scoreComposition(team1, team2, softConstraints, mode);
  };

  // Extract hard constraints for explicit enforcement
  const hardConstraints = softConstraints.filter(c => c.hard);

  // Multi-restart hill climbing: find best composition via iterative swap optimization
  // Note: Role locks are ALWAYS respected. Only team locks can be relaxed.
  // Hard constraints are ALWAYS respected - swaps that violate are rejected.
  let bestCandidate = findBestComposition(playerPool, mode, scorer, true, mustPlayBattletags, hardConstraints);

  // If no result with strict team locks, retry with relaxed team locks (role locks still enforced)
  // Bug #28 fix: Keep mustPlayBattletags to ensure must-play players aren't silently dropped
  if (!bestCandidate) {
    bestCandidate = findBestComposition(playerPool, mode, scorer, false, mustPlayBattletags, hardConstraints);
    constraintsRelaxed = true;
  }
  
  // Last resort: use all players if player pool failed
  if (!bestCandidate && playerPool !== activePlayers) {
    bestCandidate = findBestComposition(activePlayers, mode, scorer, false, mustPlayBattletags, hardConstraints);
    constraintsRelaxed = true;
  }

  if (!bestCandidate) {
    // Check if role locks are the cause of the failure
    const remainingConflicts = checkRoleLockConflicts(activePlayers, mode);
    if (remainingConflicts.length > 0) {
      warnings.push({
        type: "impossible_composition",
        message: `Cannot balance due to role locks: ${remainingConflicts.join(", ")}`,
        severity: "error",
      });
    } else {
      warnings.push({
        type: "impossible_composition",
        message: "Could not generate any valid team compositions - check role coverage",
        severity: "error",
      });
    }

    return {
      team1: [],
      team2: [],
      warnings,
      score: { team1SR: 0, team2SR: 0, srDifference: 0, archetypeParityMet: false },
    };
  }

  // Calculate final score breakdown
  const teamScore = calculateTeamScore(bestCandidate.team1, bestCandidate.team2, mode);

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
  
  // Collect lock violations (only team locks can be violated - role locks are always enforced)
  const lockViolations: string[] = [];
  if (constraintsRelaxed) {
    for (const player of activePlayers) {
      const name = player.battletag.split("#")[0];
      if (player.lockedToTeam === 1 && !team1Battletags.has(player.battletag) && playingBattletags.has(player.battletag)) {
        lockViolations.push(`${name} moved to Team 2`);
      } else if (player.lockedToTeam === 2 && !team2Battletags.has(player.battletag) && playingBattletags.has(player.battletag)) {
        lockViolations.push(`${name} moved to Team 1`);
      }
      // Note: Role locks cannot be violated anymore (Bug #26 fix) - they are hard constraints
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

  // Check HARD constraint violations - fail if any violated
  const hardConstraintViolations = getHardConstraintViolations(
    bestCandidate.team1,
    bestCandidate.team2,
    softConstraints
  );
  if (hardConstraintViolations.length > 0) {
    // Hard constraints violated - return error result
    for (const violation of hardConstraintViolations) {
      warnings.push({
        type: "impossible_composition",
        message: violation,
        severity: "error",
      });
    }
    return {
      team1: [],
      team2: [],
      warnings,
      score: { team1SR: 0, team2SR: 0, srDifference: 0, archetypeParityMet: false },
    };
  }

  // Add soft constraint violation warnings (preferences that couldn't be honored)
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
