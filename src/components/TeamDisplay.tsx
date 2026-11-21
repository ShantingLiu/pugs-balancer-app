import { useState, useMemo, useEffect, useRef } from "react";
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

  const prevResultRef = useRef<TeamAssignment | null>(null);

  useEffect(() => {
    if (result !== prevResultRef.current && result !== null) {
      setPostMatchPending(false);
    }
    prevResultRef.current = result;
  }, [result]);

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
      <div className="app-surface p-5 space-y-4">
        <div className="app-well p-5 text-center">
          <div className="text-lg font-semibold text-ink mb-4">Match Complete</div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={handleAutoBalanceNext}
              className="flex-1 py-2.5 px-4 app-primary rounded-pill font-semibold inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Auto-Balance Next Game
            </button>
            <button
              type="button"
              onClick={handleDraftNext}
              className="flex-1 py-2.5 px-4 app-sky rounded-pill font-semibold inline-flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Draft Next Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    const lobbyPlayers = getLobbyPlayers();
    const preAssigned = lobbyPlayers.filter(
      (lp) => lp.lockedToTeam !== null && lp.lockedToRole !== null
    );

    if (preAssigned.length === 0) {
      return (
        <div className="app-surface p-5 flex items-center justify-center py-14 text-muted">
          <div className="text-center space-y-2">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-pill bg-sky-soft border border-sky-edge mx-auto">
              <Scale className="h-6 w-6 text-sky-ink" aria-hidden="true" />
            </span>
            <div className="text-base font-semibold text-ink">No teams generated yet</div>
            <p className="text-sm text-ink-2">
              Add at least {requiredPlayers} players to lobby and click Balance
            </p>
            <p className="text-xs text-muted">
              Tip: Lock a player to a team + role in the lobby to preview them here
            </p>
          </div>
        </div>
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
      <div className="space-y-5">
        <div className="app-surface p-3 text-center border-dashed border-sky-edge">
          <span className="text-sky-ink font-semibold text-sm inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Preview: {preAssigned.length} player{preAssigned.length !== 1 ? "s" : ""} pre-assigned
          </span>
        </div>
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
    <div className="space-y-5">
      {/* Matchup summary bar */}
      {hasTeams && (
      <div className="app-surface p-5">
        <div className="grid grid-cols-3 items-center gap-4 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold app-display text-pink-ink" title={`${team1AvgSR.toFixed(0)} SR`}>
              {formatRankOnly(team1AvgSR, gameMode)}
            </div>
            <div className="text-xs font-bold text-muted uppercase tracking-wider mt-0.5 inline-flex items-center justify-center gap-1">
              {team1AvgSR > team2AvgSR && srDifference >= 25 && (
                <span title="Favored" className="inline-flex text-warn">
                  <Star className="h-3 w-3 fill-current shrink-0" aria-label="Favored" />
                </span>
              )}
              <span>Team 1 MMR</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs md:text-sm font-bold rounded-pill border app-display ${
                srDifference <= 50
                  ? "bg-ok-soft border-ok-edge text-ok"
                  : srDifference <= 100
                  ? "bg-warn-soft border-warn-edge text-warn"
                  : "bg-bad-soft border-bad-edge text-bad"
              }`}
              title={`${srDifference.toFixed(0)} SR difference`}
            >
              <span className="w-1.5 h-1.5 rounded-pill bg-current shrink-0" aria-hidden="true" />
              {srDifference < 25 ? <span>Even</span> : <span>Δ {srDifference.toFixed(0)} SR</span>}
            </div>
            <div className="text-xs font-semibold text-muted mt-1">Difference</div>
          </div>

          <div>
            <div className="text-2xl md:text-3xl font-extrabold app-display text-sky-ink" title={`${team2AvgSR.toFixed(0)} SR`}>
              {formatRankOnly(team2AvgSR, gameMode)}
            </div>
            <div className="text-xs font-bold text-muted uppercase tracking-wider mt-0.5 inline-flex items-center justify-center gap-1">
              {team2AvgSR > team1AvgSR && srDifference >= 25 && (
                <span title="Favored" className="inline-flex text-warn">
                  <Star className="h-3 w-3 fill-current shrink-0" aria-label="Favored" />
                </span>
              )}
              <span>Team 2 MMR</span>
            </div>
          </div>
        </div>
      </div>
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
              <button
                type="button"
                onClick={handleAutoBalanceNext}
                className="flex-1 py-3 px-4 app-primary rounded-well font-bold inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Auto-Balance Next Game
              </button>
              <button
                type="button"
                onClick={handleDraftNext}
                className="flex-1 py-3 px-4 app-sky rounded-well font-bold inline-flex items-center justify-center gap-2"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Draft Next Game
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <HoldButton
                onConfirm={() => handleTeamWon(1)}
                className={`${pendingMatchResult ? "md:col-span-6" : "md:col-span-5"} py-3.5 px-6 app-win-1 rounded-well font-bold text-sm md:text-base`}
                title="Hold for 1 second to confirm Team 1 won"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-pill bg-current shrink-0" aria-hidden="true" />
                  <span>Team 1 Won</span>
                </span>
              </HoldButton>
              <HoldButton
                onConfirm={() => handleTeamWon(2)}
                className={`${pendingMatchResult ? "md:col-span-6" : "md:col-span-5"} py-3.5 px-6 app-sky rounded-well font-bold text-sm md:text-base`}
                title="Hold for 1 second to confirm Team 2 won"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-pill bg-current shrink-0" aria-hidden="true" />
                  <span>Team 2 Won</span>
                </span>
              </HoldButton>
              {!pendingMatchResult && (
                <button
                  type="button"
                  onClick={handleNewGame}
                  className="md:col-span-2 py-3.5 px-4 app-secondary rounded-well font-extrabold text-xs md:text-sm inline-flex items-center justify-center gap-1.5"
                  title="Clear teams without recording a result"
                >
                  <RefreshCw className="h-4 w-4 text-lock shrink-0" aria-hidden="true" />
                  <span>New Game</span>
                </button>
              )}
            </div>
          )}
        </>
      ) : hasErrorWarnings ? null : (
        <div className="app-surface p-5 text-center text-muted py-8">
          Could not generate valid teams. Check warnings above.
        </div>
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
