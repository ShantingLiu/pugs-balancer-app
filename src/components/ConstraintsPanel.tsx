import { useState, useCallback, useMemo } from "react";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import type { SoftConstraint } from "@engine/types";

// =============================================================================
// ConstraintsPanel - Add/remove soft constraints (together/apart)
// =============================================================================

export function ConstraintsPanel() {
  const [isAdding, setIsAdding] = useState(false);
  const [constraintType, setConstraintType] = useState<"together" | "apart">("together");
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
    };

    addSoftConstraint(constraint);
    setPlayerA("");
    setPlayerB("");
    setIsAdding(false);
  }, [playerA, playerB, constraintType, addSoftConstraint]);

  const handleRemove = useCallback(
    (players: [string, string]) => {
      removeSoftConstraint(players);
    },
    [removeSoftConstraint]
  );

  const formatPlayerName = (battletag: string) => battletag.split("#")[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Soft Constraints</h3>
        <div className="flex gap-2">
          {softConstraints.length > 0 && (
            <button
              onClick={clearSoftConstraints}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Existing constraints */}
      {softConstraints.length === 0 && !isAdding && (
        <p className="text-xs text-gray-500">
          No constraints set. Add "prefer together" or "prefer apart" pairs.
        </p>
      )}

      <div className="space-y-2">
        {softConstraints.map((constraint, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 bg-gray-800 rounded-lg text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {formatPlayerName(constraint.players[0])}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  constraint.type === "together"
                    ? "bg-green-600/50 text-green-300"
                    : "bg-red-600/50 text-red-300"
                }`}
              >
                {constraint.type === "together" ? "↔ together" : "↮ apart"}
              </span>
              <span className="font-medium">
                {formatPlayerName(constraint.players[1])}
              </span>
            </div>
            <button
              onClick={() => handleRemove(constraint.players)}
              className="text-gray-400 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add constraint form */}
      {isAdding && (
        <div className="p-3 bg-gray-800 rounded-lg space-y-3">
          {/* Player A */}
          <select
            value={playerA}
            onChange={(e) => setPlayerA(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm"
          >
            <option value="">Select player 1...</option>
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
              className={`flex-1 py-1.5 text-sm rounded transition-colors ${
                constraintType === "together"
                  ? "bg-green-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              ↔ Together
            </button>
            <button
              onClick={() => setConstraintType("apart")}
              className={`flex-1 py-1.5 text-sm rounded transition-colors ${
                constraintType === "apart"
                  ? "bg-red-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              ↮ Apart
            </button>
          </div>

          {/* Player B */}
          <select
            value={playerB}
            onChange={(e) => setPlayerB(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm"
          >
            <option value="">Select player 2...</option>
            {lobbyPlayers
              .filter((p) => p.battletag !== playerA)
              .map((p) => (
                <option key={p.battletag} value={p.battletag}>
                  {formatPlayerName(p.battletag)}
                </option>
              ))}
          </select>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="flex-1 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!playerA || !playerB || playerA === playerB}
              className="flex-1 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Constraint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
