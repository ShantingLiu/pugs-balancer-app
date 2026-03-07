import type { Role, LobbyPlayer, GameMode } from "@engine/types";
import { getModeConfig } from "@engine/modeConfig";
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

/**
 * Get the SR for a player's rank in a specific role
 * Mode-aware: Stadium mode uses stadium ranks first, Regular mode uses comp ranks first
 *
 * @param player - Player or LobbyPlayer
 * @param role - Role to get SR for
 * @param mode - Game mode (defaults to stadium_5v5 for backward compatibility)
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
  role: Role,
  mode: GameMode = "stadium_5v5"
): number | null {
  const modeConfig = getModeConfig(mode);
  
  // Get role-specific ranks
  const stadiumRank =
    role === "Tank"
      ? player.tankRank
      : role === "DPS"
        ? player.dpsRank
        : player.supportRank;

  const compRank =
    role === "Tank"
      ? player.tankCompRank
      : role === "DPS"
        ? player.dpsCompRank
        : player.supportCompRank;

  if (modeConfig.useStadiumRanks) {
    // Stadium mode: Stadium rank → comp rank → global fallback
    if (stadiumRank) {
      try {
        return rankToSR(stadiumRank);
      } catch {
        // Invalid rank format, fall through
      }
    }

    if (compRank) {
      try {
        return competitiveRankToSR(compRank);
      } catch {
        // Invalid rank format, fall through
      }
    }
  } else {
    // Regular mode: Comp rank → Stadium rank (as fallback) → global fallback
    if (compRank) {
      try {
        return competitiveRankToSR(compRank);
      } catch {
        // Invalid rank format, fall through
      }
    }

    // Use Stadium rank as fallback in regular mode (better than nothing)
    if (stadiumRank) {
      try {
        return rankToSR(stadiumRank);
      } catch {
        // Invalid rank format, fall through
      }
    }
  }

  // Global regular comp rank as final fallback
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
 * Get the rank display string for a player in a specific role (mode-aware)
 * Returns the appropriate rank string based on game mode preferences.
 *
 * @param player - Player object
 * @param role - Role to get rank for
 * @param mode - Game mode (defaults to stadium_5v5)
 * @returns Rank string or null if not available
 */
export function getRoleRankDisplay(
  player: { 
    tankRank: string | null; 
    dpsRank: string | null; 
    supportRank: string | null; 
    tankCompRank?: string | null;
    dpsCompRank?: string | null;
    supportCompRank?: string | null;
    regularCompRank: string | null;
  },
  role: Role,
  mode: GameMode = "stadium_5v5"
): string | null {
  const modeConfig = getModeConfig(mode);
  
  // Get role-specific ranks
  const stadiumRank =
    role === "Tank"
      ? player.tankRank
      : role === "DPS"
        ? player.dpsRank
        : player.supportRank;

  const compRank =
    role === "Tank"
      ? player.tankCompRank
      : role === "DPS"
        ? player.dpsCompRank
        : player.supportCompRank;

  if (modeConfig.useStadiumRanks) {
    // Stadium mode: Stadium rank → comp rank → global fallback
    return stadiumRank || compRank || player.regularCompRank || null;
  } else {
    // Regular mode: comp rank → global fallback → stadium rank
    return compRank || player.regularCompRank || stadiumRank || null;
  }
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
  player: { 
    tankRank: string | null; 
    dpsRank: string | null; 
    supportRank: string | null;
    tankCompRank?: string | null;
    dpsCompRank?: string | null;
    supportCompRank?: string | null;
    regularCompRank: string | null; 
    rolePreference: Role[];
  },
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
  // Clamp SR to valid range
  const clampedSR = Math.max(1000, Math.min(4900, sr));
  
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
