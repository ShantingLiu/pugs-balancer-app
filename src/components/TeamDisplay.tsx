import { useState } from "react";
import type { TeamAssignment, Player, RoleAssignment } from "@engine/types";
import { TeamColumn } from "./TeamColumn";
import { WarningsPanel } from "./WarningsPanel";
import { AddPlayerModal } from "./AddPlayerModal";
import { HoldButton } from "./HoldButton";
import { MatchScoreModal } from "./MatchScoreModal";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import { formatRankOnly, getEffectiveSR } from "@utils/rankMapper";
import { getRequiredPlayers } from "@engine/modeConfig";
import { useTheme } from "@hooks/useTheme";

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
  const theme = useTheme();
  
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [postMatchPending, setPostMatchPending] = useState(false);
  
  const requiredPlayers = getRequiredPlayers(gameMode);

  const handleTeamWon = (team: 1 | 2) => {
    // Set pending match result - this opens the score modal
    setPendingMatchResult(team);
  };

  const handleScoreConfirm = (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number, winnerAdj?: number, loserAdj?: number) => {
    // This applies adaptive weights and calls recordMatchResult internally
    confirmMatchScore(winnerScore, loserScore, team1Cash, team2Cash, winnerAdj, loserAdj);
    
    // Show post-match choice instead of auto-balancing immediately
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

  // Build preview from pre-assigned players (both team + role locked)
  const getLobbyPlayers = useSessionStore((state) => state.getLobbyPlayers);
  // Subscribe to lock changes for preview re-renders
  useSessionStore((state) => state.lockedTeam1);
  useSessionStore((state) => state.lockedTeam2);
  useSessionStore((state) => state.lockedRoles);

  if (!result) {
    const lobbyPlayers = getLobbyPlayers();
    const preAssigned = lobbyPlayers.filter(
      (lp) => lp.lockedToTeam !== null && lp.lockedToRole !== null
    );

    if (preAssigned.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">⚖️</div>
            <div>No teams generated yet</div>
            <div className="text-sm mt-1">
              Add at least {requiredPlayers} players to lobby and click Balance
            </div>
            <div className="text-xs mt-2 text-gray-600">
              Tip: Lock a player to a team + role in the lobby to preview them here
            </div>
          </div>
        </div>
      );
    }

    // Build preview RoleAssignments
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
        <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-dashed border-gray-600">
          <span className="text-gray-400 text-sm">
            📌 Preview — {preAssigned.length} player{preAssigned.length !== 1 ? "s" : ""} pre-assigned
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TeamColumn
            teamNumber={1}
            assignments={team1Preview}
            averageSR={team1Preview.length > 0
              ? team1Preview.reduce((sum, a) => sum + a.effectiveSR, 0) / team1Preview.length
              : 0}
            onEditPlayer={handleEditPlayer}
          />
          <TeamColumn
            teamNumber={2}
            assignments={team2Preview}
            averageSR={team2Preview.length > 0
              ? team2Preview.reduce((sum, a) => sum + a.effectiveSR, 0) / team2Preview.length
              : 0}
            onEditPlayer={handleEditPlayer}
          />
        </div>
      </div>
    );
  }

  const { team1, team2, score, warnings } = result;

  // Check if we have a valid result
  const hasTeams = team1.length > 0 && team2.length > 0;

  return (
    <div className="space-y-4">
      {/* Score summary */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400" title={`${score.team1SR.toFixed(0)} SR`}>
              {formatRankOnly(score.team1SR, gameMode)}
            </div>
            <div className="text-sm text-gray-400">Team 1</div>
            <div className="text-xs mt-1 h-4">
              {score.team1SR > score.team2SR && score.srDifference >= 25 && (
                <span className="text-green-400">⭐ Favored</span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div
              className={`text-xl font-bold ${
                score.srDifference <= 50
                  ? "text-green-400"
                  : score.srDifference <= 100
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
              title={`${score.srDifference.toFixed(0)} SR difference`}
            >
              {score.srDifference < 25 ? (
                <span>⚔️ Even</span>
              ) : (
                <span>Δ {score.srDifference.toFixed(0)} SR</span>
              )}
            </div>
            <div className="text-sm text-gray-400">Difference</div>
            <div className="h-4"></div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400" title={`${score.team2SR.toFixed(0)} SR`}>
              {formatRankOnly(score.team2SR, gameMode)}
            </div>
            <div className="text-sm text-gray-400">Team 2</div>
            <div className="text-xs mt-1 h-4">
              {score.team2SR > score.team1SR && score.srDifference >= 25 && (
                <span className="text-green-400">⭐ Favored</span>
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
              averageSR={score.team1SR}
              onEditPlayer={handleEditPlayer}
            />
            <TeamColumn
              teamNumber={2}
              assignments={team2}
              averageSR={score.team2SR}
              onEditPlayer={handleEditPlayer}
            />
          </div>

          {/* Post-match choice or Team Won buttons */}
          {postMatchPending ? (
            <div className="flex gap-4 pt-2">
              <button
                onClick={handleAutoBalanceNext}
                className={`flex-1 py-2 px-4 ${theme.secondary.bg} ${theme.secondary.bgHover} rounded-lg font-medium transition-colors`}
              >
                ⚖️ Auto-Balance Next Game
              </button>
              <button
                onClick={handleDraftNext}
                className={`flex-1 py-2 px-4 ${theme.secondary.bg} ${theme.secondary.bgHover} rounded-lg font-medium transition-colors`}
              >
                👥 Draft Next Game
              </button>
            </div>
          ) : (
            <div className="flex gap-4 pt-2">
              <HoldButton
                onConfirm={() => handleTeamWon(1)}
                className={`flex-1 py-2 px-4 ${theme.secondary.bg} ${theme.secondary.bgHover} rounded-lg font-medium transition-colors`}
                title="Hold for 1 second to confirm Team 1 won"
              >
                🏆 Team 1 Won
              </HoldButton>
              <HoldButton
                onConfirm={() => handleTeamWon(2)}
                className={`flex-1 py-2 px-4 ${theme.secondary.bg} ${theme.secondary.bgHover} rounded-lg font-medium transition-colors`}
                title="Hold for 1 second to confirm Team 2 won"
              >
                🏆 Team 2 Won
              </HoldButton>
              {!pendingMatchResult && (
                <button
                  onClick={handleNewGame}
                  className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-gray-300"
                  title="Clear teams without recording a result"
                >
                  🔄 New Game
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 py-8">
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
