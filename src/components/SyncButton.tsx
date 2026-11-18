import { RefreshCw } from "lucide-react";
import { useSheetStore } from "@store/sheetStore";

// =============================================================================
// SyncButton — Connection status + sync trigger (§10.1)
// =============================================================================

interface SyncButtonProps {
  onClick: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
        <span className="text-xs text-muted truncate max-w-[200px]">
          {sheetName ?? "Connected"}
          {lastSyncedAt && <> · {formatRelativeTime(lastSyncedAt)}</>}
        </span>
      ) : (
        <span className="text-xs text-muted">Not connected</span>
      )}

      {/* Sync button with unsync badge */}
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`relative px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
          isDisabled
            ? "app-secondary opacity-60 cursor-not-allowed"
            : "app-primary"
        }`}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Sync
        {hasUnsyncedChanges && !isDisabled && (
          <span
            data-testid="unsync-badge"
            className="absolute -top-1 -right-1 w-2.5 h-2.5 app-unsync-dot rounded-full"
          />
        )}
      </button>
    </div>
  );
}
