import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { usePlayerStore } from "@store/playerStore";
import { useSessionStore } from "@store/sessionStore";
import type { GameMode } from "@engine/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Trophy className="size-4 text-warn" aria-hidden="true" />
          Leaderboard
        </h3>
        <Empty className="gap-2 p-4 md:p-4">
          <EmptyHeader className="gap-1">
            <EmptyDescription className="text-xs">
              No wins recorded yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Trophy className="size-4 text-warn" aria-hidden="true" />
          {getModeName(gameMode)} Leaderboard
        </h3>
        <span className="text-xs text-muted">Top 10</span>
      </div>

      <div className="max-h-48 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-paper-2">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-1 w-8">#</TableHead>
              <TableHead className="px-1">Player</TableHead>
              <TableHead className="px-1 text-right text-pink-ink">Wins</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topPlayers.map((player) => (
              <TableRow key={player.battletag}>
                <TableCell className="px-1 text-muted app-measured">
                  {player.rank}
                </TableCell>
                <TableCell className="px-1 font-bold text-ink break-words">
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex items-center gap-1.5" />}>
                      <span>{player.name}</span>
                      {player.rank === 1 && (
                        <span
                          className="size-1.5 rounded-pill bg-ok shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>{player.battletag}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="px-1 text-right text-pink-ink font-extrabold app-measured">
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-block" />}>
                      {player.sessionWins > 0 ? (
                        <>
                          {player.baselineWins}
                          <span className="text-ok">+{player.sessionWins}</span>
                        </>
                      ) : (
                        player.totalWins
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {`CSV: ${player.baselineWins} + Session: ${player.sessionWins} = ${player.totalWins}`}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
