import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSheetStore } from "@store/sheetStore";
import { formatRelativeTime } from "@config/headerOptions";

// =============================================================================
// SyncButton — Connection status + sync trigger (§10.1)
// =============================================================================

interface SyncButtonProps {
  onClick: () => void;
}

export function SyncButton({ onClick }: SyncButtonProps) {
  const spreadsheetId = useSheetStore((s) => s.spreadsheetId);
  const sheetName = useSheetStore((s) => s.sheetName);
  const lastSyncedAt = useSheetStore((s) => s.lastSyncedAt);
  const hasUnsyncedChanges = useSheetStore((s) => s.hasUnsyncedChanges);
  const isAuthenticated = useSheetStore((s) => s.isAuthenticated);

  const isConnected = spreadsheetId !== null;
  const isDisabled = !isConnected || !isAuthenticated;
  const tooltipText = !isConnected
    ? "Connect a Google Sheet to sync"
    : !isAuthenticated
      ? "Sign in with Google to sync"
      : hasUnsyncedChanges
        ? "Unsynced changes — click to sync"
        : "Sync with Google Sheets";

  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      {isConnected ? (
        <span className="text-xs text-ink-2 truncate max-w-[200px]">
          {sheetName ?? "Connected"}
          {lastSyncedAt && <> ({formatRelativeTime(lastSyncedAt)})</>}
        </span>
      ) : (
        <span className="text-xs text-muted">Not connected</span>
      )}

      {/* Sync button with unsync badge */}
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            variant={isDisabled ? "quiet" : "sky"}
            onClick={onClick}
            disabled={isDisabled}
            className="relative"
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            <span>Sync</span>
            {hasUnsyncedChanges && !isDisabled && (
              <span
                data-testid="unsync-badge"
                className="absolute -top-1 -right-1 size-2.5 bg-accent border border-pink-edge rounded-pill"
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </div>
  );
}
