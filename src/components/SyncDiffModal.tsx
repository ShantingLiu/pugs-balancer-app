import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { SyncDiff, PlayerDiff, FieldDiff, DiffType } from "@services/diffEngine";

// =============================================================================
// SyncDiffModal — Review & resolve sync diffs before applying (§10.3)
// =============================================================================

interface SyncDiffModalProps {
  diff: SyncDiff;
  onApply: (resolved: SyncDiff) => void;
  onCancel: () => void;
}

export function SyncDiffModal({ diff, onApply, onCancel }: SyncDiffModalProps) {
  const [resolvedDiff, setResolvedDiff] = useState<SyncDiff>(structuredClone(diff));

  // P1-034: Bulk-set all field choices to one side
  const acceptAll = (side: "local" | "remote") => {
    setResolvedDiff((prev) => ({
      ...prev,
      modified: prev.modified.map((pd) => ({
        ...pd,
        fields: pd.fields.map((f) => ({ ...f, chosenSide: side })),
      })),
    }));
  };

  // P1-035: Update field choices for a single player
  const updateDiff = (battletag: string, fieldName: string, side: "local" | "remote") => {
    setResolvedDiff((prev) => ({
      ...prev,
      modified: prev.modified.map((pd) =>
        pd.battletag === battletag
          ? {
              ...pd,
              fields: pd.fields.map((f) =>
                f.field === fieldName ? { ...f, chosenSide: side } : f
              ),
            }
          : pd
      ),
    }));
  };

  // P1-036: Toggle import/push for new players
  const toggleSelected = (battletag: string, type: DiffType) => {
    const key = type === "new_remote" ? "newRemote" : "newLocal";
    setResolvedDiff((prev) => ({
      ...prev,
      [key]: prev[key].map((pd) =>
        pd.battletag === battletag ? { ...pd, selected: !pd.selected } : pd
      ),
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="app-modal p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-ink">Sync Changes</h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-muted hover:text-ink p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* P1-038: First-sync banner */}
        {diff.isFirstSync && (
          <div className="app-alert-accent p-3 mb-4 text-sm">
            This is your first sync. The sheet roster will replace your local data.
            You can review individual changes below.
          </div>
        )}

        {/* No changes message */}
        {!resolvedDiff.hasChanges && (
          <p className="text-muted text-sm mb-4">
            No changes detected. Your local data matches the sheet.
          </p>
        )}

        {/* Bulk actions */}
        {resolvedDiff.modified.length > 0 && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => acceptAll("local")}
              className="px-3 py-1.5 text-sm app-secondary transition-colors"
            >
              Accept All Local
            </button>
            <button
              onClick={() => acceptAll("remote")}
              className="px-3 py-1.5 text-sm app-secondary transition-colors"
            >
              Accept All Remote
            </button>
          </div>
        )}

        {/* Modified Players section */}
        {resolvedDiff.modified.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-ink">
              Modified Players ({resolvedDiff.modified.length})
            </h3>
            {resolvedDiff.modified.map((pd) => (
              <ModifiedPlayerCard
                key={pd.battletag}
                player={pd}
                onFieldChoice={(field, side) => updateDiff(pd.battletag, field, side)}
              />
            ))}
          </section>
        )}

        {/* New from Sheet section */}
        {resolvedDiff.newRemote.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-ink">
              New from Sheet ({resolvedDiff.newRemote.length})
            </h3>
            {resolvedDiff.newRemote.map((pd) => (
              <NewPlayerRow
                key={pd.battletag}
                player={pd}
                onToggle={() => toggleSelected(pd.battletag, "new_remote")}
              />
            ))}
          </section>
        )}

        {/* New Locally section */}
        {resolvedDiff.newLocal.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-ink">
              New Locally ({resolvedDiff.newLocal.length})
            </h3>
            {resolvedDiff.newLocal.map((pd) => (
              <NewPlayerRow
                key={pd.battletag}
                player={pd}
                onToggle={() => toggleSelected(pd.battletag, "new_local")}
              />
            ))}
          </section>
        )}

        {/* Footer buttons */}
        <div className="flex gap-3 pt-4 border-t border-[var(--color-rule)]">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 app-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(resolvedDiff)}
            className="flex-1 py-2 px-4 app-primary font-medium transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ModifiedPlayerCard — shows field diffs for one player
// =============================================================================

function ModifiedPlayerCard({
  player,
  onFieldChoice,
}: {
  player: PlayerDiff;
  onFieldChoice: (field: string, side: "local" | "remote") => void;
}) {
  return (
    <div className="mb-3 app-subsurface p-3">
      <div className="font-medium text-ink mb-2">{player.battletag}</div>

      {player.validationWarnings.length > 0 && (
        <div className="mb-2 p-2 app-alert-accent text-xs">
          {player.validationWarnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {player.fields.map((fd) => (
          <FieldDiffRow
            key={fd.field}
            battletag={player.battletag}
            diff={fd}
            onChoose={(side) => onFieldChoice(fd.field, side)}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// P1-037: FieldDiffRow — side-by-side local/remote with click-to-choose
// =============================================================================

function FieldDiffRow({
  battletag,
  diff,
  onChoose,
}: {
  battletag: string;
  diff: FieldDiff;
  onChoose: (side: "local" | "remote") => void;
}) {
  const localActive = diff.chosenSide === "local";
  const remoteActive = diff.chosenSide === "remote";

  return (
    <div className="flex items-center text-sm gap-2">
      <span className="w-40 text-muted truncate">{diff.header}</span>
      <span
        data-testid={`local-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("local")}
        className={`flex-1 px-2.5 py-0.5 cursor-pointer text-center truncate transition-colors ${
          localActive ? "app-chip-active" : "app-chip"
        }`}
      >
        {diff.localValue || "(empty)"}
      </span>
      <span className="text-muted">→</span>
      <span
        data-testid={`remote-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("remote")}
        className={`flex-1 px-2.5 py-0.5 cursor-pointer text-center truncate transition-colors ${
          remoteActive ? "app-chip-active" : "app-chip"
        }`}
      >
        {diff.remoteValue || "(empty)"}
      </span>
    </div>
  );
}

// =============================================================================
// NewPlayerRow — checkbox toggle for importing/pushing a player
// =============================================================================

function NewPlayerRow({
  player,
  onToggle,
}: {
  player: PlayerDiff;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 py-1.5 px-2 rounded-[var(--radius-card)] hover:bg-[var(--color-paper-2)] cursor-pointer">
      <input
        type="checkbox"
        checked={player.selected}
        onChange={onToggle}
        aria-label={player.battletag}
        className="w-4 h-4"
      />
      <span className="font-medium text-ink">{player.battletag}</span>
      {player.validationWarnings.length > 0 && (
        <span className="text-accent text-xs ml-auto">
          {player.validationWarnings.length} warning(s)
        </span>
      )}
    </label>
  );
}
