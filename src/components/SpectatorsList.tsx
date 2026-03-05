import { useMemo } from "react";
import { useSessionStore } from "@store/sessionStore";

// =============================================================================
// SpectatorsList - Shows players sitting out / spectating the current match
// =============================================================================

export function SpectatorsList() {
  const lastResult = useSessionStore((state) => state.lastResult);
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const afkPlayers = useSessionStore((state) => state.afkPlayers);
  const mustPlay = useSessionStore((state) => state.mustPlay);

  // Calculate who is sitting out (in lobby but not on a team)
  const spectators = useMemo(() => {
    if (!lastResult || lastResult.team1.length === 0) {
      return [];
    }

    const playingBattletags = new Set([
      ...lastResult.team1.map((ra) => ra.player.battletag),
      ...lastResult.team2.map((ra) => ra.player.battletag),
    ]);

    return lobbyBattletags.filter(
      (bt) => !playingBattletags.has(bt)
    );
  }, [lastResult, lobbyBattletags]);

  // Don't render anything if no teams or no spectators
  if (!lastResult || lastResult.team1.length === 0 || spectators.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-400 mb-2">
        Sitting Out / Spectating ({spectators.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {spectators.map((bt) => {
          const name = bt.split("#")[0];
          const isAfk = afkPlayers.has(bt);
          const isMustPlay = mustPlay.has(bt);
          return (
            <span
              key={bt}
              className={`px-3 py-1 text-sm rounded-full ${
                isAfk 
                  ? "bg-gray-600 text-gray-400" 
                  : isMustPlay
                    ? "bg-yellow-600/30 text-yellow-300 ring-1 ring-yellow-500"
                    : "bg-gray-700 text-gray-300"
              }`}
              title={bt + (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "")}
            >
              {isMustPlay && !isAfk && "★ "}{name}{isAfk && " 💤"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
