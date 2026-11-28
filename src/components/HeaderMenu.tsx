import { useId, useState } from "react";
import { Check, Menu, Moon, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
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
  const themeLabelId = useId();
  const textSizeLabelId = useId();

  const closeMenu = () => {
    setIsOpen(false);
    setUpdateNote(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setUpdateNote(null);
    }
  };

  const handleCheckForUpdates = async () => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    setUpdateNote(null);

    try {
      const result = await checkForAppUpdateManual();
      if (result.status === "available") {
        closeMenu();
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

  const isConnected = spreadsheetId !== null;
  const syncDisabled = !isConnected || !isAuthenticated;
  const hasActiveSession = Boolean(lastResult && lastResult.team1.length > 0);
  const showUnsyncDot = hasUnsyncedChanges && !syncDisabled;

  const handleModeSelect = (mode: GameMode) => {
    if (mode === gameMode) {
      closeMenu();
      return;
    }
    if (hasActiveSession) {
      setConfirmMode(mode);
      closeMenu();
    } else {
      setGameMode(mode);
      closeMenu();
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="secondary"
              aria-label="Menu"
              className="relative px-2.5 sm:px-3.5"
            />
          }
        >
          <Menu data-icon="inline-start" aria-hidden="true" />
          <span className="hidden sm:inline">Menu</span>
          {showUnsyncDot && (
            <span
              data-testid="menu-unsync-badge"
              className="absolute -top-1 -right-1 size-2.5 bg-accent border border-pink-edge rounded-pill"
            />
          )}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          aria-label="App menu"
          className="w-72 sm:w-80 max-h-[min(calc(100dvh-5.5rem),44rem)] overflow-y-auto app-menu-scroll p-3.5 flex flex-col gap-3.5"
        >
          {/* Google Sheets */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  closeMenu();
                  onOpenSheets();
                }}
              >
                Sheets Setup
              </Button>
              <Button
                variant={syncDisabled ? "quiet" : "sky"}
                size="sm"
                disabled={syncDisabled}
                onClick={() => {
                  closeMenu();
                  onSync();
                }}
                className="relative"
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                <span>Sync</span>
                {showUnsyncDot && (
                  <span className="size-2 bg-accent border border-pink-edge rounded-pill" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Game Mode */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-muted">Game Mode</div>
            <div className="flex flex-col gap-1">
              {MODE_OPTIONS.map((option) => {
                const isActive = option.id === gameMode;
                return (
                  <Button
                    key={option.id}
                    variant="ghost"
                    shape="well"
                    onClick={() => handleModeSelect(option.id)}
                    className={cn(
                      "h-auto w-full justify-start items-start text-left whitespace-normal px-3 py-2 border",
                      isActive
                        ? "bg-pink-soft border-pink-edge hover:bg-pink-soft"
                        : "border-transparent hover:bg-sky-soft",
                    )}
                  >
                    <span className="w-4 pt-0.5 shrink-0">
                      {isActive && (
                        <Check className="text-pink-ink" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{option.label}</div>
                      <div className="text-xs text-muted font-normal">{option.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Workspace Layout */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-muted">Layout</div>
            <div className="grid grid-cols-2 gap-1.5">
              {LAYOUT_OPTIONS.map((option) => {
                const isActive = option.id === layoutMode;
                return (
                  <Button
                    key={option.id}
                    variant="ghost"
                    size="sm"
                    shape="well"
                    title={option.description}
                    onClick={() => {
                      setLayoutMode(option.id);
                      closeMenu();
                    }}
                    className={cn(
                      "w-full py-2 border",
                      isActive
                        ? "bg-sky-soft border-sky-edge text-sky-ink hover:bg-sky-soft hover:text-sky-ink"
                        : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft",
                    )}
                  >
                    {isActive && <Check data-icon="inline-start" aria-hidden="true" />}
                    <span>{option.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Appearance */}
          <FieldGroup className="gap-2.5">
            <div className="text-xs font-semibold text-muted">Appearance</div>
            <Field orientation="horizontal" className="justify-between gap-2">
              <FieldTitle id={themeLabelId} className="text-xs">
                Theme
              </FieldTitle>
              <ToggleGroup
                value={[colorMode]}
                onValueChange={(vals) => {
                  const next = vals[0];
                  if (next === "light" || next === "dark") setColorMode(next);
                }}
                aria-labelledby={themeLabelId}
                size="sm"
              >
                <ToggleGroupItem value="light" activeVariant="primary">
                  <Sun data-icon="inline-start" aria-hidden="true" />
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" activeVariant="sky">
                  <Moon data-icon="inline-start" aria-hidden="true" />
                  Dark
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field orientation="horizontal" className="justify-between gap-2">
              <FieldTitle id={textSizeLabelId} className="text-xs">
                Text Size
              </FieldTitle>
              <ToggleGroup
                value={[fontScale]}
                onValueChange={(vals) => {
                  const next = vals[0];
                  if (next === "normal" || next === "large" || next === "x-large") {
                    setFontScale(next);
                  }
                }}
                aria-labelledby={textSizeLabelId}
                size="sm"
              >
                {FONT_SCALE_OPTIONS.map((opt) => (
                  <ToggleGroupItem key={opt.id} value={opt.id} activeVariant="sky">
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldGroup>

          <Separator />

          {/* Updates & Version */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">Updates</span>
              <span className="text-xs font-semibold app-measured text-ink-2">
                v{APP_VERSION}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheckForUpdates}
              disabled={checkingUpdates}
              className="w-full"
            >
              <RefreshCw
                data-icon="inline-start"
                className={cn(checkingUpdates && "animate-spin")}
                aria-hidden="true"
              />
              <span>{checkingUpdates ? "Checking…" : "Check for Updates"}</span>
            </Button>
            {updateNote && (
              <p
                role="status"
                className={cn(
                  "pt-0.5 text-center text-xs font-semibold",
                  updateNote.tone === "ok"
                    ? "text-ok"
                    : updateNote.tone === "bad"
                      ? "text-bad"
                      : "text-muted",
                )}
              >
                {updateNote.text}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ModeSwitchConfirmModal
        targetMode={confirmMode}
        onCancel={() => setConfirmMode(null)}
        onConfirm={() => {
          if (confirmMode) {
            setGameMode(confirmMode);
          }
          setConfirmMode(null);
        }}
      />
    </>
  );
}
