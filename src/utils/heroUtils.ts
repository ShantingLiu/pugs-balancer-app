// =============================================================================
// Utility Functions for Player/Hero Display
// =============================================================================

import heroesConfig from "@config/heroes.json";
import type { GameMode, Role } from "@engine/types";
import { getModeConfig } from "@engine/modeConfig";

/**
 * Hero entry from the heroes config
 */
interface HeroEntry {
  role: Role;
  stadiumEligible: boolean;
}

type HeroesMap = Record<string, HeroEntry>;

const heroes = heroesConfig.heroes as HeroesMap;

// =============================================================================
// Hero Pool Functions
// =============================================================================

/**
 * Get all hero names in the game
 */
export function getAllHeroes(): string[] {
  return Object.keys(heroes);
}

/**
 * Get only stadium-eligible heroes
 */
export function getStadiumHeroes(): string[] {
  return Object.entries(heroes)
    .filter(([, entry]) => entry.stadiumEligible)
    .map(([name]) => name);
}

/**
 * Get heroes available for a specific game mode
 * 
 * @param mode - Game mode to filter for
 * @returns Array of hero names available in that mode
 */
export function getHeroesForMode(mode: GameMode): string[] {
  const modeConfig = getModeConfig(mode);
  
  if (modeConfig.heroFilter === "stadium") {
    return getStadiumHeroes();
  }
  
  return getAllHeroes();
}

/**
 * Get all heroes for a specific role
 * 
 * @param role - Role to filter by
 * @returns Array of hero names for that role
 */
export function getHeroesByRole(role: Role): string[] {
  return Object.entries(heroes)
    .filter(([, entry]) => entry.role === role)
    .map(([name]) => name);
}

/**
 * Get heroes for a specific role in a specific mode
 * 
 * @param role - Role to filter by
 * @param mode - Game mode to filter for
 * @returns Array of hero names for that role in that mode
 */
export function getHeroesForRoleAndMode(role: Role, mode: GameMode): string[] {
  const modeConfig = getModeConfig(mode);
  
  return Object.entries(heroes)
    .filter(([, entry]) => {
      if (entry.role !== role) return false;
      if (modeConfig.heroFilter === "stadium" && !entry.stadiumEligible) return false;
      return true;
    })
    .map(([name]) => name);
}

/**
 * Check if a hero exists in the config
 */
export function isKnownHero(hero: string): boolean {
  return hero in heroes;
}

/**
 * Check if a hero is eligible for stadium mode
 */
export function isStadiumEligible(hero: string): boolean {
  const entry = heroes[hero];
  return entry?.stadiumEligible ?? false;
}

/**
 * Get the role of a hero
 */
export function getHeroRole(hero: string): Role | null {
  const entry = heroes[hero];
  return entry?.role ?? null;
}

/**
 * Get hero counts per role
 */
export function getHeroCounts(): { total: number; Tank: number; DPS: number; Support: number; stadiumEligible: number } {
  const all = getAllHeroes();
  const stadium = getStadiumHeroes();
  
  return {
    total: all.length,
    Tank: getHeroesByRole("Tank").length,
    DPS: getHeroesByRole("DPS").length,
    Support: getHeroesByRole("Support").length,
    stadiumEligible: stadium.length,
  };
}

// =============================================================================
// Battletag Functions
// =============================================================================

/**
 * Parse a battletag into name and discriminator parts
 * Handles both "Name#1234" and just "Name" formats
 */
export function parseBattletag(battletag: string): { name: string; discriminator: string | null } {
  const hashIndex = battletag.indexOf("#");
  if (hashIndex === -1) {
    return { name: battletag, discriminator: null };
  }
  return {
    name: battletag.substring(0, hashIndex),
    discriminator: battletag.substring(hashIndex + 1),
  };
}

/**
 * Get just the display name from a battletag
 */
export function getDisplayName(battletag: string): string {
  return parseBattletag(battletag).name;
}
