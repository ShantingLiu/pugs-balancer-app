import { useState, useRef, useEffect } from "react";
import { Check, Menu, Moon, RefreshCw, Sun } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { useSheetStore } from "@store/sheetStore";
import type { GameMode } from "@engine/types";
import { MODE_OPTIONS, LAYOUT_OPTIONS, formatRelativeTime } from "@config/headerOptions";
import { APP_VERSION } from "@config/appInfo";
import { checkForAppUpdateManual, type Update } from "@services/updater";
import { ModeSwitchConfirmModal } from "./ModeSelector";

interface HeaderMenuProps {
  onOpenSheets: () => void;
  onSync: () => void;
  onUpdateFound?: (update: Update) => void;
}

const FONT_SCALE_OPTIONS: { id: "normal" | "large" | "x-large"; label: string }[] = [
  { id: "normal", label: "A" },
  { id: "large", label: "A+" },
  { id: "x-large", label: "A++" },
];

/** Consolidates Sheets, Mode, Layout, Theme, and Text Size controls into one header menu. */
export function HeaderMenu({ onOpenSheets, onSync, onUpdateFound }: HeaderMenuProps) {
  const gameMode = useSessionStore((s) => s.gameMode);
  const setGameMode = useSessionStore((s) => s.setGameMode);
  const lastResult = useSessionStore((s) => s.lastResult);
  const layoutMode = useSessionStore((s) => s.layoutMode);
  const setLayoutMode = useSessionStore((s) => s.setLayoutMode);
  const colorMode = useSessionStore((s) => s.colorMode);
  const setColorMode = useSessionStore((s) => s.setColorMode);
  const fontScale = useSessionStore((s) => s.fontScale);
  const setFontScale = useSessionStore((s) => s.setFontScale);

  const spreadsheetId = useSheetStore((s) => s.spreadsheetId);
  const sheetName = useSheetStore((s) => s.sheetName);
  const lastSyncedAt = useSheetStore((s) => s.lastSyncedAt);
  const hasUnsyncedChanges = useSheetStore((s) => s.hasUnsyncedChanges);
  const isAuthenticated = useSheetStore((s) => s.isAuthenticated);

  const [isOpen, setIsOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<GameMode | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateNote, setUpdateNote] = useState<{
    text: string;
    tone: "ok" | "muted" | "bad";
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCheckForUpdates = async () => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    setUpdateNote(null);

    try {
      const result = await checkForAppUpdateManual();
      if (result.status === "available") {
        setIsOpen(false);
        onUpdateFound?.(result.update);
      } else if (result.status === "up-to-date") {
        setUpdateNote({
          text: "Everything up-to-date",
          tone: "ok",
        });
      } else {
        setUpdateNote({
          text: "Auto-updates require the desktop app",
          tone: "muted",
        });
      }
    } catch (err: unknown) {
      setUpdateNote({
        text: err instanceof Error ? err.message : "Could not check for updates",
        tone: "bad",
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  const isConnected = spreadsheetId !== null;
  const syncDisabled = !isConnected || !isAuthenticated;
  const hasActiveSession = Boolean(lastResult && lastResult.team1.length > 0);
  const showUnsyncDot = hasUnsyncedChanges && !syncDisabled;

  const handleModeSelect = (mode: GameMode) => {
    if (mode === gameMode) {
      setIsOpen(false);
      return;
    }
    if (hasActiveSession) {
      setConfirmMode(mode);
      setIsOpen(false);
    } else {
      setGameMode(mode);
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Menu"
          className="relative app-secondary inline-flex items-center gap-2 px-2.5 sm:px-3.5 py-2 rounded-pill text-sm font-semibold"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Menu</span>
          {showUnsyncDot && (
            <span
              data-testid="menu-unsync-badge"
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent border border-pink-edge rounded-pill"
            />
          )}
        </button>

        {isOpen && (
          <div
            role="menu"
            aria-label="App menu"
            className="absolute right-0 mt-2 w-72 sm:w-80 app-modal z-50 max-h-[80dvh] overflow-y-auto px-4 pt-3.5 pb-6 space-y-3.5"
          >
            {/* Google Sheets */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-muted">
                  Google Sheets
                </span>
                <span className="text-xs text-ink-2 truncate max-w-[165px]">
                  {isConnected ? (
                    <>
                      {sheetName ?? "Connected"}
                      {lastSyncedAt && <> ({formatRelativeTime(lastSyncedAt)})</>}
                    </>
                  ) : (
                    "Not connected"
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSheets();
                  }}
                  className="app-secondary px-3 py-2 rounded-pill text-xs font-semibold"
                >
                  Sheets Setup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onSync();
                  }}
                  disabled={syncDisabled}
                  className={`relative inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-pill text-xs font-semibold ${
                    syncDisabled ? "app-quiet" : "app-sky"
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sync</span>
                  {showUnsyncDot && (
                    <span className="w-2 h-2 bg-accent border border-pink-edge rounded-pill" />
                  )}
                </button>
              </div>
            </div>

            <hr className="border-rule" />

            {/* Game Mode */}
            <div>
              <div className="text-xs font-semibold text-muted mb-2">
                Game Mode
              </div>
              <div className="space-y-1">
                {MODE_OPTIONS.map((option) => {
                  const isActive = option.id === gameMode;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => handleModeSelect(option.id)}
                      className={`w-full text-left px-3 py-2 rounded-well border flex items-start gap-2 ${
                        isActive
                          ? "bg-pink-soft border-pink-edge"
                          : "border-transparent hover:bg-sky-soft"
                      }`}
                    >
                      <span className="w-4 pt-0.5 shrink-0">
                        {isActive && (
                          <Check className="h-4 w-4 text-pink-ink" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{option.label}</div>
                        <div className="text-xs text-muted">{option.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-rule" />

            {/* Workspace Layout */}
            <div>
              <div className="text-xs font-semibold text-muted mb-2">
                Layout
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LAYOUT_OPTIONS.map((option) => {
                  const isActive = option.id === layoutMode;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => {
                        setLayoutMode(option.id);
                        setIsOpen(false);
                      }}
                      title={option.description}
                      className={`px-2.5 py-2 rounded-well border text-xs font-semibold flex items-center justify-center gap-1 ${
                        isActive
                          ? "bg-sky-soft border-sky-edge text-sky-ink"
                          : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft"
                      }`}
                    >
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-rule" />

            {/* Appearance */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-muted">
                Appearance
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-2">Theme</span>
                <div className="app-well p-0.5 rounded-pill inline-flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => setColorMode("light")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold ${
                      colorMode === "light" ? "app-primary" : "text-muted hover:text-ink"
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorMode("dark")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-semibold ${
                      colorMode === "dark" ? "app-sky" : "text-muted hover:text-ink"
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                    Dark
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-2">Text Size</span>
                <div className="app-well p-0.5 rounded-pill inline-flex gap-0.5">
                  {FONT_SCALE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setFontScale(opt.id)}
                      className={`px-2.5 py-1 rounded-pill text-xs font-semibold ${
                        fontScale === opt.id ? "app-sky" : "text-muted hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr className="border-rule" />

            {/* Updates & Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted">Updates</span>
                <span className="text-xs font-semibold app-measured text-ink-2">
                  v{APP_VERSION}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCheckForUpdates}
                disabled={checkingUpdates}
                className="w-full app-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-pill text-xs font-semibold"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${checkingUpdates ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>{checkingUpdates ? "Checking…" : "Check for Updates"}</span>
              </button>
              {updateNote && (
                <p
                  role="status"
                  className={`pt-0.5 text-center text-xs font-semibold ${
                    updateNote.tone === "ok"
                      ? "text-ok"
                      : updateNote.tone === "bad"
                        ? "text-bad"
                        : "text-muted"
                  }`}
                >
                  {updateNote.text}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmMode && (
        <ModeSwitchConfirmModal
          targetMode={confirmMode}
          onCancel={() => setConfirmMode(null)}
          onConfirm={() => {
            setGameMode(confirmMode);
            setConfirmMode(null);
          }}
        />
      )}
    </>
  );
}
