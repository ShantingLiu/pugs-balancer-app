import { useState, useMemo } from "react";
import { Users, RefreshCw, MapPin, Scale, Star } from "lucide-react";
import type { TeamAssignment, Player, RoleAssignment, LobbyPlayer, GameMode } from "@engine/types";
import { TeamColumn } from "./TeamColumn";
import { WarningsPanel } from "./WarningsPanel";
import { AddPlayerModal } from "./AddPlayerModal";
import { HoldButton } from "./HoldButton";
import { MatchScoreModal } from "./MatchScoreModal";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import { formatRankOnly, getEffectiveSR } from "@utils/rankMapper";
import { getRequiredPlayers } from "@engine/modeConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Calculate team average SR from assignments using current lobby player state */
function calculateTeamAvgSR(
  assignments: RoleAssignment[],
  lobbyMap: Map<string, LobbyPlayer>,
  gameMode: GameMode
): number {
  if (assignments.length === 0) return 0;

  let total = 0;
  for (const assignment of assignments) {
    const lobbyPlayer = lobbyMap.get(assignment.player.battletag);
    if (lobbyPlayer) {
      total += getEffectiveSR(lobbyPlayer, assignment.assignedRole, gameMode);
    } else {
      total += assignment.effectiveSR;
    }
  }
  return total / assignments.length;
}

// =============================================================================
// TeamDisplay - Displays balanced team results
// =============================================================================

interface TeamDisplayProps {
  result: TeamAssignment | null;
}

export function TeamDisplay({ result }: TeamDisplayProps) {
  const gameMode = useSessionStore((state) => state.gameMode);
  const pendingMatchResult = useSessionStore((state) => state.pendingMatchResult);
  const setPendingMatchResult = useSessionStore((state) => state.setPendingMatchResult);
  const confirmMatchScore = useSessionStore((state) => state.confirmMatchScore);
  const cancelPendingMatch = useSessionStore((state) => state.cancelPendingMatch);
  const autoBalanceAfterMatch = useSessionStore((state) => state.autoBalanceAfterMatch);
  const clearTeams = useSessionStore((state) => state.clearTeams);
  const setDraftMode = useSessionStore((state) => state.setDraftMode);
  const getPlayer = usePlayerStore((state) => state.getPlayer);
  const swapPlayerRoles = useSessionStore((state) => state.swapPlayerRoles);

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [postMatchPending, setPostMatchPending] = useState(false);
  const [swapSource, setSwapSource] = useState<string | null>(null);
  const [prevResult, setPrevResult] = useState<TeamAssignment | null>(result);

  if (result !== prevResult) {
    setPrevResult(result);
    if (result !== null) {
      setPostMatchPending(false);
    }
  }

  const requiredPlayers = getRequiredPlayers(gameMode);

  const handleSwapClick = (battletag: string) => {
    if (!swapSource) {
      setSwapSource(battletag);
    } else if (swapSource === battletag) {
      setSwapSource(null);
    } else {
      swapPlayerRoles(swapSource, battletag);
      setSwapSource(null);
    }
  };

  const handleTeamWon = (team: 1 | 2) => {
    setPendingMatchResult(team);
  };

  const handleScoreConfirm = (
    winnerScore: number,
    loserScore: number,
    team1Cash?: number,
    team2Cash?: number,
    winnerAdj?: number,
    loserAdj?: number
  ) => {
    confirmMatchScore(winnerScore, loserScore, team1Cash, team2Cash, winnerAdj, loserAdj);
    setPostMatchPending(true);
  };

  const handleAutoBalanceNext = () => {
    setPostMatchPending(false);
    setTimeout(() => {
      autoBalanceAfterMatch();
    }, 0);
  };

  const handleDraftNext = () => {
    setPostMatchPending(false);
    clearTeams();
    setDraftMode(true);
  };

  const handleNewGame = () => {
    clearTeams();
  };

  const handleScoreCancel = () => {
    cancelPendingMatch();
  };

  const handleEditPlayer = (battletag: string) => {
    const player = getPlayer(battletag);
    if (player) {
      setEditingPlayer(player);
    }
  };

  const getLobbyPlayers = useSessionStore((state) => state.getLobbyPlayers);
  useSessionStore((state) => state.lockedTeam1);
  useSessionStore((state) => state.lockedTeam2);
  useSessionStore((state) => state.lockedRoles);
  useSessionStore((state) => state.tempWeightOverrides);
  useSessionStore((state) => state.adaptiveWeights);

  const lobbyMap = useMemo(() => {
    const lobbyPlayers = getLobbyPlayers();
    return new Map(lobbyPlayers.map((lp) => [lp.battletag, lp]));
  }, [getLobbyPlayers]);

  if (!result && postMatchPending) {
    return (
      <Card variant="surface" className="p-5 gap-4">
        <Card variant="well" className="p-5 gap-4 text-center">
          <CardHeader className="p-0">
            <CardTitle className="text-lg">Match Complete</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAutoBalanceNext}
                className="flex-1"
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Auto-Balance Next Game
              </Button>
              <Button
                variant="sky"
                size="lg"
                onClick={handleDraftNext}
                className="flex-1"
              >
                <Users data-icon="inline-start" aria-hidden="true" />
                Draft Next Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </Card>
    );
  }

  if (!result) {
    const lobbyPlayers = getLobbyPlayers();
    const preAssigned = lobbyPlayers.filter(
      (lp) => lp.lockedToTeam !== null && lp.lockedToRole !== null
    );

    if (preAssigned.length === 0) {
      return (
        <Card variant="surface" className="p-5">
          <Empty>
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-12 rounded-pill bg-sky-soft border-sky-edge text-sky-ink"
              >
                <Scale aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No teams generated yet</EmptyTitle>
              <EmptyDescription>
                Add at least {requiredPlayers} players to lobby and click Balance
              </EmptyDescription>
              <p className="text-xs text-muted">
                Tip: Lock a player to a team + role in the lobby to preview them here
              </p>
            </EmptyHeader>
          </Empty>
        </Card>
      );
    }

    const team1Preview: RoleAssignment[] = preAssigned
      .filter((lp) => lp.lockedToTeam === 1)
      .map((lp) => ({
        player: lp,
        assignedRole: lp.lockedToRole!,
        effectiveSR: getEffectiveSR(lp, lp.lockedToRole!, gameMode),
      }));
    const team2Preview: RoleAssignment[] = preAssigned
      .filter((lp) => lp.lockedToTeam === 2)
      .map((lp) => ({
        player: lp,
        assignedRole: lp.lockedToRole!,
        effectiveSR: getEffectiveSR(lp, lp.lockedToRole!, gameMode),
      }));

    return (
      <div className="flex flex-col gap-5">
        <Card variant="surface" className="p-3 border-dashed border-sky-edge">
          <CardContent className="p-0 text-center">
            <span className="text-sky-ink font-semibold text-sm inline-flex items-center justify-center gap-2">
              <MapPin className="size-4" aria-hidden="true" />
              Preview: {preAssigned.length} player{preAssigned.length !== 1 ? "s" : ""} pre-assigned
            </span>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TeamColumn
            teamNumber={1}
            assignments={team1Preview}
            averageSR={
              team1Preview.length > 0
                ? team1Preview.reduce((sum, a) => sum + a.effectiveSR, 0) / team1Preview.length
                : 0
            }
            onEditPlayer={handleEditPlayer}
            swapSource={swapSource}
            onSwapClick={handleSwapClick}
          />
          <TeamColumn
            teamNumber={2}
            assignments={team2Preview}
            averageSR={
              team2Preview.length > 0
                ? team2Preview.reduce((sum, a) => sum + a.effectiveSR, 0) / team2Preview.length
                : 0
            }
            onEditPlayer={handleEditPlayer}
            swapSource={swapSource}
            onSwapClick={handleSwapClick}
          />
        </div>
      </div>
    );
  }

  const { team1, team2, warnings } = result;
  const hasTeams = team1.length > 0 && team2.length > 0;
  const team1AvgSR = calculateTeamAvgSR(team1, lobbyMap, gameMode);
  const team2AvgSR = calculateTeamAvgSR(team2, lobbyMap, gameMode);
  const srDifference = Math.abs(team1AvgSR - team2AvgSR);

  const hasErrorWarnings = warnings.some((w) => w.severity === "error");

  return (
    <div className="flex flex-col gap-5">
      {/* Matchup summary bar */}
      {hasTeams && (
        <Card variant="surface" className="p-5">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 items-center gap-4 text-center">
              <div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div className="text-2xl md:text-3xl font-extrabold app-display text-pink-ink inline-block" />
                    }
                  >
                    {formatRankOnly(team1AvgSR, gameMode)}
                  </TooltipTrigger>
                  <TooltipContent>{`${team1AvgSR.toFixed(0)} SR`}</TooltipContent>
                </Tooltip>
                <div className="text-xs font-bold text-muted uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
                  {team1AvgSR > team2AvgSR && srDifference >= 25 && (
                    <Tooltip>
                      <TooltipTrigger render={<span className="inline-flex text-warn" />}>
                        <Star className="size-3 fill-current shrink-0" aria-label="Favored" />
                      </TooltipTrigger>
                      <TooltipContent>Favored</TooltipContent>
                    </Tooltip>
                  )}
                  <span>Team 1 MMR</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge
                        variant={srDifference <= 50 ? "ok" : srDifference <= 100 ? "warn" : "bad"}
                        className="gap-1.5 px-3 py-1 text-xs md:text-sm font-bold app-display"
                      />
                    }
                  >
                    <span className="size-1.5 rounded-pill bg-current shrink-0" aria-hidden="true" />
                    {srDifference < 25 ? <span>Even</span> : <span>Δ {srDifference.toFixed(0)} SR</span>}
                  </TooltipTrigger>
                  <TooltipContent>{`${srDifference.toFixed(0)} SR difference`}</TooltipContent>
                </Tooltip>
                <div className="text-xs font-semibold text-muted mt-1">Difference</div>
              </div>

              <div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div className="text-2xl md:text-3xl font-extrabold app-display text-sky-ink inline-block" />
                    }
                  >
                    {formatRankOnly(team2AvgSR, gameMode)}
                  </TooltipTrigger>
                  <TooltipContent>{`${team2AvgSR.toFixed(0)} SR`}</TooltipContent>
                </Tooltip>
                <div className="text-xs font-bold text-muted uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
                  {team2AvgSR > team1AvgSR && srDifference >= 25 && (
                    <Tooltip>
                      <TooltipTrigger render={<span className="inline-flex text-warn" />}>
                        <Star className="size-3 fill-current shrink-0" aria-label="Favored" />
                      </TooltipTrigger>
                      <TooltipContent>Favored</TooltipContent>
                    </Tooltip>
                  )}
                  <span>Team 2 MMR</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && <WarningsPanel warnings={warnings} compact />}

      {/* Team columns */}
      {hasTeams ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TeamColumn
              teamNumber={1}
              assignments={team1}
              averageSR={team1AvgSR}
              onEditPlayer={handleEditPlayer}
              swapSource={swapSource}
              onSwapClick={handleSwapClick}
            />
            <TeamColumn
              teamNumber={2}
              assignments={team2}
              averageSR={team2AvgSR}
              onEditPlayer={handleEditPlayer}
              swapSource={swapSource}
              onSwapClick={handleSwapClick}
            />
          </div>

          {postMatchPending ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                shape="well"
                onClick={handleAutoBalanceNext}
                className="flex-1 py-3 px-4 font-bold"
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Auto-Balance Next Game
              </Button>
              <Button
                variant="sky"
                shape="well"
                onClick={handleDraftNext}
                className="flex-1 py-3 px-4 font-bold"
              >
                <Users data-icon="inline-start" aria-hidden="true" />
                Draft Next Game
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <HoldButton
                onConfirm={() => handleTeamWon(1)}
                variant="win1"
                shape="well"
                className={cn(
                  pendingMatchResult ? "md:col-span-6" : "md:col-span-5",
                  "py-3.5 px-6 font-bold text-sm md:text-base"
                )}
                title="Hold for 1 second to confirm Team 1 won"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="size-2 rounded-pill bg-current shrink-0" aria-hidden="true" />
                  <span>Team 1 Won</span>
                </span>
              </HoldButton>
              <HoldButton
                onConfirm={() => handleTeamWon(2)}
                variant="sky"
                shape="well"
                className={cn(
                  pendingMatchResult ? "md:col-span-6" : "md:col-span-5",
                  "py-3.5 px-6 font-bold text-sm md:text-base"
                )}
                title="Hold for 1 second to confirm Team 2 won"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="size-2 rounded-pill bg-current shrink-0" aria-hidden="true" />
                  <span>Team 2 Won</span>
                </span>
              </HoldButton>
              {!pendingMatchResult && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="secondary"
                        shape="well"
                        size="sm"
                        onClick={handleNewGame}
                        className="md:col-span-2 py-3.5 px-4 font-extrabold text-xs md:text-sm"
                      />
                    }
                  >
                    <RefreshCw className="text-lock" data-icon="inline-start" aria-hidden="true" />
                    <span>New Game</span>
                  </TooltipTrigger>
                  <TooltipContent>Clear teams without recording a result</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </>
      ) : hasErrorWarnings ? null : (
        <Card variant="surface" className="p-5">
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyDescription>
                Could not generate valid teams. Check warnings above.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      )}

        {/* Edit Player Modal */}
        <AddPlayerModal
          isOpen={!!editingPlayer}
          onClose={() => setEditingPlayer(null)}
          editPlayer={editingPlayer}
        />

        {/* Match Score Modal */}
        <MatchScoreModal
          isOpen={!!pendingMatchResult}
          winningTeam={pendingMatchResult?.winningTeam ?? 1}
          onConfirm={handleScoreConfirm}
          onCancel={handleScoreCancel}
        />
    </div>
  );
}
