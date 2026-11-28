import { useState } from "react";
import { Users } from "lucide-react";
import type { Player } from "@engine/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";

// =============================================================================
// CsvImportModal - Confirms CSV import and lets user keep missing players
// =============================================================================

interface CsvImportModalProps {
  isOpen?: boolean;
  existingCount: number;
  incomingPlayers: Player[];
  missingExisting: Player[];
  onConfirm: (keptMissingPlayers: Player[]) => void;
  onCancel: () => void;
}

export function CsvImportModal({
  isOpen = true,
  existingCount,
  incomingPlayers,
  missingExisting,
  onConfirm,
  onCancel,
}: CsvImportModalProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    () => new Set(missingExisting.map((p) => p.battletag))
  );
  const [prevProps, setPrevProps] = useState({ isOpen, missingExisting });

  if (isOpen !== prevProps.isOpen || missingExisting !== prevProps.missingExisting) {
    setPrevProps({ isOpen, missingExisting });
    if (isOpen) {
      setSelectedTags(new Set(missingExisting.map((p) => p.battletag)));
    }
  }

  const hasMissing = missingExisting.length > 0;
  const keptCount = selectedTags.size;
  const mergedTotal = incomingPlayers.length + keptCount;

  const togglePlayer = (battletag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(battletag)) {
        next.delete(battletag);
      } else {
        next.add(battletag);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTags(new Set(missingExisting.map((p) => p.battletag)));
  };

  const clearSelection = () => {
    setSelectedTags(new Set());
  };

  const handleConfirmMerged = () => {
    const kept = missingExisting.filter((p) => selectedTags.has(p.battletag));
    onConfirm(kept);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Users className="size-5 text-sky-ink shrink-0" aria-hidden="true" />
            <span>{hasMissing ? "Keep Existing Players?" : "Replace Roster?"}</span>
          </DialogTitle>
          <DialogDescription>
            {hasMissing ? (
              <>
                You have{" "}
                <span className="font-semibold text-ink">{missingExisting.length}</span>{" "}
                player{missingExisting.length === 1 ? "" : "s"} already loaded who{" "}
                {missingExisting.length === 1 ? "isn’t" : "aren’t"} in this{" "}
                <span className="font-semibold text-ink">{incomingPlayers.length}</span>
                -player CSV. Add them into the new roster too?
              </>
            ) : (
              <>
                This will replace{" "}
                <span className="font-semibold text-ink">{existingCount}</span>{" "}
                existing player{existingCount === 1 ? "" : "s"} with{" "}
                <span className="font-semibold text-ink">{incomingPlayers.length}</span>{" "}
                player{incomingPlayers.length === 1 ? "" : "s"} from this CSV and clear session stats and lobby.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasMissing ? (
          <>
            <div className="flex items-center justify-between text-xs shrink-0">
              <span className="font-semibold text-muted app-measured">
                {keptCount} of {missingExisting.length} selected
              </span>
              <div className="flex gap-3">
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0"
                  onClick={selectAll}
                >
                  Select all
                </Button>
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-muted hover:text-ink"
                  onClick={clearSelection}
                >
                  None
                </Button>
              </div>
            </div>

            <Card variant="well" className="max-h-60 overflow-y-auto shrink-0">
              <CardContent className="p-2 flex flex-col gap-1">
                {missingExisting.map((player) => {
                  const checked = selectedTags.has(player.battletag);
                  const checkboxId = `csv-keep-${player.battletag}`;
                  return (
                    <Field
                      key={player.battletag}
                      orientation="horizontal"
                      className="gap-2.5 px-2.5 py-1.5 rounded-well hover:bg-paper-2"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        onCheckedChange={() => togglePlayer(player.battletag)}
                        aria-label={`Keep ${player.battletag}`}
                      />
                      <FieldLabel
                        htmlFor={checkboxId}
                        className="font-semibold text-sm text-ink break-words min-w-0 cursor-pointer"
                      >
                        {player.battletag}
                      </FieldLabel>
                      <span className="text-xs text-muted shrink-0">
                        {player.rolesWilling.join(", ")}
                      </span>
                    </Field>
                  );
                })}
              </CardContent>
            </Card>

            <p className="text-xs text-muted shrink-0">
              Continuing clears current session stats and lobby selections.
            </p>

            <Separator className="shrink-0" />
            <DialogFooter className="flex-wrap sm:justify-stretch gap-2.5 shrink-0">
              <Button variant="secondary" className="app-nowrap" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="sky"
                className="flex-1 app-nowrap"
                onClick={() => onConfirm([])}
              >
                New CSV Only ({incomingPlayers.length})
              </Button>
              <Button
                variant="primary"
                className="flex-1 app-nowrap"
                onClick={handleConfirmMerged}
              >
                Add & Import ({mergedTotal})
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Separator className="shrink-0" />
            <DialogFooter className="sm:justify-stretch gap-2.5 shrink-0">
              <Button
                variant="secondary"
                className="flex-1 app-nowrap"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 app-nowrap"
                onClick={() => onConfirm([])}
              >
                Replace Roster
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
