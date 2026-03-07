import { useState } from "react";
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
                f.field === fieldName ? { ...f, chosenSide: side } : f,
              ),
            }
          : pd,
      ),
    }));
  };

  // P1-036: Toggle import/push for new players
  const toggleSelected = (battletag: string, type: DiffType) => {
    const key = type === "new_remote" ? "newRemote" : "newLocal";
    setResolvedDiff((prev) => ({
      ...prev,
      [key]: prev[key].map((pd) =>
        pd.battletag === battletag ? { ...pd, selected: !pd.selected } : pd,
      ),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-xl">
        <h2 className="text-xl font-bold mb-4">Sync Changes</h2>

        {/* P1-038: First-sync banner */}
        {diff.isFirstSync && (
          <div className="bg-blue-900/40 border border-blue-500 rounded p-3 mb-4 text-sm">
            This is your first sync — the sheet roster will replace your local data.
            You can review individual changes below.
          </div>
        )}

        {/* No changes message */}
        {!resolvedDiff.hasChanges && (
          <p className="text-gray-400 text-sm mb-4">
            No changes detected — your local data matches the sheet.
          </p>
        )}

        {/* Bulk actions */}
        {resolvedDiff.modified.length > 0 && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => acceptAll("local")}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Accept All Local
            </button>
            <button
              onClick={() => acceptAll("remote")}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Accept All Remote
            </button>
          </div>
        )}

        {/* Modified Players section */}
        {resolvedDiff.modified.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-3">
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
            <h3 className="text-lg font-semibold mb-3">
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
            <h3 className="text-lg font-semibold mb-3">
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
        <div className="flex gap-3 pt-2 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(resolvedDiff)}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
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
    <div className="mb-3 bg-gray-700/50 rounded-lg p-3">
      <div className="font-medium mb-2">{player.battletag}</div>

      {player.validationWarnings.length > 0 && (
        <div className="mb-2 p-2 bg-yellow-900/40 border border-yellow-600 rounded text-yellow-300 text-xs">
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
      <span className="w-40 text-gray-400 truncate">{diff.header}</span>
      <span
        data-testid={`local-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("local")}
        className={`flex-1 px-2 py-0.5 rounded cursor-pointer text-center truncate ${
          localActive
            ? "bg-green-800/60 border border-green-500 text-green-200"
            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
        }`}
      >
        {diff.localValue || "(empty)"}
      </span>
      <span className="text-gray-500">→</span>
      <span
        data-testid={`remote-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("remote")}
        className={`flex-1 px-2 py-0.5 rounded cursor-pointer text-center truncate ${
          remoteActive
            ? "bg-blue-800/60 border border-blue-500 text-blue-200"
            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
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
    <label className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-700/50 cursor-pointer">
      <input
        type="checkbox"
        checked={player.selected}
        onChange={onToggle}
        aria-label={player.battletag}
        className="w-4 h-4 rounded border-gray-500 bg-gray-700"
      />
      <span className="font-medium">{player.battletag}</span>
      {player.validationWarnings.length > 0 && (
        <span className="text-yellow-400 text-xs ml-auto">
          {player.validationWarnings.length} warning(s)
        </span>
      )}
    </label>
  );
}
