import { useMemo, useCallback } from "react";
import { useSessionStore } from "@store/sessionStore";

// =============================================================================
// StatsPanel - Shows win/loss/sat-out stats for lobby players (current mode)
// =============================================================================

interface PlayerStats {
  battletag: string;
  name: string;
  wins: number;
  losses: number;
  satOut: number;
  gamesPlayed: number;
  winRate: number;
}

export function StatsPanel() {
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const gameMode = useSessionStore((state) => state.gameMode);
  const totalWins = useSessionStore((state) => state.totalWins);
  const totalLosses = useSessionStore((state) => state.totalLosses);
  const totalSatOut = useSessionStore((state) => state.totalSatOut);
  const clearSessionStats = useSessionStore((state) => state.clearSessionStats);
  const adaptiveWeights = useSessionStore((state) => state.adaptiveWeights);
  const clearAdaptiveWeights = useSessionStore((state) => state.clearAdaptiveWeights);

  const handleClear = useCallback(() => {
    if (confirm("Clear all session stats? This cannot be undone.")) {
      clearSessionStats();
    }
  }, [clearSessionStats]);

  const handleClearAdaptive = useCallback(() => {
    if (confirm("Reset all Auto-SR adjustments? Players will return to their base SR.")) {
      clearAdaptiveWeights();
    }
  }, [clearAdaptiveWeights]);

  const stats = useMemo((): PlayerStats[] => {
    const modeWins = totalWins[gameMode];
    const modeLosses = totalLosses[gameMode];

    return lobbyBattletags.map((battletag) => {
      const wins = modeWins.get(battletag) || 0;
      const losses = modeLosses.get(battletag) || 0;
      const satOut = totalSatOut.get(battletag) || 0;
      const gamesPlayed = wins + losses;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

      return {
        battletag,
        name: battletag.split("#")[0],
        wins,
        losses,
        satOut,
        gamesPlayed,
        winRate,
      };
    });
  }, [lobbyBattletags, gameMode, totalWins, totalLosses, totalSatOut]);

  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      return a.losses - b.losses;
    });
  }, [stats]);

  const hasData = stats.some((s) => s.gamesPlayed > 0 || s.satOut > 0);

  if (!hasData) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-heading">Session Stats</h3>
        <p className="text-xs text-muted">
          Stats will appear after games are played.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-heading">Session Stats</h3>
        <div className="flex gap-3">
          {adaptiveWeights.size > 0 && (
            <button
              type="button"
              onClick={handleClearAdaptive}
              className="text-xs font-semibold text-pink-ink hover:underline"
              title="Reset Auto-SR adjustments only"
            >
              Reset Auto-SR
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-semibold text-bad hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-muted sticky top-0 bg-paper-2 border-b border-rule">
            <tr>
              <th className="text-left py-1.5 px-1 font-semibold">Player</th>
              <th className="text-center py-1.5 px-1 font-semibold text-ok" title="Wins">W</th>
              <th className="text-center py-1.5 px-1 font-semibold text-bad" title="Losses">L</th>
              <th className="text-center py-1.5 px-1 font-semibold text-warn" title="Sat Out">S</th>
              <th className="text-center py-1.5 px-1 font-semibold" title="Win Rate">%</th>
            </tr>
          </thead>
          <tbody className="text-ink-2 divide-y divide-rule">
            {sortedStats.map((player) => (
              <tr key={player.battletag} className="hover:bg-sky-soft/60">
                <td className="py-1.5 px-1 font-semibold text-ink break-words" title={player.name}>
                  {player.name}
                </td>
                <td className="text-center py-1.5 px-1 text-ok font-semibold app-measured">
                  {player.wins || "-"}
                </td>
                <td className="text-center py-1.5 px-1 text-bad font-semibold app-measured">
                  {player.losses || "-"}
                </td>
                <td className="text-center py-1.5 px-1 text-warn font-semibold app-measured">
                  {player.satOut || "-"}
                </td>
                <td className="text-center py-1.5 px-1 app-measured">
                  {player.gamesPlayed > 0 ? (
                    <span className={`font-semibold ${player.winRate >= 50 ? "text-ok" : "text-bad"}`}>
                      {player.winRate}%
                    </span>
                  ) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
