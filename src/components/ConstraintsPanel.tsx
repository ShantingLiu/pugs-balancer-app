import { useState, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import type { SoftConstraint } from "@engine/types";

// =============================================================================
// ConstraintsPanel - Add/remove constraints (together/apart, soft/hard)
// =============================================================================

export function ConstraintsPanel() {
  const [isAdding, setIsAdding] = useState(false);
  const [constraintType, setConstraintType] = useState<"together" | "apart">("together");
  const [isHard, setIsHard] = useState(false);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");

  const softConstraints = useSessionStore((state) => state.softConstraints);
  const addSoftConstraint = useSessionStore((state) => state.addSoftConstraint);
  const removeSoftConstraint = useSessionStore((state) => state.removeSoftConstraint);
  const clearSoftConstraints = useSessionStore((state) => state.clearSoftConstraints);
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const players = usePlayerStore((state) => state.players);

  // Get players in lobby for dropdown
  const lobbyPlayers = useMemo(() => {
    const lobbySet = new Set(lobbyBattletags);
    return Array.from(players.values()).filter((p) => lobbySet.has(p.battletag));
  }, [players, lobbyBattletags]);

  const handleAdd = useCallback(() => {
    if (!playerA || !playerB || playerA === playerB) return;

    const constraint: SoftConstraint = {
      type: constraintType,
      players: [playerA, playerB],
      hard: isHard,
    };

    addSoftConstraint(constraint);
    setPlayerA("");
    setPlayerB("");
    setIsHard(false);
    setIsAdding(false);
  }, [playerA, playerB, constraintType, isHard, addSoftConstraint]);

  const handleRemove = useCallback(
    (players: [string, string]) => {
      removeSoftConstraint(players);
    },
    [removeSoftConstraint]
  );

  const formatPlayerName = (battletag: string) => battletag.split("#")[0];

  // Count hard vs soft constraints
  const hardCount = softConstraints.filter(c => c.hard).length;
  const softCount = softConstraints.length - hardCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-2">
          Constraints
          {softConstraints.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({hardCount > 0 && <span className="text-accent">{hardCount} hard</span>}
              {hardCount > 0 && softCount > 0 && ", "}
              {softCount > 0 && <span>{softCount} soft</span>})
            </span>
          )}
        </h3>
        <div className="flex gap-2 items-center">
          {softConstraints.length > 0 && (
            <button
              onClick={clearSoftConstraints}
              className="text-xs text-muted hover:text-bad transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs px-2.5 py-1 app-primary transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Existing constraints */}
      {softConstraints.length === 0 && !isAdding && (
        <p className="text-xs text-muted">
          No constraints set. Add "together" or "apart" pairs (soft = prefer, hard = must).
        </p>
      )}

      <div className="space-y-2">
        {softConstraints.map((constraint, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-2 text-sm ${
              constraint.hard
                ? "app-alert-accent"
                : "app-card"
            }`}
          >
            <div className="flex items-center gap-2">
              {constraint.hard && (
                <span className="text-xs px-2 py-0.5 app-chip-active font-bold">
                  MUST
                </span>
              )}
              <span className="font-medium text-ink">
                {formatPlayerName(constraint.players[0])}
              </span>
              <span
                className={`text-xs px-2 py-0.5 ${
                  constraint.type === "together"
                    ? "app-alert-success"
                    : "app-alert-error"
                }`}
              >
                {constraint.type === "together" ? "↔ together" : "↮ apart"}
              </span>
              <span className="font-medium text-ink">
                {formatPlayerName(constraint.players[1])}
              </span>
            </div>
            <button
              onClick={() => handleRemove(constraint.players)}
              className="text-muted hover:text-bad text-xs p-1"
              aria-label="Remove constraint"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {/* Add constraint form */}
      {isAdding && (
        <div className="p-3 app-subsurface space-y-3">
          {/* Player A */}
          <select
            value={playerA}
            onChange={(e) => setPlayerA(e.target.value)}
            className="w-full px-3 py-1.5 text-sm app-input"
          >
            <option value="">Select player 1…</option>
            {lobbyPlayers.map((p) => (
              <option key={p.battletag} value={p.battletag}>
                {formatPlayerName(p.battletag)}
              </option>
            ))}
          </select>

          {/* Constraint type */}
          <div className="flex gap-2">
            <button
              onClick={() => setConstraintType("together")}
              className={`flex-1 py-1.5 text-sm transition-colors ${
                constraintType === "together"
                  ? "app-chip-active"
                  : "app-chip"
              }`}
            >
              ↔ Together
            </button>
            <button
              onClick={() => setConstraintType("apart")}
              className={`flex-1 py-1.5 text-sm transition-colors ${
                constraintType === "apart"
                  ? "app-chip-active"
                  : "app-chip"
              }`}
            >
              ↮ Apart
            </button>
          </div>

          {/* Player B */}
          <select
            value={playerB}
            onChange={(e) => setPlayerB(e.target.value)}
            className="w-full px-3 py-1.5 text-sm app-input"
          >
            <option value="">Select player 2…</option>
            {lobbyPlayers
              .filter((p) => p.battletag !== playerA)
              .map((p) => (
                <option key={p.battletag} value={p.battletag}>
                  {formatPlayerName(p.battletag)}
                </option>
              ))}
          </select>

          {/* Hard/Soft toggle */}
          <div className="flex items-center gap-3 p-2 app-card">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={isHard}
                onChange={(e) => setIsHard(e.target.checked)}
                className="w-4 h-4"
              />
              <span className={`text-sm ${isHard ? "text-accent font-semibold" : "text-ink-2"}`}>
                Hard constraint
              </span>
            </label>
            <span className="text-xs text-muted">
              {isHard ? "Balance fails if violated" : "Prefer but may violate"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setIsHard(false);
              }}
              className="flex-1 py-1.5 text-sm app-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!playerA || !playerB || playerA === playerB}
              className="flex-1 py-1.5 text-sm app-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {isHard ? "Hard" : "Soft"} Constraint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
