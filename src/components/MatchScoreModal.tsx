import { useState } from "react";
import { Trophy } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";

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
  const [displayWinningTeam, setDisplayWinningTeam] = useState<1 | 2>(winningTeam);
  const [prevProps, setPrevProps] = useState({ isOpen, winningTeam });

  if (isOpen !== prevProps.isOpen || winningTeam !== prevProps.winningTeam) {
    setPrevProps({ isOpen, winningTeam });
    if (isOpen) {
      setDisplayWinningTeam(winningTeam);
      if (!prevProps.isOpen) {
        setWinnerScore(4);
        setLoserScore(0);
        setTeam1Cash("");
        setTeam2Cash("");
        setCustomAdj(false);
        setWinnerAdj(50);
        setLoserAdj(50);
        setError(null);
      }
    }
  }

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
  };

  const handleSkip = () => {
    onConfirm(1, 0);
  };

  const losingTeam = displayWinningTeam === 1 ? 2 : 1;
  const scoresInvalid = Boolean(error);

  const autoAdjustment = (() => {
    const diff = winnerScore - loserScore;
    const factor = winnerScore > 0 ? diff / winnerScore : 0;
    const adjustment = Math.round(50 * factor);
    if (factor >= 0.75) return { adjustment, label: `Stomp! Auto: ±${adjustment} SR` };
    if (factor >= 0.5) return { adjustment, label: `Solid win: ±${adjustment} SR` };
    if (factor >= 0.25) return { adjustment, label: `Close game: ±${adjustment} SR` };
    return { adjustment, label: `Very close: ±${adjustment} SR` };
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl flex items-center justify-center gap-2">
            <Trophy className="size-5 text-pink-ink" aria-hidden="true" />
            Team {displayWinningTeam} Won
          </DialogTitle>
          <DialogDescription className="text-center">
            Enter the match score to adjust player weights based on how close/dominant the game was.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="bad" size="compact">
            <AlertDescription className="text-bad">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-center gap-4">
          <Field
            data-invalid={scoresInvalid || undefined}
            className="w-16 items-center gap-1"
          >
            <FieldLabel
              htmlFor="match-score-winner"
              className="justify-center whitespace-nowrap text-xs font-semibold text-ink-2"
            >
              Team {displayWinningTeam}
            </FieldLabel>
            <Input
              id="match-score-winner"
              type="number"
              value={winnerScore}
              onChange={(e) => {
                setWinnerScore(parseInt(e.target.value) || 0);
                if (error) setError(null);
              }}
              min={1}
              max={10}
              aria-label={`Team ${displayWinningTeam} score`}
              aria-invalid={scoresInvalid || undefined}
              className="h-12 text-2xl font-semibold text-center text-ok app-measured p-0"
            />
          </Field>
          <span className="text-2xl text-muted mt-4">-</span>
          <Field
            data-invalid={scoresInvalid || undefined}
            className="w-16 items-center gap-1"
          >
            <FieldLabel
              htmlFor="match-score-loser"
              className="justify-center whitespace-nowrap text-xs font-semibold text-ink-2"
            >
              Team {losingTeam}
            </FieldLabel>
            <Input
              id="match-score-loser"
              type="number"
              value={loserScore}
              onChange={(e) => {
                setLoserScore(parseInt(e.target.value) || 0);
                if (error) setError(null);
              }}
              min={0}
              max={9}
              aria-label={`Team ${losingTeam} score`}
              aria-invalid={scoresInvalid || undefined}
              className="h-12 text-2xl font-semibold text-center text-bad app-measured p-0"
            />
          </Field>
        </div>

        {winnerScore > loserScore && (
          <Card variant="well">
            <CardContent className="p-3 flex flex-col gap-2">
              <div className="text-sm font-semibold text-ink-2 text-center">
                {autoAdjustment.label}
              </div>
              <Field orientation="horizontal" className="w-fit mx-auto gap-2">
                <Checkbox
                  id="match-score-custom-sr"
                  checked={customAdj}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true;
                    setCustomAdj(isChecked);
                    if (isChecked) {
                      setWinnerAdj(autoAdjustment.adjustment);
                      setLoserAdj(autoAdjustment.adjustment);
                    }
                  }}
                />
                <FieldLabel htmlFor="match-score-custom-sr" className="text-xs cursor-pointer">
                  Custom SR
                </FieldLabel>
              </Field>
              {customAdj && (
                <div className="mt-1 flex items-center justify-center gap-4">
                  <Field className="w-auto items-center gap-1">
                    <FieldLabel
                      htmlFor="match-score-winner-adj"
                      className="justify-center text-xs font-semibold text-ok"
                    >
                      Winners
                    </FieldLabel>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-ok text-sm font-semibold">+</span>
                      <Input
                        id="match-score-winner-adj"
                        type="number"
                        value={winnerAdj}
                        onChange={(e) => setWinnerAdj(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        min={0}
                        max={100}
                        aria-label="Winners SR adjustment"
                        className="w-14 h-8 text-sm text-center text-ok app-measured p-0"
                      />
                    </div>
                  </Field>
                  <Field className="w-auto items-center gap-1">
                    <FieldLabel
                      htmlFor="match-score-loser-adj"
                      className="justify-center text-xs font-semibold text-bad"
                    >
                      Losers
                    </FieldLabel>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-bad text-sm font-semibold">−</span>
                      <Input
                        id="match-score-loser-adj"
                        type="number"
                        value={loserAdj}
                        onChange={(e) => setLoserAdj(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        min={0}
                        max={100}
                        aria-label="Losers SR adjustment"
                        className="w-14 h-8 text-sm text-center text-bad app-measured p-0"
                      />
                    </div>
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isStadium && (
          <Card variant="well">
            <CardContent className="p-3">
              <FieldSet className="gap-2">
                <FieldLegend variant="label" className="mb-0 w-full text-center text-xs text-ink-2">
                  Final Cash (optional)
                </FieldLegend>
                <div className="flex items-center justify-center gap-3">
                  <Field className="w-24 items-center gap-1">
                    <FieldLabel
                      htmlFor="match-score-team1-cash"
                      className="justify-center text-xs text-pink-ink font-semibold"
                    >
                      Team 1
                    </FieldLabel>
                    <Input
                      id="match-score-team1-cash"
                      type="number"
                      value={team1Cash}
                      onChange={(e) => setTeam1Cash(e.target.value)}
                      placeholder="$"
                      aria-label="Team 1 final cash"
                      className="h-10 text-base text-center app-measured px-2 py-1"
                    />
                  </Field>
                  <span className="text-muted text-sm mt-4">vs</span>
                  <Field className="w-24 items-center gap-1">
                    <FieldLabel
                      htmlFor="match-score-team2-cash"
                      className="justify-center text-xs text-sky-ink font-semibold"
                    >
                      Team 2
                    </FieldLabel>
                    <Input
                      id="match-score-team2-cash"
                      type="number"
                      value={team2Cash}
                      onChange={(e) => setTeam2Cash(e.target.value)}
                      placeholder="$"
                      aria-label="Team 2 final cash"
                      className="h-10 text-base text-center app-measured px-2 py-1"
                    />
                  </Field>
                </div>
              </FieldSet>
            </CardContent>
          </Card>
        )}

        <DialogFooter className="sm:justify-stretch gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="quiet"
            className="flex-1"
            onClick={handleSkip}
            title="Skip score input and use minimal adjustment"
          >
            Skip
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
