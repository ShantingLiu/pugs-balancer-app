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

interface SlotTarget {
  team: 1 | 2;
  role: Role;
}

const ALL_ROLES: Role[] = ["Tank", "DPS", "Support"];
const ROLE_SUBSETS: Role[][] = [
  ["Tank"],
  ["DPS"],
  ["Support"],
  ["Tank", "DPS"],
  ["Tank", "Support"],
  ["DPS", "Support"],
  ["Tank", "DPS", "Support"],
];

function shuffledCopy<T>(items: T[]): T[] {
  const arr = items.slice();
  shuffleArray(arr);
  return arr;
}

function getEffectiveRoles(player: LobbyPlayer): Role[] {
  if (player.lockedToRoles && player.lockedToRoles.length > 0) {
    return player.rolesWilling.filter(r => player.lockedToRoles!.includes(r));
  }
  if (player.lockedToRole !== null) {
    return player.rolesWilling.includes(player.lockedToRole) ? [player.lockedToRole] : [];
  }
  return player.rolesWilling;
}

function hasAnyRoleLock(player: LobbyPlayer): boolean {
  return (
    player.lockedToRole !== null ||
    (player.lockedToRoles !== undefined && player.lockedToRoles.length > 0)
  );
}

function isRoleAllowed(player: LobbyPlayer, role: Role): boolean {
  return getEffectiveRoles(player).includes(role);
}

function canPlayerFillSlot(
  player: LobbyPlayer,
  slot: SlotTarget,
  respectTeamLocks: boolean
): boolean {
  if (!isRoleAllowed(player, slot.role)) return false;
  if (respectTeamLocks && player.lockedToTeam !== null && player.lockedToTeam !== slot.team) {
    return false;
  }
  return true;
}

function buildSlotsForCompositions(
  team1Comp: { Tank: number; DPS: number; Support: number },
  team2Comp: { Tank: number; DPS: number; Support: number }
): SlotTarget[] {
  const slots: SlotTarget[] = [];
  for (const role of ALL_ROLES) {
    for (let i = 0; i < team1Comp[role]; i++) slots.push({ team: 1, role });
    for (let i = 0; i < team2Comp[role]; i++) slots.push({ team: 2, role });
  }
  return slots;
}

function solveBipartiteSlots(
  players: LobbyPlayer[],
  slots: SlotTarget[],
  mode: GameMode,
  respectTeamLocks: boolean,
  mustPlayBattletags: Set<string>
): { team1: RoleAssignment[]; team2: RoleAssignment[]; bench: LobbyPlayer[] } | null {
  const mustPlayIndices: number[] = [];
  const optionalIndices: number[] = [];
  players.forEach((p, idx) => {
    if (mustPlayBattletags.has(p.battletag)) mustPlayIndices.push(idx);
    else optionalIndices.push(idx);
  });

  if (mustPlayIndices.length > slots.length) return null;

  const slotToPlayer = new Array<number>(slots.length).fill(-1);
  const playerToSlot = new Array<number>(players.length).fill(-1);
  const slotOrder = shuffledCopy(slots.map((_, i) => i));

  const tryMatchPlayer = (pIdx: number, visitedSlots: boolean[]): boolean => {
    for (const sIdx of slotOrder) {
      if (visitedSlots[sIdx] || !canPlayerFillSlot(players[pIdx], slots[sIdx], respectTeamLocks)) {
        continue;
      }
      visitedSlots[sIdx] = true;
      const prevPlayer = slotToPlayer[sIdx];
      if (prevPlayer === -1 || tryMatchPlayer(prevPlayer, visitedSlots)) {
        slotToPlayer[sIdx] = pIdx;
        playerToSlot[pIdx] = sIdx;
        return true;
      }
    }
    return false;
  };

  for (const pIdx of shuffledCopy(mustPlayIndices)) {
    if (!tryMatchPlayer(pIdx, new Array<boolean>(slots.length).fill(false))) {
      return null;
    }
  }

  // Augment from empty slots to any unmatched optional player; must-play players only shift slots.
  const allPlayerOrder = shuffledCopy([...optionalIndices, ...mustPlayIndices]);
  const tryMatchSlot = (sIdx: number, visitedPlayers: boolean[]): boolean => {
    for (const pIdx of allPlayerOrder) {
      if (visitedPlayers[pIdx] || !canPlayerFillSlot(players[pIdx], slots[sIdx], respectTeamLocks)) {
        continue;
      }
      visitedPlayers[pIdx] = true;
      const prevSlot = playerToSlot[pIdx];
      if (prevSlot === -1 || tryMatchSlot(prevSlot, visitedPlayers)) {
        slotToPlayer[sIdx] = pIdx;
        playerToSlot[pIdx] = sIdx;
        return true;
      }
    }
    return false;
  };

  for (let sIdx = 0; sIdx < slots.length; sIdx++) {
    if (slotToPlayer[sIdx] !== -1) continue;
    if (!tryMatchSlot(sIdx, new Array<boolean>(players.length).fill(false))) {
      return null;
    }
  }

  const team1: RoleAssignment[] = [];
  const team2: RoleAssignment[] = [];
  const used = new Set<string>();

  slots.forEach((slot, sIdx) => {
    const player = players[slotToPlayer[sIdx]];
    used.add(player.battletag);
    const ra = createRoleAssignment(player, slot.role, mode);
    if (slot.team === 1) team1.push(ra);
    else team2.push(ra);
  });

  const bench = players.filter(p => !used.has(p.battletag));
  return { team1, team2, bench };
}

function findBipartiteInitialAssignment(
  players: LobbyPlayer[],
  mode: GameMode,
  respectTeamLocks: boolean,
  mustPlayBattletags: Set<string>
): { team1: RoleAssignment[]; team2: RoleAssignment[]; bench: LobbyPlayer[] } | null {
  const validComps = getValidCompositions(mode);
  const compPairs: Array<{ c1: typeof validComps[number]; c2: typeof validComps[number] }> = [];
  for (const c1 of validComps) {
    for (const c2 of validComps) {
      compPairs.push({ c1, c2 });
    }
  }
  for (const { c1, c2 } of shuffledCopy(compPairs)) {
    const slots = buildSlotsForCompositions(c1, c2);
    const result = solveBipartiteSlots(players, slots, mode, respectTeamLocks, mustPlayBattletags);
    if (result) return result;
  }
  return null;
}

function diagnoseHardConstraintConflict(
  players: LobbyPlayer[],
  hardConstraints: SoftConstraint[],
  mode: GameMode
): string[] {
  const messages: string[] = [];
  const config = getModeConfig(mode);
  const validComps = getValidCompositions(mode);
  const maxRolePerTeam = (role: Role): number =>
    Math.max(...validComps.map(c => c[role]));
  const playerMap = new Map(players.map(p => [p.battletag, p]));

  for (const hc of hardConstraints) {
    if (hc.players.length < 2) continue;
    const activeInConstraint = hc.players.map(bt => playerMap.get(bt)).filter((p): p is LobbyPlayer => !!p);
    if (activeInConstraint.length < 2) continue;

    if (hc.type === "together" && activeInConstraint.length > config.teamSize) {
      messages.push(
        `Too many players constrained together (${activeInConstraint.length}) for a team size of ${config.teamSize}`
      );
      continue;
    }

    if (hc.type === "together") {
      for (const role of ALL_ROLES) {
        const lockedToOnlyRole = activeInConstraint.filter(p => {
          const eff = getEffectiveRoles(p);
          return eff.length === 1 && eff[0] === role;
        });
        const maxSlots = maxRolePerTeam(role);
        if (lockedToOnlyRole.length > maxSlots) {
          const names = lockedToOnlyRole.map(p => p.battletag).join(" & ");
          messages.push(
            `${names} cannot play together: all are limited to ${role}, which only has ${maxSlots} slot${maxSlots === 1 ? "" : "s"} per team`
          );
        }
      }
    }
  }

  if (messages.length === 0 && hardConstraints.length > 0) {
    messages.push(
      "Could not satisfy hard together/apart constraints alongside role requirements — try relaxing a pairing constraint"
    );
  }
  return messages;
}

function diagnoseCompositionFailure(
  players: LobbyPlayer[],
  mustPlayBattletags: Set<string>,
  hardConstraints: SoftConstraint[],
  mode: GameMode
): Warning[] {
  const messages: string[] = [];
  const addMsg = (msg: string) => {
    if (!messages.includes(msg)) messages.push(msg);
  };

  const config = getModeConfig(mode);
  const requiredTotal = config.teamSize * 2;
  const validComps = getValidCompositions(mode);

  const minSubsetSlots = (subset: Role[]): number =>
    2 * Math.min(...validComps.map(c => subset.reduce((s, r) => s + c[r], 0)));
  const maxSubsetSlots = (subset: Role[]): number =>
    2 * Math.max(...validComps.map(c => subset.reduce((s, r) => s + c[r], 0)));

  // 1. Role locks incompatible with player's own willing roles
  for (const p of players) {
    if (p.lockedToRole !== null && !p.rolesWilling.includes(p.lockedToRole)) {
      addMsg(`${p.battletag} is locked to ${p.lockedToRole}, which isn't in their willing roles`);
    } else if (
      p.lockedToRoles &&
      p.lockedToRoles.length > 0 &&
      getEffectiveRoles(p).length === 0
    ) {
      addMsg(
        `${p.battletag} is locked to ${p.lockedToRoles.join("/")}, which isn't in their willing roles`
      );
    }
  }

  // 2. Role locks exceeding global slots
  for (const msg of checkRoleLockConflicts(players, mode)) {
    addMsg(`Cannot balance due to role locks: ${msg}`);
  }

  // 3. Total player count / must-play count
  if (players.length < requiredTotal) {
    addMsg(
      `Not enough players: have ${players.length}, need ${requiredTotal} (${requiredTotal - players.length} more needed)`
    );
  }
  if (mustPlayBattletags.size > requiredTotal) {
    addMsg(
      `Too many must-play players: ${mustPlayBattletags.size} marked must-play for ${requiredTotal} total slots`
    );
  }

  // 4. Hall's condition: role subset shortages (accounting for role locks)
  const failedSingleRoles = new Set<Role>();
  for (const subset of ROLE_SUBSETS) {
    if (subset.length > 1 && subset.some(r => failedSingleRoles.has(r))) continue;

    const minNeed = minSubsetSlots(subset);
    if (minNeed === 0) continue;

    const eligibleWithLocks = players.filter(p =>
      getEffectiveRoles(p).some(r => subset.includes(r))
    ).length;

    if (eligibleWithLocks < minNeed) {
      const eligibleRaw = players.filter(p =>
        p.rolesWilling.some(r => subset.includes(r))
      ).length;
      const lockNote = eligibleRaw >= minNeed ? " — check role locks" : "";
      const shortage = minNeed - eligibleWithLocks;

      if (subset.length === 1) {
        const role = subset[0];
        failedSingleRoles.add(role);
        addMsg(
          `Not enough ${role} players: have ${eligibleWithLocks}, need ${minNeed} (${shortage} more needed${lockNote})`
        );
      } else if (subset.length === 2) {
        const label = subset.join("/");
        addMsg(
          `Not enough ${label} players combined: have ${eligibleWithLocks} for ${minNeed} combined ${label} slots (${shortage} more needed${lockNote})`
        );
      } else {
        addMsg(
          `Only ${eligibleWithLocks} eligible players can fill a role for ${minNeed} slots (${shortage} more needed${lockNote})`
        );
      }
    }
  }

  // 5. Over-subscribed must-play players restricted to a role subset
  if (mustPlayBattletags.size > 0) {
    const mustPlayPlayers = players.filter(p => mustPlayBattletags.has(p.battletag));
    const overflowedSingles = new Set<Role>();
    for (const subset of ROLE_SUBSETS) {
      if (subset.length > 1 && subset.some(r => overflowedSingles.has(r))) continue;
      const maxSlots = maxSubsetSlots(subset);
      const restrictedCount = mustPlayPlayers.filter(p => {
        const eff = getEffectiveRoles(p);
        return eff.length > 0 && eff.every(r => subset.includes(r));
      }).length;

      if (restrictedCount > maxSlots) {
        if (subset.length === 1) overflowedSingles.add(subset[0]);
        const roleLabel = subset.length === 1 ? `${subset[0]}-only` : `${subset.join("/")}-only`;
        addMsg(
          `Too many ${roleLabel} must-play players (${restrictedCount}) for ${maxSlots} ${subset.join("/")} slot${maxSlots === 1 ? "" : "s"}`
        );
      }
    }
  }

  // 6. If role coverage itself is solvable without hard constraints, diagnose hard constraint conflict
  if (messages.length === 0) {
    const solvableWithoutHard = findBipartiteInitialAssignment(players, mode, false, mustPlayBattletags);
    if (solvableWithoutHard && hardConstraints.length > 0) {
      for (const hcMsg of diagnoseHardConstraintConflict(players, hardConstraints, mode)) {
        addMsg(hcMsg);
      }
    } else if (!solvableWithoutHard) {
      const counts = ALL_ROLES.map(
        r => `${r}: ${players.filter(p => getEffectiveRoles(p).includes(r)).length}`
      ).join(", ");
      addMsg(
        `No valid role assignment found with current role locks and must-play constraints (${counts})`
      );
    } else {
      addMsg("Could not generate valid teams — check pairing constraints and role locks");
    }
  }

  return messages.map(message => ({
    type: "impossible_composition",
    message,
    severity: "error",
  }));
}

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
    for (const role of getEffectiveRoles(player)) {
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

  // Phase 1b: Place multi-role-locked players before unlocked flexers
  for (const p of shuffled) {
    if (used.has(p.battletag)) continue;
    if (!p.lockedToRoles || p.lockedToRoles.length === 0) continue;
    if (tryPlacePlayer(p, needed, respectTeamLocks, team1, team2, mode)) {
      used.add(p.battletag);
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

  // Verify all slots filled and must-play constraints met; fall back to exact bipartite matching on tight flex lobbies
  for (const v of needed.values()) {
    if (v > 0) return findBipartiteInitialAssignment(players, mode, respectTeamLocks, mustPlayBattletags);
  }
  for (const bt of mustPlayBattletags) {
    if (!used.has(bt)) return findBipartiteInitialAssignment(players, mode, respectTeamLocks, mustPlayBattletags);
  }

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

      const lp1 = p1.player as LobbyPlayer, lp2 = p2.player as LobbyPlayer;
      if (!isRoleAllowed(lp1, p2.assignedRole)) continue;
      if (!isRoleAllowed(lp2, p1.assignedRole)) continue;
      
      // Team locks - only enforced if respectTeamLocks is true
      if (respectTeamLocks) {
        if (lp1.lockedToTeam === 1 || lp2.lockedToTeam === 2) continue;
      }

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

      const lp1a = p1a.player as LobbyPlayer, lp2a = p2a.player as LobbyPlayer;
      const lp1b = p1b.player as LobbyPlayer, lp2b = p2b.player as LobbyPlayer;

      if (!isRoleAllowed(lp1a, p2a.assignedRole)) continue;
      if (!isRoleAllowed(lp2a, p1a.assignedRole)) continue;
      if (!isRoleAllowed(lp1b, p2b.assignedRole)) continue;
      if (!isRoleAllowed(lp2b, p1b.assignedRole)) continue;
      
      // Team locks - only enforced if respectTeamLocks is true
      if (respectTeamLocks) {
        if (lp1a.lockedToTeam === 1 || lp2a.lockedToTeam === 2) continue;
        if (lp1b.lockedToTeam === 1 || lp2b.lockedToTeam === 2) continue;
      }

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
      if (!isRoleAllowed(benched, playing.assignedRole)) continue;

      // Team locks - only enforced if respectTeamLocks is true
      if (respectTeamLocks) {
        if ((playing.player as LobbyPlayer).lockedToTeam !== null) continue;
        if (benched.lockedToTeam !== null && benched.lockedToTeam !== teamNum) continue;
      }

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

      // Role locks - ALWAYS enforced (Bug #26 fix) - no team lock check needed for intra-team swap
      const lp1 = p1.player as LobbyPlayer, lp2 = p2.player as LobbyPlayer;
      if (!isRoleAllowed(lp1, p2.assignedRole)) continue;
      if (!isRoleAllowed(lp2, p1.assignedRole)) continue;

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
  if (!canFormValidTeams(activePlayers, mode).valid) {
    warnings.push(
      ...diagnoseCompositionFailure(activePlayers, new Set(), [], mode)
    );
    return {
      team1: [],
      team2: [],
      warnings,
      score: { team1SR: 0, team2SR: 0, srDifference: 0, archetypeParityMet: false },
    };
  }

  // Handle too many must-play players - prioritize those who sat out longest
  let mustPlayPlayers = activePlayers.filter((p) => p.mustPlay);
  const originalMustPlayCount = mustPlayPlayers.length;
  const hadMustPlayOverflow = mustPlayPlayers.length > requiredPlayers;
  
  if (hadMustPlayOverflow) {
    // Sort by priority first.
    // Note: mustPlayPriority levels are sorted 2 > 1 > 0:
    //   2 = sat out waiting / manual must-play (highest priority)
    //   1 = joined mid-match / returned from AFK (medium priority)
    //   0 = normal / played last game (lowest priority)
    const sortedByPriority = [...mustPlayPlayers].sort((a, b) => {
      const priorityDiff = b.mustPlayPriority - a.mustPlayPriority;
      if (priorityDiff !== 0) return priorityDiff;
      
      const satOutDiff = b.consecutiveSatOut - a.consecutiveSatOut;
      if (satOutDiff !== 0) return satOutDiff;
      
      // Tie-breaker: who joined the lobby first (earlier index in lobby array)
      const indexA = lobby.findIndex((p) => p.battletag === a.battletag);
      const indexB = lobby.findIndex((p) => p.battletag === b.battletag);
      return indexA - indexB;
    });

    // Helper to find first valid subset in lexicographical order of indices
    const findValidSubset = (
      players: LobbyPlayer[],
      neededSize: number
    ): LobbyPlayer[] | null => {
      if (neededSize === 0) return [];
      
      const result: LobbyPlayer[] = [];
      let iterations = 0;
      const maxIterations = 5000;
      
      const search = (startIndex: number): boolean => {
        iterations++;
        if (iterations > maxIterations) return false;

        if (result.length === neededSize) {
          return canFormValidTeams(result, mode).valid;
        }
        
        if (result.length + (players.length - startIndex) < neededSize) {
          return false;
        }
        
        for (let i = startIndex; i < players.length; i++) {
          result.push(players[i]);
          if (search(i + 1)) {
            return true;
          }
          result.pop();
        }
        
        return false;
      };
      
      if (search(0)) return result;
      return null;
    };

    // Find the largest valid subset of size <= requiredPlayers
    let keepMustPlay: Set<string> = new Set();
    for (let size = requiredPlayers; size >= 0; size--) {
      const subset = findValidSubset(sortedByPriority, size);
      if (subset) {
        keepMustPlay = new Set(subset.map((p) => p.battletag));
        break;
      }
    }
    
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
    activePlayers.filter((p) => p.lockedToTeam !== null || hasAnyRoleLock(p))
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
    warnings.push(
      ...diagnoseCompositionFailure(activePlayers, mustPlayBattletags, hardConstraints, mode)
    );

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
