import { useState, useCallback, useMemo, useId } from "react";
import { X } from "lucide-react";
import { useSessionStore } from "@store/sessionStore";
import { usePlayerStore } from "@store/playerStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { SoftConstraint } from "@engine/types";

// =============================================================================
// ConstraintsPanel - Add/remove constraints (together/apart, soft/hard)
// =============================================================================

export function ConstraintsPanel() {
  const [isAdding, setIsAdding] = useState(false);
  const [constraintType, setConstraintType] = useState<"together" | "apart">("together");
  const [isHard, setIsHard] = useState(false);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const playerAId = useId();
  const playerBId = useId();
  const typeLabelId = useId();
  const hardCheckboxId = useId();

  const softConstraints = useSessionStore((state) => state.softConstraints);
  const addSoftConstraint = useSessionStore((state) => state.addSoftConstraint);
  const removeSoftConstraint = useSessionStore((state) => state.removeSoftConstraint);
  const clearSoftConstraints = useSessionStore((state) => state.clearSoftConstraints);
  const lobbyBattletags = useSessionStore((state) => state.lobbyBattletags);
  const players = usePlayerStore((state) => state.players);

  const lobbyPlayers = useMemo(() => {
    const lobbySet = new Set(lobbyBattletags);
    return Array.from(players.values()).filter((p) => lobbySet.has(p.battletag));
  }, [players, lobbyBattletags]);

  const handleAdd = useCallback(() => {
    if (!playerA || !playerB || playerA === playerB) return;

    const constraint: SoftConstraint = {
      type: constraintType,
      players: [playerA, playerB],
      hard: isHard,
    };

    addSoftConstraint(constraint);
    setPlayerA("");
    setPlayerB("");
    setIsHard(false);
    setIsAdding(false);
  }, [playerA, playerB, constraintType, isHard, addSoftConstraint]);

  const handleRemove = useCallback(
    (pair: [string, string]) => {
      removeSoftConstraint(pair);
    },
    [removeSoftConstraint]
  );

  const formatPlayerName = (battletag: string) => battletag.split("#")[0];

  const playerAItems = useMemo<{ value: string | null; label: string }[]>(
    () => [
      { value: null, label: "Select player 1…" },
      ...lobbyPlayers.map((p) => ({
        value: p.battletag,
        label: formatPlayerName(p.battletag),
      })),
    ],
    [lobbyPlayers]
  );

  const playerBItems = useMemo<{ value: string | null; label: string }[]>(
    () => [
      { value: null, label: "Select player 2…" },
      ...lobbyPlayers
        .filter((p) => p.battletag !== playerA)
        .map((p) => ({
          value: p.battletag,
          label: formatPlayerName(p.battletag),
        })),
    ],
    [lobbyPlayers, playerA]
  );

  const hardCount = softConstraints.filter((c) => c.hard).length;
  const softCount = softConstraints.length - hardCount;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-heading">
          Constraints
          {softConstraints.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({hardCount > 0 && <span className="text-warn font-semibold">{hardCount} hard</span>}
              {hardCount > 0 && softCount > 0 && ", "}
              {softCount > 0 && <span>{softCount} soft</span>})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {softConstraints.length > 0 && (
            <Button
              variant="link"
              size="xs"
              onClick={clearSoftConstraints}
              className="h-auto p-0 text-bad"
            >
              Clear all
            </Button>
          )}
          <Button
            variant="sky"
            size="xs"
            onClick={() => setIsAdding(true)}
          >
            + Add
          </Button>
        </div>
      </div>

      {softConstraints.length === 0 && !isAdding && (
        <p className="text-xs text-muted">
          No constraints set. Add “together” or “apart” pairs (soft = prefer, hard = must).
        </p>
      )}

      <div className="flex flex-col gap-2">
        {softConstraints.map((constraint, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-well text-sm border",
              constraint.hard
                ? "bg-warn-soft border-warn-edge"
                : "bg-paper-3 border-rule"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              {constraint.hard && (
                <Badge variant="warn" className="px-2 bg-paper-2">
                  Must
                </Badge>
              )}
              <span className="font-semibold text-ink">
                {formatPlayerName(constraint.players[0])}
              </span>
              <Badge
                variant={constraint.type === "together" ? "ok" : "bad"}
                className="px-2"
              >
                {constraint.type === "together" ? "↔ together" : "↮ apart"}
              </Badge>
              <span className="font-semibold text-ink">
                {formatPlayerName(constraint.players[1])}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              shape="pill"
              onClick={() => handleRemove(constraint.players)}
              className="text-muted hover:text-bad hover:bg-bad-soft"
              aria-label="Remove constraint"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      {isAdding && (
        <Card variant="well" className="p-3.5 gap-3">
          <FieldGroup className="gap-3">
            <Field className="gap-1.5">
              <FieldLabel htmlFor={playerAId} className="sr-only">
                Player 1
              </FieldLabel>
              <Select
                items={playerAItems}
                value={playerA || null}
                onValueChange={(v) => setPlayerA(v ?? "")}
              >
                <SelectTrigger id={playerAId} aria-label="Select player 1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {lobbyPlayers.map((p) => (
                      <SelectItem key={p.battletag} value={p.battletag}>
                        {formatPlayerName(p.battletag)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-1.5">
              <FieldTitle id={typeLabelId} className="sr-only">
                Constraint type
              </FieldTitle>
              <ToggleGroup
                value={[constraintType]}
                onValueChange={(vals) => {
                  if (vals[0] === "together" || vals[0] === "apart") {
                    setConstraintType(vals[0]);
                  }
                }}
                aria-labelledby={typeLabelId}
                className="w-full"
              >
                <ToggleGroupItem
                  value="together"
                  activeVariant="ok"
                  className="flex-1"
                >
                  ↔ Together
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="apart"
                  activeVariant="bad"
                  className="flex-1"
                >
                  ↮ Apart
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor={playerBId} className="sr-only">
                Player 2
              </FieldLabel>
              <Select
                items={playerBItems}
                value={playerB || null}
                onValueChange={(v) => setPlayerB(v ?? "")}
              >
                <SelectTrigger id={playerBId} aria-label="Select player 2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {lobbyPlayers
                      .filter((p) => p.battletag !== playerA)
                      .map((p) => (
                        <SelectItem key={p.battletag} value={p.battletag}>
                          {formatPlayerName(p.battletag)}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field
              orientation="horizontal"
              className="gap-3 p-2.5 bg-paper-2 border border-rule rounded-well"
            >
              <Checkbox
                id={hardCheckboxId}
                checked={isHard}
                onCheckedChange={(checked) => setIsHard(checked === true)}
              />
              <FieldContent className="gap-0.5">
                <FieldLabel
                  htmlFor={hardCheckboxId}
                  className={cn(
                    "cursor-pointer text-sm font-semibold",
                    isHard ? "text-warn" : "text-ink-2"
                  )}
                >
                  Hard constraint
                </FieldLabel>
                <FieldDescription>
                  {isHard ? "Balance fails if violated" : "Prefer but may violate"}
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAdding(false);
                setIsHard(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant={isHard ? "ghost" : "primary"}
              onClick={handleAdd}
              disabled={!playerA || !playerB || playerA === playerB}
              className={cn(
                "flex-1",
                isHard && "bg-warn-soft border border-warn-edge text-warn hover:bg-warn-fill hover:text-warn-btn-ink"
              )}
            >
              Add {isHard ? "Hard" : "Soft"} Constraint
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
