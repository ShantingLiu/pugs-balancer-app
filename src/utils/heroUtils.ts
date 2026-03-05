// =============================================================================
// Utility Functions for Player/Hero Display
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
