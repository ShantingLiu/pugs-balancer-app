import type { Role, LobbyPlayer, GameMode } from "@engine/types";
import ranksConfig from "@config/ranks.json";

// =============================================================================
// Rank → SR Conversion for PUGs Balancer
// =============================================================================

type StadiumRankTier = keyof typeof ranksConfig.stadium;
type CompetitiveRankTier = keyof typeof ranksConfig.competitive;

/**
 * Parse a rank string into tier and sub-rank
 * Examples: "Pro 2" → { tier: "Pro", subRank: 2 }
 *           "Elite" → { tier: "Elite", subRank: 3 } (default)
 */
function parseRank(rank: string): { tier: string; subRank: number } {
  const match = rank.trim().match(/^([\w-]+)(?:\s+(\d))?$/);
  if (!match) {
    throw new Error(`Invalid rank format: ${rank}`);
  }

  const tier = match[1];
  const subRank = match[2]
    ? parseInt(match[2], 10)
    : ranksConfig.defaultSubRank;

  // Validate sub-rank range
  if (subRank < 1 || subRank > 5) {
    throw new Error(`Sub-rank must be 1-5, got: ${subRank}`);
  }

  return { tier, subRank };
}

/**
 * Convert a Stadium rank string to SR value
 * Formula: SR = base_SR + (5 - sub_rank) * 100
 *
 * @param rank - Stadium rank string (e.g., "Pro 2", "Elite", "Legend 1")
 * @returns SR value
 * @throws Error if rank tier is unknown
 */
export function rankToSR(rank: string): number {
  const { tier, subRank } = parseRank(rank);

  const baseSR = ranksConfig.stadium[tier as StadiumRankTier];
  if (baseSR === undefined) {
    throw new Error(`Unknown Stadium rank tier: ${tier}`);
  }

  // Sub-rank 1 = highest (e.g., Pro 1 = 3400), Sub-rank 5 = lowest (Pro 5 = 3000)
  return baseSR + (5 - subRank) * ranksConfig.subRankMultiplier;
}

/**
 * Convert a regular competitive rank to Stadium SR equivalent
 * Used as fallback when Stadium rank is unavailable
 *
 * @param rank - Competitive rank string (e.g., "Diamond 3", "Master")
 * @returns SR value
 * @throws Error if rank tier is unknown
 */
export function competitiveRankToSR(rank: string): number {
  const { tier, subRank } = parseRank(rank);

  const baseSR = ranksConfig.competitive[tier as CompetitiveRankTier];
  if (baseSR === undefined) {
    throw new Error(`Unknown competitive rank tier: ${tier}`);
  }

  // Apply same sub-rank formula
  return baseSR + (5 - subRank) * ranksConfig.subRankMultiplier;
}

type PlayerRankFields = {
  tankRank: string | null;
  dpsRank: string | null;
  supportRank: string | null;
  tankCompRank?: string | null;
  dpsCompRank?: string | null;
  supportCompRank?: string | null;
  tank6v6Rank?: string | null;
  dps6v6Rank?: string | null;
  support6v6Rank?: string | null;
  regularCompRank: string | null;
  regular6v6Rank?: string | null;
};

type RoleRankCandidate = {
  rank: string | null | undefined;
  isStadium: boolean;
};

function getRoleCandidates(
  player: PlayerRankFields,
  role: Role,
  mode: GameMode
): RoleRankCandidate[] {
  const stadiumRank =
    role === "Tank" ? player.tankRank : role === "DPS" ? player.dpsRank : player.supportRank;
  const compRank =
    role === "Tank" ? player.tankCompRank : role === "DPS" ? player.dpsCompRank : player.supportCompRank;
  const rank6v6 =
    role === "Tank" ? player.tank6v6Rank : role === "DPS" ? player.dps6v6Rank : player.support6v6Rank;

  if (mode === "stadium_5v5") {
    return [
      { rank: stadiumRank, isStadium: true },
      { rank: compRank, isStadium: false },
      { rank: rank6v6, isStadium: false },
      { rank: player.regularCompRank, isStadium: false },
      { rank: player.regular6v6Rank, isStadium: false },
    ];
  }

  if (mode === "regular_6v6") {
    return [
      { rank: rank6v6, isStadium: false },
      { rank: player.regular6v6Rank, isStadium: false },
      { rank: compRank, isStadium: false },
      { rank: player.regularCompRank, isStadium: false },
      { rank: stadiumRank, isStadium: true },
    ];
  }

  return [
    { rank: compRank, isStadium: false },
    { rank: player.regularCompRank, isStadium: false },
    { rank: rank6v6, isStadium: false },
    { rank: player.regular6v6Rank, isStadium: false },
    { rank: stadiumRank, isStadium: true },
  ];
}

/**
 * Get the SR for a player's rank in a specific role.
 * Mode-aware across all three rank sets: Stadium, Regular 5v5, and Regular 6v6.
 */
export function getRoleRankSR(
  player: PlayerRankFields,
  role: Role,
  mode: GameMode = "stadium_5v5"
): number | null {
  for (const { rank, isStadium } of getRoleCandidates(player, role, mode)) {
    if (!rank) continue;
    try {
      return isStadium ? rankToSR(rank) : competitiveRankToSR(rank);
    } catch {
      // Invalid rank format, fall through to next priority candidate
    }
  }
  return null;
}

/**
 * Get the rank display string for a player in a specific role (mode-aware).
 */
export function getRoleRankDisplay(
  player: PlayerRankFields,
  role: Role,
  mode: GameMode = "stadium_5v5"
): string | null {
  for (const { rank } of getRoleCandidates(player, role, mode)) {
    if (rank) return rank;
  }
  return null;
}

/**
 * Get the effective SR for a player in a specific role
 * Includes weight modifier and temporary overrides
 *
 * @param player - LobbyPlayer with session state
 * @param role - Role to calculate SR for
 * @param mode - Game mode (defaults to stadium_5v5 for backward compatibility)
 * @returns Effective SR value (with modifiers applied)
 */
export function getEffectiveSR(player: LobbyPlayer, role: Role, mode: GameMode = "stadium_5v5"): number {
  // Get base SR from rank (mode-aware)
  const baseSR = getRoleRankSR(player, role, mode);

  // Use default SR if no rank available
  const sr = baseSR ?? ranksConfig.defaultSR;

  // Apply modifier: temp override takes precedence over permanent modifier
  const manualModifier = player.tempWeightOverride ?? player.weightModifier;

  // Include adaptive weight (from match scores)
  const adaptiveModifier = player.adaptiveWeight ?? 0;

  return sr + manualModifier + adaptiveModifier;
}

/**
 * Get display-friendly SR for a player (uses their preferred role)
 * 
 * @param player - Player with rank data
 * @param mode - Game mode (defaults to stadium_5v5)
 */
export function getDisplaySR(
  player: PlayerRankFields & { rolePreference: Role[] },
  mode: GameMode = "stadium_5v5"
): number {
  // Use first preferred role
  const preferredRole = player.rolePreference[0] || "DPS";
  const sr = getRoleRankSR(player, preferredRole, mode);
  return sr ?? ranksConfig.defaultSR;
}

/**
 * Stadium rank tiers in order from lowest to highest
 */
const STADIUM_TIERS: StadiumRankTier[] = [
  "Rookie",
  "Novice", 
  "Contender",
  "Elite",
  "Pro",
  "All-Star",
  "Legend",
];

/**
 * Competitive rank tiers in order from lowest to highest
 */
const COMPETITIVE_TIERS: CompetitiveRankTier[] = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Champion",
];

/**
 * Convert an SR value back to a Stadium rank display string
 * 
 * @param sr - SR value (e.g., 3200)
 * @returns Rank string (e.g., "Pro 3")
 */
export function srToRank(sr: number): string {
  // Clamp SR to valid range
  const clampedSR = Math.max(1000, Math.min(4400, sr));
  
  // Find the appropriate tier
  let tier: StadiumRankTier = "Rookie";
  for (const t of STADIUM_TIERS) {
    if (clampedSR >= ranksConfig.stadium[t]) {
      tier = t;
    }
  }
  
  const baseSR = ranksConfig.stadium[tier];
  const srAboveBase = clampedSR - baseSR;
  
  // Sub-rank: 5 = base, 4 = +100, 3 = +200, 2 = +300, 1 = +400
  // Formula: subRank = 5 - floor(srAboveBase / 100)
  const subRank = Math.max(1, 5 - Math.floor(srAboveBase / ranksConfig.subRankMultiplier));
  
  return `${tier} ${subRank}`;
}

/**
 * Convert an SR value back to a Competitive rank display string
 * 
 * @param sr - SR value (e.g., 3200)
 * @returns Rank string (e.g., "Diamond 3")
 */
export function srToCompetitiveRank(sr: number): string {
  // Clamp SR to valid range (Bronze 5 = 1000 .. Champion 1 = 5400)
  const clampedSR = Math.max(1000, Math.min(5400, sr));
  
  // Find the appropriate tier
  let tier: CompetitiveRankTier = "Bronze";
  for (const t of COMPETITIVE_TIERS) {
    if (clampedSR >= ranksConfig.competitive[t]) {
      tier = t;
    }
  }
  
  const baseSR = ranksConfig.competitive[tier];
  const srAboveBase = clampedSR - baseSR;
  
  // Sub-rank: 5 = base, 4 = +100, 3 = +200, 2 = +300, 1 = +400
  // Formula: subRank = 5 - floor(srAboveBase / 100)
  const subRank = Math.max(1, 5 - Math.floor(srAboveBase / ranksConfig.subRankMultiplier));
  
  return `${tier} ${subRank}`;
}

/**
 * Convert an SR value to a rank string for the specified game mode
 * 
 * @param sr - SR value
 * @param mode - Game mode (stadium_5v5 uses Stadium ranks, others use Competitive)
 * @returns Rank string appropriate for the mode
 */
export function srToRankForMode(sr: number, mode: GameMode = "stadium_5v5"): string {
  if (mode === "stadium_5v5") {
    return srToRank(sr);
  }
  return srToCompetitiveRank(sr);
}

/**
 * Format SR for display - shows both rank and SR
 * 
 * @param sr - SR value
 * @param mode - Optional game mode for rank system selection
 * @returns Display string like "Pro 3 (3200)" or "Diamond 3 (3200)"
 */
export function formatSRDisplay(sr: number, mode: GameMode = "stadium_5v5"): string {
  return `${srToRankForMode(sr, mode)} (${sr.toLocaleString()})`;
}

/**
 * Get just the rank display without SR number
 * 
 * @param sr - SR value
 * @param mode - Optional game mode for rank system selection
 * @returns Rank string like "Pro 3" or "Diamond 3"
 */
export function formatRankOnly(sr: number, mode: GameMode = "stadium_5v5"): string {
  return srToRankForMode(sr, mode);
}
