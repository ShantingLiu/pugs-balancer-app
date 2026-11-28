import { useMemo, useState } from "react";
import { useSessionStore } from "@store/sessionStore";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

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

type ConfirmAction = "clear-stats" | "reset-adaptive" | null;
type ActiveConfirmAction = Exclude<ConfirmAction, null>;

export function StatsPanel() {
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const gameMode = useSessionStore((state) => state.gameMode);
  const totalWins = useSessionStore((state) => state.totalWins);
  const totalLosses = useSessionStore((state) => state.totalLosses);
  const totalSatOut = useSessionStore((state) => state.totalSatOut);
  const clearSessionStats = useSessionStore((state) => state.clearSessionStats);
  const adaptiveWeights = useSessionStore((state) => state.adaptiveWeights);
  const clearAdaptiveWeights = useSessionStore((state) => state.clearAdaptiveWeights);

  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);
  const [displayAction, setDisplayAction] = useState<ActiveConfirmAction>("clear-stats");

  const openConfirm = (action: ActiveConfirmAction) => {
    setDisplayAction(action);
    setPendingAction(action);
  };

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

  return (
    <>
      {!hasData ? (
        <div className="flex flex-col justify-between h-full gap-3">
          <div>
            <h3 className="text-sm font-bold text-heading mb-1.5">Session Stats</h3>
            <p className="text-xs text-muted">
              Stats will appear after games are played.
            </p>
          </div>
          <Empty className="min-h-28 gap-2 p-4 md:p-4">
            <EmptyHeader className="gap-1">
              <EmptyDescription className="text-xs inline-flex items-center gap-2">
                <span className="size-1.5 rounded-pill bg-pink-ink animate-ping shrink-0" aria-hidden="true" />
                <span>Awaiting match recording...</span>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-heading">Session Stats</h3>
            <div className="flex items-center gap-3">
              {adaptiveWeights.size > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => openConfirm("reset-adaptive")}
                        className="px-0 py-0 text-pink-ink"
                      />
                    }
                  >
                    Reset Auto-SR
                  </TooltipTrigger>
                  <TooltipContent>Reset Auto-SR adjustments only</TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="link"
                size="xs"
                onClick={() => openConfirm("clear-stats")}
                className="px-0 py-0 text-bad"
              >
                Clear
              </Button>
            </div>
          </div>

        <div className="max-h-48 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-paper-2">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-1 font-semibold">Player</TableHead>
                <TableHead className="px-1 text-center font-semibold text-ok">
                  <Tooltip>
                    <TooltipTrigger render={<span />}>W</TooltipTrigger>
                    <TooltipContent>Wins</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="px-1 text-center font-semibold text-bad">
                  <Tooltip>
                    <TooltipTrigger render={<span />}>L</TooltipTrigger>
                    <TooltipContent>Losses</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="px-1 text-center font-semibold text-warn">
                  <Tooltip>
                    <TooltipTrigger render={<span />}>S</TooltipTrigger>
                    <TooltipContent>Sat Out</TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="px-1 text-center font-semibold">
                  <Tooltip>
                    <TooltipTrigger render={<span />}>%</TooltipTrigger>
                    <TooltipContent>Win Rate</TooltipContent>
                  </Tooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStats.map((player) => (
                <TableRow key={player.battletag} className="hover:bg-sky-soft/60">
                  <TableCell className="py-1.5 px-1 font-semibold text-ink break-words">
                    <Tooltip>
                      <TooltipTrigger render={<span />}>{player.name}</TooltipTrigger>
                      <TooltipContent>{player.battletag}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="py-1.5 px-1 text-center text-ok font-semibold app-measured">
                    {player.wins || "-"}
                  </TableCell>
                  <TableCell className="py-1.5 px-1 text-center text-bad font-semibold app-measured">
                    {player.losses || "-"}
                  </TableCell>
                  <TableCell className="py-1.5 px-1 text-center text-warn font-semibold app-measured">
                    {player.satOut || "-"}
                  </TableCell>
                  <TableCell className="py-1.5 px-1 text-center app-measured">
                    {player.gamesPlayed > 0 ? (
                      <span className={cn("font-semibold", player.winRate >= 50 ? "text-ok" : "text-bad")}>
                        {player.winRate}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </div>
      )}

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {displayAction === "reset-adaptive"
                ? "Reset Auto-SR Adjustments?"
                : "Clear Session Stats?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {displayAction === "reset-adaptive"
                ? "Reset all Auto-SR adjustments? Players will return to their base SR."
                : "Clear all session stats? This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={displayAction === "clear-stats" ? "danger" : "primary"}
              onClick={() => {
                if (pendingAction === "reset-adaptive") {
                  clearAdaptiveWeights();
                } else if (pendingAction === "clear-stats") {
                  clearSessionStats();
                }
                setPendingAction(null);
              }}
            >
              {displayAction === "reset-adaptive" ? "Reset Auto-SR" : "Clear Stats"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
