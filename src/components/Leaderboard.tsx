import { useMemo } from "react";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";

// =============================================================================
// Leaderboard - Shows top 10 players by total wins for current mode
// =============================================================================

/** Get mode-specific baseline wins from player */
function getBaselineWins(player: { stadiumWins?: number; regular5v5Wins?: number; regular6v6Wins?: number }, mode: GameMode): number {
  switch (mode) {
    case "stadium_5v5":
      return player.stadiumWins ?? 0;
    case "regular_5v5":
      return player.regular5v5Wins ?? 0;
    case "regular_6v6":
      return player.regular6v6Wins ?? 0;
    default:
      return 0;
  }
}

/** Get display name for mode */
function getModeName(mode: GameMode): string {
  switch (mode) {
    case "stadium_5v5":
      return "Stadium";
    case "regular_5v5":
      return "5v5";
    case "regular_6v6":
      return "6v6";
    default:
      return mode;
  }
}

export function Leaderboard() {
  const players = usePlayerStore((state) => state.players);
  const sessionWins = useSessionStore((state) => state.totalWins);
  const gameMode = useSessionStore((state) => state.gameMode);

  const topPlayers = useMemo(() => {
    const allPlayers = Array.from(players.values());
    const modeSessionWins = sessionWins[gameMode];
    
    // Calculate total wins for current mode = CSV baseline + session wins
    const playersWithTotals = allPlayers.map((p) => {
      const baseline = getBaselineWins(p, gameMode);
      const session = modeSessionWins.get(p.battletag) ?? 0;
      return {
        battletag: p.battletag,
        name: p.battletag.split("#")[0],
        baselineWins: baseline,
        sessionWins: session,
        totalWins: baseline + session,
      };
    });

    // Filter to players with at least 1 win, sort by total wins descending
    return playersWithTotals
      .filter((p) => p.totalWins > 0)
      .sort((a, b) => b.totalWins - a.totalWins)
      .slice(0, 10)
      .map((p, index) => ({
        rank: index + 1,
        ...p,
      }));
  }, [players, sessionWins, gameMode]);

  if (topPlayers.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">🏆 Leaderboard</h3>
        <p className="text-xs text-gray-500">No wins recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300">🏆 {getModeName(gameMode)} Leaderboard</h3>
      <p className="text-xs text-gray-500 mb-2">Top 10 by {getModeName(gameMode)} wins</p>
      
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-400 sticky top-0 bg-gray-900">
            <tr>
              <th className="text-center py-1 px-1 w-8">#</th>
              <th className="text-left py-1 px-1">Player</th>
              <th className="text-center py-1 px-1 text-yellow-400">Wins</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {topPlayers.map((player) => (
              <tr 
                key={player.battletag}
                className="hover:bg-gray-800/50 transition-colors"
              >
                <td className="text-center py-0.5 px-1 text-gray-500">
                  {player.rank === 1 && "🥇"}
                  {player.rank === 2 && "🥈"}
                  {player.rank === 3 && "🥉"}
                  {player.rank > 3 && player.rank}
                </td>
                <td className="py-0.5 px-1 truncate max-w-[100px]" title={player.battletag}>
                  {player.name}
                </td>
                <td 
                  className="text-center py-0.5 px-1 text-yellow-400 font-medium"
                  title={`CSV: ${player.baselineWins} + Session: ${player.sessionWins} = ${player.totalWins}`}
                >
                  {player.sessionWins > 0 ? (
                    <>
                      {player.baselineWins}
                      <span className="text-green-400">+{player.sessionWins}</span>
                    </>
                  ) : (
                    player.totalWins
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
