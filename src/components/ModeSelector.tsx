import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Info } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";
import { MODE_CONFIGS } from "@engine/modeConfig";
import { useTheme } from "@hooks/useTheme";

// =============================================================================
// ModeSelector - Dropdown to switch between game modes
// =============================================================================

const MODE_OPTIONS: { id: GameMode; label: string; description: string }[] = [
  { id: "regular_5v5", label: "Regular 5v5", description: "Full hero roster, comp ranks" },
  { id: "regular_6v6", label: "Regular 6v6", description: "2-2-2 composition" },
  { id: "stadium_5v5", label: "Stadium 5v5", description: "Locked heroes, stadium ranks" },
];

export function ModeSelector() {
  const gameMode = useSessionStore((state) => state.gameMode);
  const setGameMode = useSessionStore((state) => state.setGameMode);
  const lastResult = useSessionStore((state) => state.lastResult);
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<GameMode | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentMode = MODE_CONFIGS[gameMode];
  const hasActiveSession = lastResult && lastResult.team1.length > 0;

  const handleModeSelect = (mode: GameMode) => {
    if (mode === gameMode) { setIsOpen(false); return; }
    if (hasActiveSession) { setShowConfirm(mode); setIsOpen(false); } else { setGameMode(mode); setIsOpen(false); }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Mode badge/pill */}
        <span className={`px-3 py-1 text-xs font-semibold rounded-pill ${theme.badge.bg} ${theme.badge.text}`}>
          {currentMode.label}
        </span>

        {/* Mode selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="app-secondary flex items-center gap-2 px-3.5 py-2 rounded-pill text-sm font-semibold"
          >
            <span>Change Mode</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-60 app-modal z-50 overflow-hidden">
              {MODE_OPTIONS.map((option) => {
                const isActive = option.id === gameMode;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => handleModeSelect(option.id)}
                    className={`w-full text-left px-4 py-3 border-b border-rule last:border-b-0 ${
                      isActive ? "bg-pink-soft" : "hover:bg-sky-soft"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isActive && <Check className="h-4 w-4 text-pink-ink shrink-0" aria-hidden="true" />}
                      <span className="font-semibold text-ink">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 ml-6">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 app-backdrop flex items-center justify-center z-50">
          <div className="app-modal p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-ink mb-2">Switch Game Mode?</h3>
            <p className="text-ink-2 text-sm mb-4">
              Switching to {MODE_CONFIGS[showConfirm].label} will reset your current session stats (wins, losses, adaptive weights).
            </p>
            <p className="flex items-start gap-2 text-sm text-pink-ink bg-pink-soft border border-pink-edge rounded-well p-3 mb-4">
              <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>Export your CSV first to save session wins before switching.</span>
            </p>
            <p className="text-muted text-sm mb-6">
              Your lobby players and imported roster will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(null)}
                className="app-secondary px-4 py-2 rounded-pill text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setGameMode(showConfirm); setShowConfirm(null); }}
                className="app-primary px-4 py-2 rounded-pill text-sm font-semibold"
              >
                Switch Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
