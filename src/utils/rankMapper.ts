import type { Role, LobbyPlayer } from "@engine/types";
import ranksConfig from "@config/ranks.json";

// =============================================================================
// Rank → SR Conversion for Stadium PUGs Balancer
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

/**
 * Get the SR for a player's rank in a specific role
 *
 * @param player - Player or LobbyPlayer
 * @param role - Role to get SR for
 * @returns SR value or null if no rank available
 */
export function getRoleRankSR(
  player: { 
    tankRank: string | null; 
    dpsRank: string | null; 
    supportRank: string | null; 
    tankCompRank?: string | null;
    dpsCompRank?: string | null;
    supportCompRank?: string | null;
    regularCompRank: string | null;
  },
  role: Role
): number | null {
  // Get role-specific Stadium rank
  const roleRank =
    role === "Tank"
      ? player.tankRank
      : role === "DPS"
        ? player.dpsRank
        : player.supportRank;

  if (roleRank) {
    try {
      return rankToSR(roleRank);
    } catch {
      // Invalid rank format, fall through to fallback
    }
  }

  // Try role-specific comp rank as first fallback
  const roleCompRank =
    role === "Tank"
      ? player.tankCompRank
      : role === "DPS"
        ? player.dpsCompRank
        : player.supportCompRank;

  if (roleCompRank) {
    try {
      return competitiveRankToSR(roleCompRank);
    } catch {
      // Invalid rank format, fall through
    }
  }

  // Try global regular comp rank as final fallback
  if (player.regularCompRank) {
    try {
      return competitiveRankToSR(player.regularCompRank);
    } catch {
      // Invalid rank format, return null
    }
  }

  return null;
}

/**
 * Get the effective SR for a player in a specific role
 * Includes weight modifier and temporary overrides
 *
 * @param player - LobbyPlayer with session state
 * @param role - Role to calculate SR for
 * @returns Effective SR value (with modifiers applied)
 */
export function getEffectiveSR(player: LobbyPlayer, role: Role): number {
  // Get base SR from rank
  const baseSR = getRoleRankSR(player, role);

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
 */
export function getDisplaySR(
  player: { 
    tankRank: string | null; 
    dpsRank: string | null; 
    supportRank: string | null;
    tankCompRank?: string | null;
    dpsCompRank?: string | null;
    supportCompRank?: string | null;
    regularCompRank: string | null; 
    rolePreference: Role[];
  }
): number {
  // Use first preferred role
  const preferredRole = player.rolePreference[0] || "DPS";
  const sr = getRoleRankSR(player, preferredRole);
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
 * Format SR for display - shows both rank and SR
 * 
 * @param sr - SR value
 * @returns Display string like "Pro 3 (3200)"
 */
export function formatSRDisplay(sr: number): string {
  return `${srToRank(sr)} (${sr.toLocaleString()})`;
}

/**
 * Get just the rank display without SR number
 * 
 * @param sr - SR value
 * @returns Rank string like "Pro 3"
 */
export function formatRankOnly(sr: number): string {
  return srToRank(sr);
}
