import { useState, useMemo } from "react";
import { Users, RefreshCw, MapPin, Scale, Trophy } from "lucide-react";
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
  const [postMatchSnapshot, setPostMatchSnapshot] = useState<{
    active: boolean;
    resultAtConfirm: TeamAssignment | null;
  }>({ active: false, resultAtConfirm: null });
  const [swapSource, setSwapSource] = useState<string | null>(null);

  // Bug #27 fix: post-match state clears automatically if result changes to a new non-null assignment (e.g., Reshuffle)
  const postMatchPending =
    postMatchSnapshot.active &&
    (result === null || result === postMatchSnapshot.resultAtConfirm);

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
    setPostMatchSnapshot({ active: true, resultAtConfirm: result });
  };

  const handleAutoBalanceNext = () => {
    setPostMatchSnapshot({ active: false, resultAtConfirm: null });
    setTimeout(() => {
      autoBalanceAfterMatch();
    }, 0);
  };

  const handleDraftNext = () => {
    setPostMatchSnapshot({ active: false, resultAtConfirm: null });
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

  // Build preview from pre-assigned players (both team + role locked)
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

  // If post-match pending but no result (teams were cleared), show post-match buttons
  if (!result && postMatchPending) {
    return (
      <div className="space-y-4">
        <div className="app-subsurface p-4 text-center">
          <div className="text-lg font-semibold text-ink mb-4">Match Complete!</div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleAutoBalanceNext}
              className="flex-1 py-2 px-4 app-primary font-medium transition-colors"
            >
              <RefreshCw className="inline h-4 w-4 mr-2" aria-hidden="true" />
              Auto-Balance Next Game
            </button>
            <button
              onClick={handleDraftNext}
              className="flex-1 py-2 px-4 app-secondary font-medium transition-colors"
            >
              <Users className="inline h-4 w-4 mr-2" aria-hidden="true" />
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
        <div className="flex items-center justify-center h-64 text-muted">
          <div className="text-center">
            <Scale className="h-10 w-10 mx-auto mb-2 text-muted" aria-hidden="true" />
            <div className="font-medium text-ink">No teams generated yet</div>
            <div className="text-sm mt-1">
              Add at least {requiredPlayers} players to lobby and click Balance
            </div>
            <div className="text-xs mt-2 text-muted">
              Tip: Lock a player to a team + role in the lobby to preview them here
            </div>
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
      <div className="space-y-4">
        <div className="app-subsurface p-3 text-center border-dashed border-[var(--color-rule-2)]">
          <span className="text-ink-2 text-sm inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
            Preview: {preAssigned.length} player{preAssigned.length !== 1 ? "s" : ""} pre-assigned
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
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

  return (
    <div className="space-y-4">
      {/* Score summary */}
      <div className="app-subsurface p-4">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent" title={`${team1AvgSR.toFixed(0)} SR`}>
              {formatRankOnly(team1AvgSR, gameMode)}
            </div>
            <div className="text-sm text-muted">Team 1</div>
            <div className="text-xs mt-1 h-4">
              {team1AvgSR > team2AvgSR && srDifference >= 25 && (
                <span className="text-ok font-medium">Favored</span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div
              className={`text-xl font-bold app-measured ${
                srDifference <= 50
                  ? "text-ok"
                  : srDifference <= 100
                  ? "text-accent"
                  : "text-bad"
              }`}
              title={`${srDifference.toFixed(0)} SR difference`}
            >
              {srDifference < 25 ? (
                <span>Even</span>
              ) : (
                <span>Delta {srDifference.toFixed(0)} SR</span>
              )}
            </div>
            <div className="text-sm text-muted">Difference</div>
            <div className="h-4"></div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent" title={`${team2AvgSR.toFixed(0)} SR`}>
              {formatRankOnly(team2AvgSR, gameMode)}
            </div>
            <div className="text-sm text-muted">Team 2</div>
            <div className="text-xs mt-1 h-4">
              {team2AvgSR > team1AvgSR && srDifference >= 25 && (
                <span className="text-ok font-medium">Favored</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && <WarningsPanel warnings={warnings} compact />}

      {/* Team columns */}
      {hasTeams ? (
        <>
          <div className="grid grid-cols-2 gap-4">
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

          {/* Post-match choice or Team Won buttons */}
          {postMatchPending ? (
            <div className="flex gap-4 pt-2">
              <button
                onClick={handleAutoBalanceNext}
                className="flex-1 py-2 px-4 app-primary font-medium transition-colors"
              >
                <RefreshCw className="inline h-4 w-4 mr-2" aria-hidden="true" />
                Auto-Balance Next Game
              </button>
              <button
                onClick={handleDraftNext}
                className="flex-1 py-2 px-4 app-secondary font-medium transition-colors"
              >
                <Users className="inline h-4 w-4 mr-2" aria-hidden="true" />
                Draft Next Game
              </button>
            </div>
          ) : (
            <div className="flex gap-4 pt-2">
              <HoldButton
                onConfirm={() => handleTeamWon(1)}
                className="flex-1 py-2 px-4 app-primary font-medium transition-colors"
                title="Hold for 1 second to confirm Team 1 won"
              >
                <Trophy className="inline h-4 w-4 mr-2" aria-hidden="true" />
                Team 1 Won
              </HoldButton>
              <HoldButton
                onConfirm={() => handleTeamWon(2)}
                className="flex-1 py-2 px-4 app-primary font-medium transition-colors"
                title="Hold for 1 second to confirm Team 2 won"
              >
                <Trophy className="inline h-4 w-4 mr-2" aria-hidden="true" />
                Team 2 Won
              </HoldButton>
              {!pendingMatchResult && (
                <button
                  onClick={handleNewGame}
                  className="py-2 px-4 app-secondary font-medium transition-colors"
                  title="Clear teams without recording a result"
                >
                  <RefreshCw className="inline h-4 w-4 mr-2" aria-hidden="true" />
                  New Game
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-muted py-8">
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
