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
    (pair: [string, string]) => {
      removeSoftConstraint(pair);
    },
    [removeSoftConstraint]
  );

  const formatPlayerName = (battletag: string) => battletag.split("#")[0];

  const hardCount = softConstraints.filter((c) => c.hard).length;
  const softCount = softConstraints.length - hardCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          Constraints
          {softConstraints.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({hardCount > 0 && <span className="text-warn font-semibold">{hardCount} hard</span>}
              {hardCount > 0 && softCount > 0 && ", "}
              {softCount > 0 && <span>{softCount} soft</span>})
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          {softConstraints.length > 0 && (
            <button
              type="button"
              onClick={clearSoftConstraints}
              className="text-xs font-semibold text-bad hover:underline"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs font-semibold px-3 py-1 app-sky rounded-pill"
          >
            + Add
          </button>
        </div>
      </div>

      {softConstraints.length === 0 && !isAdding && (
        <p className="text-xs text-muted">
          No constraints set. Add “together” or “apart” pairs (soft = prefer, hard = must).
        </p>
      )}

      <div className="space-y-2">
        {softConstraints.map((constraint, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between px-3 py-2 rounded-well text-sm border ${
              constraint.hard
                ? "bg-warn-soft border-warn-edge"
                : "bg-paper-3 border-rule"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {constraint.hard && (
                <span className="text-xs px-2 py-0.5 bg-paper-2 border border-warn-edge text-warn rounded-pill font-semibold">
                  Must
                </span>
              )}
              <span className="font-semibold text-ink">
                {formatPlayerName(constraint.players[0])}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-pill border ${
                  constraint.type === "together"
                    ? "bg-ok-soft border-ok-edge text-ok"
                    : "bg-bad-soft border-bad-edge text-bad"
                }`}
              >
                {constraint.type === "together" ? "↔ together" : "↮ apart"}
              </span>
              <span className="font-semibold text-ink">
                {formatPlayerName(constraint.players[1])}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(constraint.players)}
              className="text-muted hover:text-bad p-1 rounded-pill"
              aria-label="Remove constraint"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="p-3.5 app-well space-y-3">
          <select
            value={playerA}
            onChange={(e) => setPlayerA(e.target.value)}
            aria-label="Select player 1"
            className="app-input w-full px-3 py-2 text-sm"
          >
            <option value="">Select player 1…</option>
            {lobbyPlayers.map((p) => (
              <option key={p.battletag} value={p.battletag}>
                {formatPlayerName(p.battletag)}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConstraintType("together")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-pill border ${
                constraintType === "together"
                  ? "bg-ok-soft border-ok-edge text-ok"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-ok-soft"
              }`}
            >
              ↔ Together
            </button>
            <button
              type="button"
              onClick={() => setConstraintType("apart")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-pill border ${
                constraintType === "apart"
                  ? "bg-bad-soft border-bad-edge text-bad"
                  : "bg-paper-2 border-rule text-ink-2 hover:bg-bad-soft"
              }`}
            >
              ↮ Apart
            </button>
          </div>

          <select
            value={playerB}
            onChange={(e) => setPlayerB(e.target.value)}
            aria-label="Select player 2"
            className="app-input w-full px-3 py-2 text-sm"
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

          <div className="flex items-center gap-3 p-2.5 bg-paper-2 border border-rule rounded-well">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={isHard}
                onChange={(e) => setIsHard(e.target.checked)}
                className="w-4 h-4 accent-focus"
              />
              <span className={`text-sm font-semibold ${isHard ? "text-warn" : "text-ink-2"}`}>
                Hard constraint
              </span>
            </label>
            <span className="text-xs text-muted">
              {isHard ? "Balance fails if violated" : "Prefer but may violate"}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setIsHard(false);
              }}
              className="flex-1 py-2 text-sm font-semibold app-secondary rounded-pill"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!playerA || !playerB || playerA === playerB}
              className={`flex-1 py-2 text-sm font-semibold rounded-pill ${
                isHard
                  ? "bg-warn-soft border border-warn-edge text-warn"
                  : "app-primary"
              }`}
            >
              Add {isHard ? "Hard" : "Soft"} Constraint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
