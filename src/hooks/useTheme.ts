// =============================================================================
// useTheme - Hook for accessing current mode theme
// =============================================================================

import { useSessionStore } from "@store/sessionStore";
import { getTheme, type ModeTheme } from "@config/themes";

/**
 * Hook that returns the current mode's theme configuration.
 * 
 * @returns The theme for the current game mode
 * 
 * @example
 * const theme = useTheme();
 * <button className={`${theme.primary.bg} ${theme.primary.bgHover}`}>
 *   Balance Teams
 * </button>
 */
export function useTheme(): ModeTheme {
  const gameMode = useSessionStore((state) => state.gameMode);
  return getTheme(gameMode);
}

/**
 * Helper to combine theme classes with conditional logic
 */
export function themeClasses(
  theme: ModeTheme,
  category: keyof ModeTheme,
  extras?: string
): string {
  const categoryTheme = theme[category];
  if (typeof categoryTheme !== "object") return extras ?? "";
  
  const classes = Object.values(categoryTheme).filter(Boolean).join(" ");
  return extras ? `${classes} ${extras}` : classes;
}
