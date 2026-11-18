import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";

// =============================================================================
// Leaderboard - Shows top 10 players by total wins for current mode
// =============================================================================

function getBaselineWins(
  player: { stadiumWins?: number; regular5v5Wins?: number; regular6v6Wins?: number },
  mode: GameMode
): number {
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
        <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Trophy className="h-4 w-4 text-warn" aria-hidden="true" />
          Leaderboard
        </h3>
        <p className="text-xs text-muted">No wins recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Trophy className="h-4 w-4 text-warn" aria-hidden="true" />
          {getModeName(gameMode)} Leaderboard
        </h3>
        <span className="text-xs text-muted">Top 10</span>
      </div>

      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-muted sticky top-0 bg-paper-2 border-b border-rule">
            <tr>
              <th className="text-left py-1.5 px-1 font-bold w-8">#</th>
              <th className="text-left py-1.5 px-1 font-bold">Player</th>
              <th className="text-right py-1.5 px-1 font-bold text-pink-ink">Wins</th>
            </tr>
          </thead>
          <tbody className="text-ink-2 divide-y divide-rule">
            {topPlayers.map((player) => (
              <tr key={player.battletag} className="hover:bg-pink-row-hover">
                <td className="text-left py-2 px-1 text-muted app-measured">
                  {player.rank}
                </td>
                <td className="py-2 px-1 font-bold text-ink break-words" title={player.battletag}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{player.name}</span>
                    {player.rank === 1 && (
                      <span className="w-1.5 h-1.5 rounded-pill bg-ok shrink-0" aria-hidden="true" />
                    )}
                  </span>
                </td>
                <td
                  className="text-right py-2 px-1 text-pink-ink font-extrabold app-measured"
                  title={`CSV: ${player.baselineWins} + Session: ${player.sessionWins} = ${player.totalWins}`}
                >
                  {player.sessionWins > 0 ? (
                    <>
                      {player.baselineWins}
                      <span className="text-ok">+{player.sessionWins}</span>
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
