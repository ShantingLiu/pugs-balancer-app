import { useCallback } from "react";
import { useSessionStore } from "@store/sessionStore";
import { balanceTeams } from "@engine/balancer";

// =============================================================================
// BalanceButton - Triggers the balancing algorithm
// =============================================================================

export function BalanceButton() {
  const getLobbyPlayers = useSessionStore((state) => state.getLobbyPlayers);
  const setLastResult = useSessionStore((state) => state.setLastResult);
  const lastResult = useSessionStore((state) => state.lastResult);
  const lobbyCount = useSessionStore((state) => state.lobbyBattletags.length);
  const softConstraints = useSessionStore((state) => state.softConstraints);

  const handleBalance = useCallback(() => {
    console.log("Balance button clicked");
    
    // Debug: check raw state
    const rawState = useSessionStore.getState();
    console.log("Raw lockedRoles:", Array.from(rawState.lockedRoles.entries()));
    console.log("Raw lockedTeam1:", Array.from(rawState.lockedTeam1));
    console.log("Raw lockedTeam2:", Array.from(rawState.lockedTeam2));
    
    try {
      const lobbyPlayers = getLobbyPlayers();
      console.log("Lobby players:", lobbyPlayers.length);
      console.log("Must-play players:", lobbyPlayers.filter(p => p.mustPlay).map(p => p.battletag.split("#")[0]));
      
      // Note: mustPlay is now properly set by recordMatchResult
      // We keep mustPlay as-is - sat-out players should have priority
      const playersForBalance = lobbyPlayers;
      
      // Debug: log locked players
      const lockedPlayers = playersForBalance.filter((p) => p.lockedToTeam !== null);
      console.log("Locked players:", lockedPlayers.map((p) => `${p.battletag} -> Team ${p.lockedToTeam}, Role: ${p.lockedToRole}`));
      
      // Debug: log role-locked players
      const roleLockedPlayers = playersForBalance.filter((p) => p.lockedToRole !== null);
      console.log("Role-locked players:", roleLockedPlayers.map((p) => `${p.battletag} -> ${p.lockedToRole}`));
      
      const result = balanceTeams(playersForBalance, softConstraints);
      console.log("Balance result:", result);
      
      // Debug: verify locked players ended up on correct team
      for (const locked of lockedPlayers) {
        const inTeam1 = result.team1.some((ra) => ra.player.battletag === locked.battletag);
        const inTeam2 = result.team2.some((ra) => ra.player.battletag === locked.battletag);
        console.log(`${locked.battletag} locked to Team ${locked.lockedToTeam}: in Team 1? ${inTeam1}, in Team 2? ${inTeam2}`);
      }
      
      setLastResult(result);
      console.log("Result set");
    } catch (error) {
      console.error("Balance failed:", error);
    }
  }, [getLobbyPlayers, setLastResult, softConstraints, lastResult]);

  const canBalance = lobbyCount >= 10;
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
              ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
              : "bg-gray-700 cursor-not-allowed"
          }
        `}
      >
        {canBalance ? (
          hasResult ? "🔄 Reshuffle Teams" : "⚖️ Balance Teams"
        ) : (
          `Need ${10 - lobbyCount} more players`
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
