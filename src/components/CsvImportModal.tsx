import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import type { Player } from "@engine/types";

// =============================================================================
// CsvImportModal - Confirms CSV import and lets user keep missing players
// =============================================================================

interface CsvImportModalProps {
  existingCount: number;
  incomingPlayers: Player[];
  missingExisting: Player[];
  onConfirm: (keptMissingPlayers: Player[]) => void;
  onCancel: () => void;
}

export function CsvImportModal({
  existingCount,
  incomingPlayers,
  missingExisting,
  onConfirm,
  onCancel,
}: CsvImportModalProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    () => new Set(missingExisting.map((p) => p.battletag))
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const hasMissing = missingExisting.length > 0;
  const keptCount = selectedTags.size;
  const mergedTotal = incomingPlayers.length + keptCount;

  const togglePlayer = (battletag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(battletag)) {
        next.delete(battletag);
      } else {
        next.add(battletag);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTags(new Set(missingExisting.map((p) => p.battletag)));
  };

  const clearSelection = () => {
    setSelectedTags(new Set());
  };

  const handleConfirmMerged = () => {
    const kept = missingExisting.filter((p) => selectedTags.has(p.battletag));
    onConfirm(kept);
  };

  return (
    <div
      className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-modal-title"
        className="app-modal p-6 w-full max-w-lg max-h-[85vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2
            id="csv-import-modal-title"
            className="text-xl font-semibold text-ink flex items-center gap-2"
          >
            <Users className="h-5 w-5 text-sky-ink shrink-0" aria-hidden="true" />
            <span>{hasMissing ? "Keep Existing Players?" : "Replace Roster?"}</span>
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-muted hover:text-ink p-1.5 rounded-pill"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {hasMissing ? (
          <>
            <p className="text-sm text-ink-2 mb-3 shrink-0">
              You have{" "}
              <span className="font-semibold text-ink">{missingExisting.length}</span>{" "}
              player{missingExisting.length === 1 ? "" : "s"} already loaded who{" "}
              {missingExisting.length === 1 ? "isn’t" : "aren’t"} in this{" "}
              <span className="font-semibold text-ink">{incomingPlayers.length}</span>
              -player CSV. Add them into the new roster too?
            </p>

            <div className="flex items-center justify-between text-xs mb-2 shrink-0">
              <span className="font-semibold text-muted app-measured">
                {keptCount} of {missingExisting.length} selected
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={selectAll}
                  className="font-semibold text-sky-ink hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="font-semibold text-muted hover:text-ink hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            <div className="app-well p-2 mb-4 max-h-60 overflow-y-auto space-y-1">
              {missingExisting.map((player) => {
                const checked = selectedTags.has(player.battletag);
                return (
                  <label
                    key={player.battletag}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-well hover:bg-paper-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlayer(player.battletag)}
                      aria-label={`Keep ${player.battletag}`}
                      className="w-4 h-4 accent-focus shrink-0"
                    />
                    <span className="font-semibold text-sm text-ink break-words min-w-0 flex-1">
                      {player.battletag}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {player.rolesWilling.join(", ")}
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="text-xs text-muted mb-4 shrink-0">
              Continuing clears current session stats and lobby selections.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-3 border-t border-rule shrink-0">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 app-secondary rounded-pill text-sm font-semibold app-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm([])}
                className="flex-1 py-2 px-4 app-sky rounded-pill text-sm font-semibold app-nowrap"
              >
                New CSV Only ({incomingPlayers.length})
              </button>
              <button
                type="button"
                onClick={handleConfirmMerged}
                className="flex-1 py-2 px-4 app-primary rounded-pill text-sm font-semibold app-nowrap"
              >
                Add & Import ({mergedTotal})
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2 mb-4">
              This will replace{" "}
              <span className="font-semibold text-ink">{existingCount}</span>{" "}
              existing player{existingCount === 1 ? "" : "s"} with{" "}
              <span className="font-semibold text-ink">{incomingPlayers.length}</span>{" "}
              player{incomingPlayers.length === 1 ? "" : "s"} from this CSV and clear session stats and lobby.
            </p>
            <div className="flex gap-2.5 pt-3 border-t border-rule">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 px-4 app-secondary rounded-pill text-sm font-semibold app-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm([])}
                className="flex-1 py-2 px-4 app-primary rounded-pill text-sm font-semibold app-nowrap"
              >
                Replace Roster
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
