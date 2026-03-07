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
  const draftMode = useSessionStore((state) => state.draftMode);
  const lockedTeam1 = useSessionStore((state) => state.lockedTeam1);
  const lockedTeam2 = useSessionStore((state) => state.lockedTeam2);

  // Calculate who is sitting out (in lobby but not on a team)
  const spectators = useMemo(() => {
    if (draftMode) {
      // In draft mode, use locked teams instead of lastResult
      if (lockedTeam1.size === 0 && lockedTeam2.size === 0) return [];
      return lobbyBattletags.filter(
        (bt) => !lockedTeam1.has(bt) && !lockedTeam2.has(bt)
      );
    }

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
  }, [lastResult, lobbyBattletags, draftMode, lockedTeam1, lockedTeam2]);

  // Don't render anything if no teams or no spectators
  const hasTeams = draftMode
    ? (lockedTeam1.size > 0 || lockedTeam2.size > 0)
    : (lastResult && lastResult.team1.length > 0);
  if (!hasTeams || spectators.length === 0) {
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
          const isMustPlay = mustPlay.has(bt) || (draftMode && !isAfk);
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
