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
        <span className="text-xs text-gray-400 truncate max-w-[200px]">
          {sheetName ?? "Connected"}
          {lastSyncedAt && <> · {formatRelativeTime(lastSyncedAt)}</>}
        </span>
      ) : (
        <span className="text-xs text-gray-500">Not connected</span>
      )}

      {/* Sync button with unsync badge */}
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`relative px-3 py-1 rounded text-sm font-medium transition-colors ${
          isDisabled
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        ↻ Sync
        {hasUnsyncedChanges && !isDisabled && (
          <span
            data-testid="unsync-badge"
            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full"
          />
        )}
      </button>
    </div>
  );
}
