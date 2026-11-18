import { useCallback } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { balanceTeams } from "@engine/balancer";
import { getModeConfig } from "@engine/modeConfig";

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

  const modeConfig = getModeConfig(gameMode);
  const requiredPlayers = modeConfig.teamSize * 2;

  const handleBalance = useCallback(() => {
    try {
      const lobbyPlayers = getLobbyPlayers();
      const result = balanceTeams(lobbyPlayers, softConstraints, gameMode);
      setLastResult(result);
    } catch (error) {
      console.error("Balance failed:", error);
    }
  }, [getLobbyPlayers, setLastResult, softConstraints, gameMode]);

  const canBalance = lobbyCount >= requiredPlayers;
  const hasResult = lastResult && lastResult.team1.length > 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleBalance}
        disabled={!canBalance}
        className={`w-full py-4 text-xl font-bold rounded-lg transition-colors ${
          canBalance
            ? "app-primary"
            : "bg-[var(--color-paper-3)] text-muted cursor-not-allowed"
        }`}
      >
        {canBalance ? (
          <span className="inline-flex items-center justify-center gap-2">
            {hasResult ? (
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Scale className="h-5 w-5" aria-hidden="true" />
            )}
            {hasResult ? "Reshuffle Teams" : "Balance Teams"}
          </span>
        ) : (
          `Need ${requiredPlayers - lobbyCount} more players`
        )}
      </button>

      {hasResult && (
        <p className="text-xs text-muted text-center">
          Locked players stay on their team
        </p>
      )}
    </div>
  );
}
