import { RefreshCw } from "lucide-react";
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
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-sm font-semibold ${
          isDisabled ? "app-quiet" : "app-sky"
        }`}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Sync</span>
        {hasUnsyncedChanges && !isDisabled && (
          <span
            data-testid="unsync-badge"
            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent border border-pink-edge rounded-pill"
          />
        )}
      </button>
    </div>
  );
}
