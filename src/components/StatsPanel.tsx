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

  // Sort by most wins first, then by fewest losses as tiebreaker
  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => {
      // Primary: most wins first
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      // Tiebreaker: fewer losses first
      return a.losses - b.losses;
    });
  }, [stats]);

  // Check if there's any data to show
  const hasData = stats.some((s) => s.gamesPlayed > 0 || s.satOut > 0);

  if (!hasData) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">Session Stats</h3>
        <p className="text-xs text-gray-500">
          Stats will appear after games are played.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Session Stats</h3>
        <div className="flex gap-2">
          {adaptiveWeights.size > 0 && (
            <button
              onClick={handleClearAdaptive}
              className="text-xs text-gray-400 hover:text-orange-400 transition-colors"
              title="Reset Auto-SR adjustments only"
            >
              Reset Auto-SR
            </button>
          )}
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-400 sticky top-0 bg-gray-900">
            <tr>
              <th className="text-left py-1 px-1">Player</th>
              <th className="text-center py-1 px-1 text-green-400" title="Wins">W</th>
              <th className="text-center py-1 px-1 text-red-400" title="Losses">L</th>
              <th className="text-center py-1 px-1 text-yellow-400" title="Sat Out">S</th>
              <th className="text-center py-1 px-1" title="Win Rate">%</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {sortedStats.map((player) => (
              <tr 
                key={player.battletag}
                className="hover:bg-gray-800/50 transition-colors"
              >
                <td className="py-0.5 px-1 truncate max-w-[80px]" title={player.name}>
                  {player.name}
                </td>
                <td className="text-center py-0.5 px-1 text-green-400">
                  {player.wins || "-"}
                </td>
                <td className="text-center py-0.5 px-1 text-red-400">
                  {player.losses || "-"}
                </td>
                <td className="text-center py-0.5 px-1 text-yellow-400">
                  {player.satOut || "-"}
                </td>
                <td className="text-center py-0.5 px-1">
                  {player.gamesPlayed > 0 ? (
                    <span className={player.winRate >= 50 ? "text-green-400" : "text-red-400"}>
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
