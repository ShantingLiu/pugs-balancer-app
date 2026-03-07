// =============================================================================
// Mode Configuration - Defines game mode settings and rules
// =============================================================================

/**
 * Available game modes
 */
export type GameMode = "stadium_5v5" | "regular_5v5" | "regular_6v6";

/**
 * Composition rule for a game mode
 */
export interface CompositionRule {
  /** Fixed = exact counts required, Flexible = min/max ranges */
  type: "fixed" | "flexible";
  
  /** Tank requirements */
  tank: { min: number; max: number };
  
  /** DPS requirements */
  dps: { min: number; max: number };
  
  /** Support requirements */
  support: { min: number; max: number };
}

/**
 * Configuration for a game mode
 */
export interface ModeConfig {
  /** Unique identifier */
  id: GameMode;
  
  /** Display label */
  label: string;
  
  /** Number of players per team */
  teamSize: 5 | 6;
  
  /** Team composition rules */
  composition: CompositionRule;
  
  /** Whether to use Stadium ranks (true) or Regular comp ranks (false) */
  useStadiumRanks: boolean;
  
  /** Whether to check archetype parity (flyer vs hitscan) */
  checkArchetypes: boolean;
  
  /** Whether to check one-trick conflicts */
  checkOneTricks: boolean;
  
  /** Hero filter: "stadium" = only stadium-eligible, "all" = full roster */
  heroFilter: "stadium" | "all";
  
  /** Accent color name for theming */
  accentColor: "blue" | "emerald" | "orange";
}

/**
 * Mode configurations for all supported game modes
 */
export const MODE_CONFIGS: Record<GameMode, ModeConfig> = {
  stadium_5v5: {
    id: "stadium_5v5",
    label: "Stadium 5v5",
    teamSize: 5,
    composition: {
      type: "fixed",
      tank: { min: 1, max: 1 },
      dps: { min: 2, max: 2 },
      support: { min: 2, max: 2 },
    },
    useStadiumRanks: true,
    checkArchetypes: true,
    checkOneTricks: true,
    heroFilter: "stadium",
    accentColor: "blue",
  },
  
  regular_5v5: {
    id: "regular_5v5",
    label: "Regular 5v5",
    teamSize: 5,
    composition: {
      type: "fixed",
      tank: { min: 1, max: 1 },
      dps: { min: 2, max: 2 },
      support: { min: 2, max: 2 },
    },
    useStadiumRanks: false,
    checkArchetypes: false,  // Can switch heroes mid-match
    checkOneTricks: false,   // Can switch heroes mid-match
    heroFilter: "all",
    accentColor: "emerald",
  },
  
  regular_6v6: {
    id: "regular_6v6",
    label: "Regular 6v6",
    teamSize: 6,
    composition: {
      type: "fixed",
      tank: { min: 2, max: 2 },    // 2 Tanks
      dps: { min: 2, max: 2 },     // 2 DPS
      support: { min: 2, max: 2 }, // 2 Supports
    },
    useStadiumRanks: false,
    checkArchetypes: false,
    checkOneTricks: false,
    heroFilter: "all",
    accentColor: "orange",
  },
};

/**
 * Get configuration for a game mode
 */
export function getModeConfig(mode: GameMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * Get the required player count for a mode (both teams)
 */
export function getRequiredPlayers(mode: GameMode): number {
  return MODE_CONFIGS[mode].teamSize * 2;
}

/**
 * Check if a team composition is valid for a mode
 */
export function isValidComposition(
  roleCount: { Tank: number; DPS: number; Support: number },
  mode: GameMode
): boolean {
  const config = MODE_CONFIGS[mode];
  const rules = config.composition;
  const totalPlayers = roleCount.Tank + roleCount.DPS + roleCount.Support;
  
  return (
    totalPlayers === config.teamSize &&
    roleCount.Tank >= rules.tank.min &&
    roleCount.Tank <= rules.tank.max &&
    roleCount.DPS >= rules.dps.min &&
    roleCount.DPS <= rules.dps.max &&
    roleCount.Support >= rules.support.min &&
    roleCount.Support <= rules.support.max
  );
}

/**
 * Get valid compositions for a mode (for flexible modes like 6v6)
 */
export function getValidCompositions(mode: GameMode): Array<{ Tank: number; DPS: number; Support: number }> {
  const config = MODE_CONFIGS[mode];
  const compositions: Array<{ Tank: number; DPS: number; Support: number }> = [];
  
  if (config.composition.type === "fixed") {
    // Only one valid composition
    compositions.push({
      Tank: config.composition.tank.min,
      DPS: config.composition.dps.min,
      Support: config.composition.support.min,
    });
  } else {
    // Generate all valid combinations for flexible modes
    const rules = config.composition;
    for (let t = rules.tank.min; t <= rules.tank.max; t++) {
      for (let s = rules.support.min; s <= Math.min(rules.support.max, config.teamSize - t); s++) {
        const d = config.teamSize - t - s;
        if (d >= rules.dps.min && d <= rules.dps.max) {
          compositions.push({ Tank: t, DPS: d, Support: s });
        }
      }
    }
  }
  
  return compositions;
}
