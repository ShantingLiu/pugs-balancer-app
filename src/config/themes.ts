// =============================================================================
// Theme Configuration - Visual theming for game modes
// =============================================================================

import type { GameMode } from "@engine/types";

/**
 * Color configuration for a mode theme
 */
export interface ModeTheme {
  /** Mode identifier */
  id: GameMode;

  /** Primary accent color - used for mode selector, headers */
  accent: {
    bg: string;
    bgHover: string;
    bgActive: string;
    text: string;
    border: string;
  };

  /** Primary action button - Balance/Reshuffle */
  primary: {
    bg: string;
    bgHover: string;
    bgActive: string;
  };

  /** Secondary action buttons - Team Won, etc. */
  secondary: {
    bg: string;
    bgHover: string;
    bgActive: string;
  };

  /** Header styling */
  header: {
    bg: string;
    border: string;
  };

  /** Badge/indicator styling */
  badge: {
    bg: string;
    text: string;
  };
}

const ULTRAVIOLET_THEME_BASE: Omit<ModeTheme, "id"> = {
  accent: {
    bg: "app-primary",
    bgHover: "",
    bgActive: "",
    text: "text-accent",
    border: "border-[var(--color-rule-2)]",
  },
  primary: {
    bg: "app-primary",
    bgHover: "",
    bgActive: "",
  },
  secondary: {
    bg: "app-secondary",
    bgHover: "",
    bgActive: "",
  },
  header: {
    bg: "app-toolbar",
    border: "border-[var(--color-rule)]",
  },
  badge: {
    bg: "bg-accent-soft",
    text: "text-accent",
  },
};

/**
 * Theme configurations for all supported game modes
 */
export const MODE_THEMES: Record<GameMode, ModeTheme> = {
  stadium_5v5: {
    id: "stadium_5v5",
    ...ULTRAVIOLET_THEME_BASE,
  },
  regular_5v5: {
    id: "regular_5v5",
    ...ULTRAVIOLET_THEME_BASE,
  },
  regular_6v6: {
    id: "regular_6v6",
    ...ULTRAVIOLET_THEME_BASE,
  },
};

/**
 * Get theme for a specific game mode
 */
export function getTheme(mode: GameMode): ModeTheme {
  return MODE_THEMES[mode];
}
