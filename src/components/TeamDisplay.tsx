import { useState } from "react";
import type { TeamAssignment, Player } from "@engine/types";
import { TeamColumn } from "./TeamColumn";
import { WarningsPanel } from "./WarningsPanel";
import { AddPlayerModal } from "./AddPlayerModal";
import { HoldButton } from "./HoldButton";
import { MatchScoreModal } from "./MatchScoreModal";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import { formatRankOnly } from "@utils/rankMapper";
import { balanceTeams } from "@engine/balancer";

// =============================================================================
// TeamDisplay - Displays balanced team results
// =============================================================================

interface TeamDisplayProps {
  result: TeamAssignment | null;
}

export function TeamDisplay({ result }: TeamDisplayProps) {
  const setLastResult = useSessionStore((state) => state.setLastResult);
  const pendingMatchResult = useSessionStore((state) => state.pendingMatchResult);
  const setPendingMatchResult = useSessionStore((state) => state.setPendingMatchResult);
  const confirmMatchScore = useSessionStore((state) => state.confirmMatchScore);
  const cancelPendingMatch = useSessionStore((state) => state.cancelPendingMatch);
  const getPlayer = usePlayerStore((state) => state.getPlayer);
  
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const handleTeamWon = (team: 1 | 2) => {
    // Set pending match result - this opens the score modal
    setPendingMatchResult(team);
  };

  const handleScoreConfirm = (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number) => {
    // This applies adaptive weights and calls recordMatchResult internally
    confirmMatchScore(winnerScore, loserScore, team1Cash, team2Cash);
    
    // Auto-balance for next game
    setTimeout(() => {
      const lobbyPlayers = useSessionStore.getState().getLobbyPlayers();
      console.log("Auto-balancing after match. Must-play players:", 
        lobbyPlayers.filter(p => p.mustPlay).map(p => p.battletag.split("#")[0]));
      
      if (lobbyPlayers.length >= 10) {
        const currentConstraints = useSessionStore.getState().softConstraints;
        const newResult = balanceTeams(lobbyPlayers, currentConstraints);
        setLastResult(newResult);
      }
    }, 0);
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

  if (!result) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">⚖️</div>
          <div>No teams generated yet</div>
          <div className="text-sm mt-1">
            Add at least 10 players to lobby and click Balance
          </div>
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
              {formatRankOnly(score.team1SR)}
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
              {formatRankOnly(score.team2SR)}
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

          {/* Team Won buttons - hold to confirm */}
          <div className="flex gap-4 pt-2">
            <HoldButton
              onConfirm={() => handleTeamWon(1)}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              title="Hold for 1 second to confirm Team 1 won"
            >
              🏆 Team 1 Won
            </HoldButton>
            <HoldButton
              onConfirm={() => handleTeamWon(2)}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              title="Hold for 1 second to confirm Team 2 won"
            >
              🏆 Team 2 Won
            </HoldButton>
          </div>
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
