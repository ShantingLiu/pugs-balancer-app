import { useState, useRef, useEffect } from "react";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";
import { MODE_CONFIGS } from "@engine/modeConfig";
import { getTheme } from "@config/themes";

// =============================================================================
// ModeSelector - Dropdown to switch between game modes
// =============================================================================

const MODE_OPTIONS: { id: GameMode; label: string; description: string; icon: string }[] = [
  { id: "regular_5v5", label: "Regular 5v5", description: "Full hero roster, comp ranks", icon: "🎮" },
  { id: "regular_6v6", label: "Regular 6v6", description: "2-2-2 composition", icon: "⚔️" },
  { id: "stadium_5v5", label: "Stadium 5v5", description: "Locked heroes, stadium ranks", icon: "🏟️" },
];

export function ModeSelector() {
  const gameMode = useSessionStore((state) => state.gameMode);
  const setGameMode = useSessionStore((state) => state.setGameMode);
  const lastResult = useSessionStore((state) => state.lastResult);
  const theme = getTheme(gameMode);
  
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<GameMode | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
  const currentOption = MODE_OPTIONS.find(o => o.id === gameMode);
  const hasActiveSession = lastResult && lastResult.team1.length > 0;

  const handleModeSelect = (mode: GameMode) => {
    if (mode === gameMode) {
      setIsOpen(false);
      return;
    }

    // If there's an active session, show confirmation
    if (hasActiveSession) {
      setShowConfirm(mode);
      setIsOpen(false);
    } else {
      setGameMode(mode);
      setIsOpen(false);
    }
  };

  const handleConfirmSwitch = () => {
    if (showConfirm) {
      setGameMode(showConfirm);
      setShowConfirm(null);
    }
  };

  const handleCancelSwitch = () => {
    setShowConfirm(null);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Mode badge/pill */}
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${theme.badge.bg} ${theme.badge.text}`}>
          {currentOption?.icon} {currentMode.label}
        </span>

        {/* Mode selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          {/* Current mode button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
              transition-colors
              ${theme.accent.bg} ${theme.accent.bgHover}
            `}
          >
            <span>Change Mode</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
              {MODE_OPTIONS.map((option) => {
                const isActive = option.id === gameMode;
                const optionTheme = getTheme(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => handleModeSelect(option.id)}
                    className={`
                      w-full text-left px-4 py-3 first:rounded-t-lg last:rounded-b-lg
                      transition-colors
                      ${isActive ? "bg-gray-700" : "hover:bg-gray-700/50"}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{option.icon}</span>
                      {isActive && (
                        <svg className={`w-4 h-4 ${optionTheme.accent.text}`} fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className={`font-medium ${isActive ? "text-white" : "text-gray-300"}`}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-7">
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
      {showConfirm && (() => {
        const confirmTheme = getTheme(showConfirm);
        const confirmOption = MODE_OPTIONS.find(o => o.id === showConfirm);
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl border border-gray-700">
              <h3 className="text-lg font-semibold mb-2">Switch Game Mode?</h3>
              <p className="text-gray-400 mb-4">
                Switching to <span className={`font-medium ${confirmTheme.accent.text}`}>{confirmOption?.icon} {MODE_CONFIGS[showConfirm].label}</span> will 
                reset your current session stats (wins, losses, adaptive weights).
              </p>
              <p className="text-amber-400/80 text-sm mb-4">
                💡 Tip: Export your CSV first to save session wins before switching.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Your lobby players and imported roster will be preserved.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelSwitch}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwitch}
                  className={`px-4 py-2 rounded-lg transition-colors font-medium ${confirmTheme.accent.bg} ${confirmTheme.accent.bgHover}`}
                >
                  Switch Mode
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
