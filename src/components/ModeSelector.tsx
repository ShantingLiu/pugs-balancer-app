import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Info } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";
import { MODE_CONFIGS } from "@engine/modeConfig";

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
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<GameMode | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentMode = MODE_CONFIGS[gameMode];
  const hasActiveSession = lastResult && lastResult.team1.length > 0;

  const handleModeSelect = (mode: GameMode) => {
    if (mode === gameMode) {
      setIsOpen(false);
      return;
    }
    if (hasActiveSession) {
      setShowConfirm(mode);
      setIsOpen(false);
    } else {
      setGameMode(mode);
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Mode badge/pill */}
        <span className="px-2.5 py-1 text-xs font-medium app-badge">
          {currentMode.label}
        </span>

        {/* Mode selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="app-secondary flex items-center gap-2 px-3 py-2 text-sm font-medium"
          >
            <span>Change Mode</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 app-modal z-50 overflow-hidden">
              {MODE_OPTIONS.map((option) => {
                const isActive = option.id === gameMode;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleModeSelect(option.id)}
                    className={`
                      w-full text-left px-4 py-3 border-b border-[var(--color-rule)] last:border-b-0 transition-colors
                      ${
                        isActive
                          ? "bg-[var(--color-accent-soft)]"
                          : "hover:bg-[var(--color-paper-2)]"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      {isActive && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
                      <span className="font-medium text-ink">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted mt-1 ml-6">{option.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
          onClick={() => setShowConfirm(null)}
        >
          <div
            className="app-modal p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 text-ink">Switch Game Mode?</h3>
            <p className="text-muted mb-4">
              Switching to {MODE_CONFIGS[showConfirm].label} will reset your current session stats
              (wins, losses, adaptive weights).
            </p>
            <p className="flex items-start gap-2 text-sm text-accent mb-4">
              <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>Export your CSV first to save session wins before switching.</span>
            </p>
            <p className="text-muted text-sm mb-6">
              Your lobby players and imported roster will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                className="app-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setGameMode(showConfirm);
                  setShowConfirm(null);
                }}
                className="app-primary px-4 py-2 font-medium"
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
