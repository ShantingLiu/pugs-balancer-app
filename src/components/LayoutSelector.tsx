import { useState, useRef, useEffect } from "react";
import { LayoutGrid, ChevronDown, Check } from "lucide-react";
import { useSessionStore, type LayoutMode } from "@store/sessionStore";

// =============================================================================
// LayoutSelector - Dropdown to switch workspace layouts
// =============================================================================

const LAYOUT_OPTIONS: { id: LayoutMode; label: string; description: string }[] = [
  {
    id: "sidebar-left",
    label: "Sidebar Left",
    description: "Lobby on left, teams & stats on right",
  },
  {
    id: "teams-left",
    label: "Teams Left",
    description: "Teams & stats on left, lobby on right",
  },
  {
    id: "wide-teams",
    label: "Wide Teams",
    description: "Full-width teams on top, lobby & stats below",
  },
  {
    id: "three-col",
    label: "Three Column",
    description: "Lobby, teams, and stats side by side",
  },
];

export function LayoutSelector() {
  const layoutMode = useSessionStore((state) => state.layoutMode);
  const setLayoutMode = useSessionStore((state) => state.setLayoutMode);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const currentLayout =
    LAYOUT_OPTIONS.find((opt) => opt.id === layoutMode) ?? LAYOUT_OPTIONS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={`Layout: ${currentLayout.label}`}
        className="app-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-sm font-semibold"
      >
        <LayoutGrid className="h-4 w-4 text-pink-ink" aria-hidden="true" />
        <span>{currentLayout.label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Workspace layout"
          className="absolute right-0 mt-2 w-64 app-modal z-50 overflow-hidden"
        >
          {LAYOUT_OPTIONS.map((option) => {
            const isActive = option.id === layoutMode;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                key={option.id}
                onClick={() => {
                  setLayoutMode(option.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 border-b border-rule last:border-b-0 ${
                  isActive ? "bg-pink-soft" : "hover:bg-sky-soft"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <Check className="h-4 w-4 text-pink-ink shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-semibold text-ink">{option.label}</span>
                </div>
                <p className="text-xs text-muted mt-0.5 ml-6">{option.description}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
