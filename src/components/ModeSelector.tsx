import { useState } from "react";
import { ChevronDown, Check, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";
import { MODE_CONFIGS } from "@engine/modeConfig";
import { MODE_OPTIONS } from "@config/headerOptions";
import { useTheme } from "@hooks/useTheme";

// =============================================================================
// ModeSelector - Dropdown to switch between game modes
// =============================================================================

interface ModeSwitchConfirmModalProps {
  targetMode: GameMode | null;
  isOpen?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirms switching game mode when a match result exists. */
export function ModeSwitchConfirmModal({
  targetMode,
  isOpen,
  onCancel,
  onConfirm,
}: ModeSwitchConfirmModalProps) {
  const open = isOpen ?? Boolean(targetMode);
  const [displayMode, setDisplayMode] = useState<GameMode>(
    targetMode ?? "stadium_5v5"
  );

  if (targetMode !== null && targetMode !== displayMode) {
    setDisplayMode(targetMode);
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch Game Mode?</AlertDialogTitle>
          <AlertDialogDescription>
            Switching to {MODE_CONFIGS[displayMode].label} will reset your current session stats (wins, losses, adaptive weights).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert className="bg-pink-soft border-pink-edge text-pink-ink">
          <Info aria-hidden="true" />
          <AlertDescription className="text-pink-ink">
            Export your CSV first to save session wins before switching.
          </AlertDescription>
        </Alert>
        <p className="text-muted text-sm">
          Your lobby players and imported roster will be preserved.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Switch Mode</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ModeSelector() {
  const gameMode = useSessionStore((state) => state.gameMode);
  const setGameMode = useSessionStore((state) => state.setGameMode);
  const lastResult = useSessionStore((state) => state.lastResult);
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<GameMode | null>(null);

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
      <div className="flex items-center gap-2">
        {/* Mode badge/pill */}
        <Badge className={cn("px-3 py-1 font-semibold", theme.badge.bg, theme.badge.text)}>
          {currentMode.label}
        </Badge>

        {/* Mode selector dropdown */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger render={<Button variant="secondary" />}>
            <span>Change Mode</span>
            <ChevronDown
              data-icon="inline-end"
              className={cn("transition-transform", isOpen && "rotate-180")}
              aria-hidden="true"
            />
          </PopoverTrigger>

          <PopoverContent align="end" className="w-60 p-1.5 flex flex-col gap-1">
            {MODE_OPTIONS.map((option) => {
              const isActive = option.id === gameMode;
              return (
                <Button
                  key={option.id}
                  variant="ghost"
                  shape="well"
                  onClick={() => handleModeSelect(option.id)}
                  className={cn(
                    "h-auto w-full flex-col items-start justify-start text-left whitespace-normal px-3 py-2.5 gap-0.5",
                    isActive ? "bg-pink-soft hover:bg-pink-soft" : "hover:bg-sky-soft",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Check data-icon="inline-start" className="text-pink-ink" aria-hidden="true" />
                    )}
                    <span className="font-semibold text-ink">{option.label}</span>
                  </div>
                  <p className="text-xs text-muted font-normal ml-6">
                    {option.description}
                  </p>
                </Button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* Confirmation modal */}
      <ModeSwitchConfirmModal
        targetMode={showConfirm}
        onCancel={() => setShowConfirm(null)}
        onConfirm={() => {
          if (showConfirm) {
            setGameMode(showConfirm);
          }
          setShowConfirm(null);
        }}
      />
    </>
  );
}
