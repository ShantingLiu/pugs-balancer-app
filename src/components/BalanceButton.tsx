import { useCallback } from "react";
import { useSessionStore } from "@store/sessionStore";
import { balanceTeams } from "@engine/balancer";
import { getModeConfig } from "@engine/modeConfig";
import { useTheme } from "@hooks/useTheme";

// =============================================================================
// BalanceButton - Triggers the balancing algorithm
// =============================================================================

export function BalanceButton() {
  const getLobbyPlayers = useSessionStore((state) => state.getLobbyPlayers);
  const setLastResult = useSessionStore((state) => state.setLastResult);
  const lastResult = useSessionStore((state) => state.lastResult);
  const lobbyCount = useSessionStore((state) => state.lobbyBattletags.length);
  const softConstraints = useSessionStore((state) => state.softConstraints);
  const gameMode = useSessionStore((state) => state.gameMode);
  const theme = useTheme();
  
  const modeConfig = getModeConfig(gameMode);
  const requiredPlayers = modeConfig.teamSize * 2;

  const handleBalance = useCallback(() => {
    try {
      const lobbyPlayers = getLobbyPlayers();
      
      // Note: mustPlay is now properly set by recordMatchResult
      // We keep mustPlay as-is - sat-out players should have priority
      const playersForBalance = lobbyPlayers;
      
      const result = balanceTeams(playersForBalance, softConstraints, gameMode);
      
      setLastResult(result);
    } catch (error) {
      console.error("Balance failed:", error);
    }
  }, [getLobbyPlayers, setLastResult, softConstraints, lastResult, gameMode]);

  const canBalance = lobbyCount >= requiredPlayers;
  const hasResult = lastResult && lastResult.team1.length > 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleBalance}
        disabled={!canBalance}
        className={`
          w-full py-4 text-xl font-bold rounded-lg transition-all
          ${
            canBalance
              ? `${theme.primary.bg} ${theme.primary.bgHover} ${theme.primary.bgActive}`
              : "bg-gray-700 cursor-not-allowed"
          }
        `}
      >
        {canBalance ? (
          hasResult ? "🔄 Reshuffle Teams" : "⚖️ Balance Teams"
        ) : (
          `Need ${requiredPlayers - lobbyCount} more players`
        )}
      </button>

      {hasResult && (
        <p className="text-xs text-gray-400 text-center">
          Locked players (🔒) will stay on their team
        </p>
      )}
    </div>
  );
}
