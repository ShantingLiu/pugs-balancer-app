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
 * Theme configurations for all supported game modes (mapped to Hallmark pastel tokens)
 */
export const MODE_THEMES: Record<GameMode, ModeTheme> = {
  stadium_5v5: {
    id: "stadium_5v5",
    accent: {
      bg: "bg-sky",
      bgHover: "hover:bg-sky-hover",
      bgActive: "",
      text: "text-sky-ink",
      border: "border-sky-edge",
    },
    primary: {
      bg: "app-primary",
      bgHover: "",
      bgActive: "",
    },
    secondary: {
      bg: "app-sky",
      bgHover: "",
      bgActive: "",
    },
    header: {
      bg: "bg-paper-2",
      border: "border-sky-edge",
    },
    badge: {
      bg: "bg-sky-soft border border-sky-edge",
      text: "text-sky-ink",
    },
  },

  regular_5v5: {
    id: "regular_5v5",
    accent: {
      bg: "bg-sup-soft",
      bgHover: "",
      bgActive: "",
      text: "text-sup",
      border: "border-sup-edge",
    },
    primary: {
      bg: "app-primary",
      bgHover: "",
      bgActive: "",
    },
    secondary: {
      bg: "app-sky",
      bgHover: "",
      bgActive: "",
    },
    header: {
      bg: "bg-paper-2",
      border: "border-sup-edge",
    },
    badge: {
      bg: "bg-sup-soft border border-sup-edge",
      text: "text-sup",
    },
  },

  regular_6v6: {
    id: "regular_6v6",
    accent: {
      bg: "bg-pink-soft",
      bgHover: "",
      bgActive: "",
      text: "text-pink-ink",
      border: "border-pink-edge",
    },
    primary: {
      bg: "app-primary",
      bgHover: "",
      bgActive: "",
    },
    secondary: {
      bg: "app-sky",
      bgHover: "",
      bgActive: "",
    },
    header: {
      bg: "bg-paper-2",
      border: "border-pink-edge",
    },
    badge: {
      bg: "bg-pink-soft border border-pink-edge",
      text: "text-pink-ink",
    },
  },
};

/**
 * Get theme for a specific game mode
 */
export function getTheme(mode: GameMode): ModeTheme {
  return MODE_THEMES[mode];
}
