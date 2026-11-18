import { useState } from "react";
import { Trophy } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";

// =============================================================================
// MatchScoreModal - Input match score for adaptive weight calculation
// =============================================================================

interface MatchScoreModalProps {
  isOpen: boolean;
  winningTeam: 1 | 2;
  onConfirm: (
    winnerScore: number,
    loserScore: number,
    team1Cash?: number,
    team2Cash?: number,
    winnerAdj?: number,
    loserAdj?: number
  ) => void;
  onCancel: () => void;
}

export function MatchScoreModal({ isOpen, winningTeam, onConfirm, onCancel }: MatchScoreModalProps) {
  const gameMode = useSessionStore((state) => state.gameMode);
  const isStadium = gameMode === "stadium_5v5";
  const [winnerScore, setWinnerScore] = useState(4);
  const [loserScore, setLoserScore] = useState(0);
  const [team1Cash, setTeam1Cash] = useState<string>("");
  const [team2Cash, setTeam2Cash] = useState<string>("");
  const [customAdj, setCustomAdj] = useState(false);
  const [winnerAdj, setWinnerAdj] = useState(50);
  const [loserAdj, setLoserAdj] = useState(50);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (winnerScore <= loserScore) {
      setError("Winner's score must be higher than loser's");
      return;
    }
    if (winnerScore < 1 || loserScore < 0) {
      setError("Invalid score values");
      return;
    }

    const t1Cash = team1Cash.trim() ? parseInt(team1Cash) : undefined;
    const t2Cash = team2Cash.trim() ? parseInt(team2Cash) : undefined;

    onConfirm(
      winnerScore,
      loserScore,
      t1Cash,
      t2Cash,
      customAdj ? winnerAdj : undefined,
      customAdj ? loserAdj : undefined
    );
    setWinnerScore(4);
    setLoserScore(0);
    setTeam1Cash("");
    setTeam2Cash("");
    setCustomAdj(false);
    setWinnerAdj(50);
    setLoserAdj(50);
    setError(null);
  };

  const handleSkip = () => {
    onConfirm(1, 0);
    setWinnerScore(4);
    setLoserScore(0);
    setTeam1Cash("");
    setTeam2Cash("");
    setCustomAdj(false);
    setWinnerAdj(50);
    setLoserAdj(50);
    setError(null);
  };

  const losingTeam = winningTeam === 1 ? 2 : 1;

  return (
    <div className="fixed inset-0 app-backdrop flex items-center justify-center z-50">
      <div className="app-modal p-6 w-full max-w-sm mx-4">
        <h2 className="text-xl font-semibold text-ink mb-2 text-center flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-pink-ink" aria-hidden="true" />
          Team {winningTeam} Won
        </h2>

        <p className="text-ink-2 text-sm mb-4 text-center">
          Enter the match score to adjust player weights based on how close/dominant the game was.
        </p>

        {error && (
          <div className="mb-4 p-2.5 bg-bad-soft border border-bad-edge rounded-well text-bad text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-5">
          <div className="text-center">
            <div className="text-xs font-semibold text-ink-2 mb-1">Team {winningTeam}</div>
            <input
              type="number"
              value={winnerScore}
              onChange={(e) => setWinnerScore(parseInt(e.target.value) || 0)}
              min={1}
              max={10}
              aria-label={`Team ${winningTeam} score`}
              className="app-input w-16 h-12 text-2xl font-semibold text-center text-ok app-measured"
            />
          </div>
          <span className="text-2xl text-muted mt-4">-</span>
          <div className="text-center">
            <div className="text-xs font-semibold text-ink-2 mb-1">Team {losingTeam}</div>
            <input
              type="number"
              value={loserScore}
              onChange={(e) => setLoserScore(parseInt(e.target.value) || 0)}
              min={0}
              max={9}
              aria-label={`Team ${losingTeam} score`}
              className="app-input w-16 h-12 text-2xl font-semibold text-center text-bad app-measured"
            />
          </div>
        </div>

        {winnerScore > loserScore && (
          <div className="mb-4 p-3 app-well">
            <div className="text-sm font-semibold text-ink-2 text-center">
              {(() => {
                const diff = winnerScore - loserScore;
                const factor = winnerScore > 0 ? diff / winnerScore : 0;
                const adjustment = Math.round(50 * factor);
                if (factor >= 0.75) return `Stomp! Auto: ±${adjustment} SR`;
                if (factor >= 0.5) return `Solid win: ±${adjustment} SR`;
                if (factor >= 0.25) return `Close game: ±${adjustment} SR`;
                return `Very close: ±${adjustment} SR`;
              })()}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <label className="text-xs font-semibold text-ink-2 flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={customAdj}
                  onChange={(e) => {
                    setCustomAdj(e.target.checked);
                    if (e.target.checked) {
                      const diff = winnerScore - loserScore;
                      const factor = winnerScore > 0 ? diff / winnerScore : 0;
                      const auto = Math.round(50 * factor);
                      setWinnerAdj(auto);
                      setLoserAdj(auto);
                    }
                  }}
                  className="w-4 h-4 accent-focus"
                />
                Custom SR
              </label>
            </div>
            {customAdj && (
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-xs font-semibold text-ok mb-1">Winners</div>
                  <div className="flex items-center gap-1">
                    <span className="text-ok text-sm font-semibold">+</span>
                    <input
                      type="number"
                      value={winnerAdj}
                      onChange={(e) => setWinnerAdj(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      min={0}
                      max={100}
                      aria-label="Winners SR adjustment"
                      className="app-input w-14 h-8 text-sm text-center text-ok app-measured"
                    />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-bad mb-1">Losers</div>
                  <div className="flex items-center gap-1">
                    <span className="text-bad text-sm font-semibold">−</span>
                    <input
                      type="number"
                      value={loserAdj}
                      onChange={(e) => setLoserAdj(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      min={0}
                      max={100}
                      aria-label="Losers SR adjustment"
                      className="app-input w-14 h-8 text-sm text-center text-bad app-measured"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isStadium && (
          <div className="mb-4 p-3 app-well">
            <div className="text-xs font-semibold text-ink-2 mb-2 text-center">Final Cash (optional)</div>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <div className="text-xs text-pink-ink font-semibold mb-1">Team 1</div>
                <input
                  type="number"
                  value={team1Cash}
                  onChange={(e) => setTeam1Cash(e.target.value)}
                  placeholder="$"
                  aria-label="Team 1 final cash"
                  className="app-input w-24 h-10 text-base text-center app-measured"
                />
              </div>
              <span className="text-muted text-sm mt-4">vs</span>
              <div className="text-center">
                <div className="text-xs text-sky-ink font-semibold mb-1">Team 2</div>
                <input
                  type="number"
                  value={team2Cash}
                  onChange={(e) => setTeam2Cash(e.target.value)}
                  placeholder="$"
                  aria-label="Team 2 final cash"
                  className="app-input w-24 h-10 text-base text-center app-measured"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 px-3 app-secondary rounded-pill text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-2 px-3 app-quiet rounded-pill text-sm font-semibold"
            title="Skip score input and use minimal adjustment"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2 px-3 app-primary rounded-pill text-sm font-semibold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
