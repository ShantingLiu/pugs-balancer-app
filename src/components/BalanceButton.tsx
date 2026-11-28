import { useCallback } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { balanceTeams } from "@engine/balancer";
import { getModeConfig } from "@engine/modeConfig";
import { Button } from "@/components/ui/button";

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
    <div>
      <Button
        variant="primary"
        shape="card"
        onClick={handleBalance}
        disabled={!canBalance}
        className="w-full gap-2.5 py-3.5 px-6 text-lg font-bold leading-snug"
      >
        {canBalance ? (
          <>
            {hasResult ? (
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Scale data-icon="inline-start" aria-hidden="true" />
            )}
            <span>{hasResult ? "Reshuffle Teams" : "Balance Teams"}</span>
          </>
        ) : (
          `Need ${requiredPlayers - lobbyCount} more players`
        )}
      </Button>
    </div>
  );
}
