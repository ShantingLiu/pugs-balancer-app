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
    <div className="app-surface p-4">
      <h2 className="text-sm font-semibold text-ink-2 mb-2">
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
              className={`px-3 py-1 text-sm ${
                isAfk
                  ? "app-chip opacity-65"
                  : isMustPlay
                  ? "app-badge outline outline-1 outline-[var(--color-accent)]"
                  : "app-chip"
              }`}
              title={bt + (isAfk ? " (AFK)" : isMustPlay ? " (Must Play Next)" : "")}
            >
              {isMustPlay && !isAfk && <span className="text-accent mr-1 font-medium">Must</span>}{name}{isAfk && <span className="text-muted ml-1">AFK</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
