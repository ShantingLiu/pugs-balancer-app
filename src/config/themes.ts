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

/**
 * Theme configurations for all supported game modes
 */
export const MODE_THEMES: Record<GameMode, ModeTheme> = {
  stadium_5v5: {
    id: "stadium_5v5",
    accent: {
      bg: "bg-blue-600",
      bgHover: "hover:bg-blue-700",
      bgActive: "active:bg-blue-800",
      text: "text-blue-400",
      border: "border-blue-500",
    },
    primary: {
      bg: "bg-blue-600",
      bgHover: "hover:bg-blue-700",
      bgActive: "active:bg-blue-800",
    },
    secondary: {
      bg: "bg-blue-600",
      bgHover: "hover:bg-blue-700",
      bgActive: "active:bg-blue-800",
    },
    header: {
      bg: "bg-gray-800",
      border: "border-blue-500/30",
    },
    badge: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
    },
  },

  regular_5v5: {
    id: "regular_5v5",
    accent: {
      bg: "bg-emerald-600",
      bgHover: "hover:bg-emerald-700",
      bgActive: "active:bg-emerald-800",
      text: "text-emerald-400",
      border: "border-emerald-500",
    },
    primary: {
      bg: "bg-emerald-600",
      bgHover: "hover:bg-emerald-700",
      bgActive: "active:bg-emerald-800",
    },
    secondary: {
      bg: "bg-emerald-600",
      bgHover: "hover:bg-emerald-700",
      bgActive: "active:bg-emerald-800",
    },
    header: {
      bg: "bg-gray-800",
      border: "border-emerald-500/30",
    },
    badge: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-400",
    },
  },

  regular_6v6: {
    id: "regular_6v6",
    accent: {
      bg: "bg-orange-600",
      bgHover: "hover:bg-orange-700",
      bgActive: "active:bg-orange-800",
      text: "text-orange-400",
      border: "border-orange-500",
    },
    primary: {
      bg: "bg-orange-600",
      bgHover: "hover:bg-orange-700",
      bgActive: "active:bg-orange-800",
    },
    secondary: {
      bg: "bg-orange-600",
      bgHover: "hover:bg-orange-700",
      bgActive: "active:bg-orange-800",
    },
    header: {
      bg: "bg-gray-800",
      border: "border-orange-500/30",
    },
    badge: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
    },
  },
};

/**
 * Get theme for a specific game mode
 */
export function getTheme(mode: GameMode): ModeTheme {
  return MODE_THEMES[mode];
}
