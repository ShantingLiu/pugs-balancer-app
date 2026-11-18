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

  const acceptAll = (side: "local" | "remote") => {
    setResolvedDiff((prev) => ({
      ...prev,
      modified: prev.modified.map((pd) => ({
        ...pd,
        fields: pd.fields.map((f) => ({ ...f, chosenSide: side })),
      })),
    }));
  };

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

  const toggleSelected = (battletag: string, type: DiffType) => {
    const key = type === "new_remote" ? "newRemote" : "newLocal";
    setResolvedDiff((prev) => ({
      ...prev,
      [key]: prev[key].map((pd) =>
        pd.battletag === battletag ? { ...pd, selected: !pd.selected } : pd
      ),
    }));
  };

  return (
    <div className="fixed inset-0 app-backdrop flex items-center justify-center z-50">
      <div className="app-modal p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto mx-4">
        <h2 className="text-xl font-semibold text-ink mb-4">Sync Changes</h2>

        {diff.isFirstSync && (
          <div className="bg-sky-soft border border-sky-edge rounded-well p-3 mb-4 text-sm text-sky-ink font-semibold">
            This is your first sync. The sheet roster will replace your local data.
            You can review individual changes below.
          </div>
        )}

        {!resolvedDiff.hasChanges && (
          <p className="text-muted text-sm mb-4">
            No changes detected. Your local data matches the sheet.
          </p>
        )}

        {resolvedDiff.modified.length > 0 && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => acceptAll("local")}
              className="px-3.5 py-1.5 text-sm font-semibold app-secondary rounded-pill"
            >
              Accept All Local
            </button>
            <button
              type="button"
              onClick={() => acceptAll("remote")}
              className="px-3.5 py-1.5 text-sm font-semibold app-sky rounded-pill"
            >
              Accept All Remote
            </button>
          </div>
        )}

        {resolvedDiff.modified.length > 0 && (
          <section className="mb-6">
            <h3 className="text-base font-semibold text-ink mb-3">
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

        {resolvedDiff.newRemote.length > 0 && (
          <section className="mb-6">
            <h3 className="text-base font-semibold text-ink mb-3">
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

        {resolvedDiff.newLocal.length > 0 && (
          <section className="mb-6">
            <h3 className="text-base font-semibold text-ink mb-3">
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

        <div className="flex gap-3 pt-4 border-t border-rule">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 app-secondary rounded-pill text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(resolvedDiff)}
            className="flex-1 py-2.5 px-4 app-primary rounded-pill text-sm font-semibold"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ModifiedPlayerCard({
  player,
  onFieldChoice,
}: {
  player: PlayerDiff;
  onFieldChoice: (field: string, side: "local" | "remote") => void;
}) {
  return (
    <div className="mb-3 app-well p-3">
      <div className="font-semibold text-ink mb-2">{player.battletag}</div>

      {player.validationWarnings.length > 0 && (
        <div className="mb-2 p-2 bg-warn-soft border border-warn-edge rounded-well text-warn text-xs">
          {player.validationWarnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
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
      <span className="w-40 text-ink-2 truncate">{diff.header}</span>
      <span
        data-testid={`local-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("local")}
        className={`flex-1 px-2.5 py-1 rounded-pill cursor-pointer text-center truncate border ${
          localActive
            ? "bg-ok-soft border-ok-edge text-ok font-semibold"
            : "bg-paper-2 border-rule text-muted hover:bg-ok-soft"
        }`}
      >
        {diff.localValue || "(empty)"}
      </span>
      <span className="text-muted">→</span>
      <span
        data-testid={`remote-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("remote")}
        className={`flex-1 px-2.5 py-1 rounded-pill cursor-pointer text-center truncate border ${
          remoteActive
            ? "bg-sky-soft border-sky-edge text-sky-ink font-semibold"
            : "bg-paper-2 border-rule text-muted hover:bg-sky-soft"
        }`}
      >
        {diff.remoteValue || "(empty)"}
      </span>
    </div>
  );
}

function NewPlayerRow({
  player,
  onToggle,
}: {
  player: PlayerDiff;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 py-1.5 px-2.5 rounded-well hover:bg-sky-soft/60 cursor-pointer">
      <input
        type="checkbox"
        checked={player.selected}
        onChange={onToggle}
        aria-label={player.battletag}
        className="w-4 h-4 accent-focus"
      />
      <span className="font-semibold text-ink">{player.battletag}</span>
      {player.validationWarnings.length > 0 && (
        <span className="text-warn text-xs font-semibold ml-auto">
          {player.validationWarnings.length} warning(s)
        </span>
      )}
    </label>
  );
}
