import { useState } from "react";

// =============================================================================
// MatchScoreModal - Input match score for adaptive weight calculation
// =============================================================================

interface MatchScoreModalProps {
  isOpen: boolean;
  winningTeam: 1 | 2;
  onConfirm: (winnerScore: number, loserScore: number, team1Cash?: number, team2Cash?: number) => void;
  onCancel: () => void;
}

export function MatchScoreModal({ isOpen, winningTeam, onConfirm, onCancel }: MatchScoreModalProps) {
  const [winnerScore, setWinnerScore] = useState(4);
  const [loserScore, setLoserScore] = useState(0);
  const [team1Cash, setTeam1Cash] = useState<string>("");
  const [team2Cash, setTeam2Cash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Validate
    if (winnerScore <= loserScore) {
      setError("Winner's score must be higher than loser's");
      return;
    }
    if (winnerScore < 1 || loserScore < 0) {
      setError("Invalid score values");
      return;
    }
    
    // Parse cash scores (optional)
    const t1Cash = team1Cash.trim() ? parseInt(team1Cash) : undefined;
    const t2Cash = team2Cash.trim() ? parseInt(team2Cash) : undefined;
    
    onConfirm(winnerScore, loserScore, t1Cash, t2Cash);
    // Reset for next time
    setWinnerScore(4);
    setLoserScore(0);
    setTeam1Cash("");
    setTeam2Cash("");
    setError(null);
  };

  const handleSkip = () => {
    // Skip score input - just confirm with minimal roll factor (close game)
    onConfirm(1, 0);
    setWinnerScore(4);
    setLoserScore(0);
    setTeam1Cash("");
    setTeam2Cash("");
    setError(null);
  };

  const losingTeam = winningTeam === 1 ? 2 : 1;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-center">
          🏆 Team {winningTeam} Won!
        </h2>
        
        <p className="text-gray-400 text-sm mb-4 text-center">
          Enter the match score to adjust player weights based on how close/dominant the game was.
        </p>

        {error && (
          <div className="mb-4 p-2 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">Team {winningTeam}</div>
            <input
              type="number"
              value={winnerScore}
              onChange={(e) => setWinnerScore(parseInt(e.target.value) || 0)}
              min={1}
              max={10}
              className="w-16 h-12 text-2xl font-bold text-center bg-gray-700 rounded-lg border border-green-500 text-green-400"
            />
          </div>
          <span className="text-2xl text-gray-500">-</span>
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">Team {losingTeam}</div>
            <input
              type="number"
              value={loserScore}
              onChange={(e) => setLoserScore(parseInt(e.target.value) || 0)}
              min={0}
              max={9}
              className="w-16 h-12 text-2xl font-bold text-center bg-gray-700 rounded-lg border border-red-500 text-red-400"
            />
          </div>
        </div>

        {/* Roll factor preview */}
        {winnerScore > loserScore && (
          <div className="mb-4 p-3 bg-gray-700/50 rounded-lg text-center">
            <div className="text-sm text-gray-400">
              {(() => {
                const diff = winnerScore - loserScore;
                const factor = winnerScore > 0 ? diff / winnerScore : 0;
                const adjustment = Math.round(50 * factor);
                if (factor >= 0.75) return `Stomp! Winners +${adjustment} SR, Losers -${adjustment} SR`;
                if (factor >= 0.5) return `Solid win: Winners +${adjustment} SR, Losers -${adjustment} SR`;
                if (factor >= 0.25) return `Close game: Winners +${adjustment} SR, Losers -${adjustment} SR`;
                return `Very close: Minimal SR adjustment (±${adjustment})`;
              })()}
            </div>
          </div>
        )}

        {/* Cash score input (optional) */}
        <div className="mb-4 p-3 bg-gray-700/30 rounded-lg">
          <div className="text-sm text-gray-400 mb-2 text-center">Final Cash (optional)</div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Team 1</div>
              <input
                type="number"
                value={team1Cash}
                onChange={(e) => setTeam1Cash(e.target.value)}
                placeholder="$"
                className="w-20 h-10 text-lg text-center bg-gray-700 rounded-lg border border-gray-600 text-gray-200 placeholder-gray-500"
              />
            </div>
            <span className="text-gray-500">vs</span>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Team 2</div>
              <input
                type="number"
                value={team2Cash}
                onChange={(e) => setTeam2Cash(e.target.value)}
                placeholder="$"
                className="w-20 h-10 text-lg text-center bg-gray-700 rounded-lg border border-gray-600 text-gray-200 placeholder-gray-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSkip}
            className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300"
            title="Skip score input and use minimal adjustment"
          >
            Skip
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
