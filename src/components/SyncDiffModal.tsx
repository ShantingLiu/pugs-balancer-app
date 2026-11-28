import { useState } from "react";
import type { SyncDiff, PlayerDiff, FieldDiff, DiffType } from "@services/diffEngine";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

// =============================================================================
// SyncDiffModal — Review & resolve sync diffs before applying (§10.3)
// =============================================================================

interface SyncDiffModalProps {
  diff: SyncDiff | null;
  isOpen?: boolean;
  onApply: (resolved: SyncDiff) => void;
  onCancel: () => void;
}

export function SyncDiffModal({ diff, isOpen, onApply, onCancel }: SyncDiffModalProps) {
  const open = isOpen ?? Boolean(diff);
  const [resolvedDiff, setResolvedDiff] = useState<SyncDiff | null>(() =>
    diff ? structuredClone(diff) : null
  );
  const [prevDiff, setPrevDiff] = useState<SyncDiff | null>(diff);
  const [prevOpen, setPrevOpen] = useState<boolean>(open);

  if (diff !== prevDiff || open !== prevOpen) {
    setPrevDiff(diff);
    setPrevOpen(open);
    if (diff && (diff !== prevDiff || (open && !prevOpen))) {
      setResolvedDiff(structuredClone(diff));
    }
  }

  const acceptAll = (side: "local" | "remote") => {
    setResolvedDiff((prev) =>
      prev
        ? {
            ...prev,
            modified: prev.modified.map((pd) => ({
              ...pd,
              fields: pd.fields.map((f) => ({ ...f, chosenSide: side })),
            })),
          }
        : prev
    );
  };

  const updateDiff = (battletag: string, fieldName: string, side: "local" | "remote") => {
    setResolvedDiff((prev) =>
      prev
        ? {
            ...prev,
            modified: prev.modified.map((pd) =>
              pd.battletag === battletag
                ? {
                    ...pd,
                    fields: pd.fields.map((f) =>
                      f.field === fieldName ? { ...f, chosenSide: side } : f
                    ),
                  }
                : pd
            ),
          }
        : prev
    );
  };

  const toggleSelected = (battletag: string, type: DiffType) => {
    const key = type === "new_remote" ? "newRemote" : "newLocal";
    setResolvedDiff((prev) =>
      prev
        ? {
            ...prev,
            [key]: prev[key].map((pd) =>
              pd.battletag === battletag ? { ...pd, selected: !pd.selected } : pd
            ),
          }
        : prev
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Sync Changes</DialogTitle>
          <DialogDescription className="sr-only">
            Review and resolve differences between local roster data and Google Sheets.
          </DialogDescription>
        </DialogHeader>

        {resolvedDiff && (
          <>
            {resolvedDiff.isFirstSync && (
              <Alert variant="info">
                <AlertDescription className="text-sky-ink font-semibold">
                  This is your first sync. The sheet roster will replace your local data.
                  You can review individual changes below.
                </AlertDescription>
              </Alert>
            )}

            {!resolvedDiff.hasChanges && (
              <Empty className="p-6 md:p-6">
                <EmptyHeader>
                  <EmptyTitle>No changes detected</EmptyTitle>
                  <EmptyDescription>
                    Your local data matches the sheet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {resolvedDiff.modified.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => acceptAll("local")}
                >
                  Accept All Local
                </Button>
                <Button
                  variant="sky"
                  size="sm"
                  onClick={() => acceptAll("remote")}
                >
                  Accept All Remote
                </Button>
              </div>
            )}

            {resolvedDiff.modified.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-ink">
                  Modified Players ({resolvedDiff.modified.length})
                </h3>
                {resolvedDiff.modified.map((pd) => (
                  <ModifiedPlayerCard
                    key={pd.battletag}
                    player={pd}
                    onFieldChoice={(field, side) => updateDiff(pd.battletag, field, side)}
                  />
                ))}
              </section>
            )}

            {resolvedDiff.newRemote.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-base font-semibold text-ink">
                  New from Sheet ({resolvedDiff.newRemote.length})
                </h3>
                <div className="flex flex-col gap-1">
                  {resolvedDiff.newRemote.map((pd) => (
                    <NewPlayerRow
                      key={pd.battletag}
                      player={pd}
                      onToggle={() => toggleSelected(pd.battletag, "new_remote")}
                    />
                  ))}
                </div>
              </section>
            )}

            {resolvedDiff.newLocal.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-base font-semibold text-ink">
                  New Locally ({resolvedDiff.newLocal.length})
                </h3>
                <div className="flex flex-col gap-1">
                  {resolvedDiff.newLocal.map((pd) => (
                    <NewPlayerRow
                      key={pd.battletag}
                      player={pd}
                      onToggle={() => toggleSelected(pd.battletag, "new_local")}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <Separator />
        <DialogFooter className="sm:justify-stretch gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => { if (resolvedDiff) onApply(resolvedDiff); }}
          >
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModifiedPlayerCard({
  player,
  onFieldChoice,
}: {
  player: PlayerDiff;
  onFieldChoice: (field: string, side: "local" | "remote") => void;
}) {
  return (
    <Card variant="well">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">{player.battletag}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex flex-col gap-2">
        {player.validationWarnings.length > 0 && (
          <Alert variant="warn" size="compact">
            <AlertDescription className="text-warn">
              {player.validationWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          {player.fields.map((fd) => (
            <FieldDiffRow
              key={fd.field}
              battletag={player.battletag}
              diff={fd}
              onChoose={(side) => onFieldChoice(fd.field, side)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldDiffRow({
  battletag,
  diff,
  onChoose,
}: {
  battletag: string;
  diff: FieldDiff;
  onChoose: (side: "local" | "remote") => void;
}) {
  const localActive = diff.chosenSide === "local";
  const remoteActive = diff.chosenSide === "remote";

  return (
    <div className="flex items-center text-sm gap-2">
      <span className="w-40 text-ink-2 truncate">{diff.header}</span>
      <span
        data-testid={`local-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("local")}
        className={cn(
          "flex-1 px-2.5 py-1 rounded-pill cursor-pointer text-center truncate border",
          localActive
            ? "bg-ok-soft border-ok-edge text-ok font-semibold"
            : "bg-paper-2 border-rule text-muted hover:bg-ok-soft"
        )}
      >
        {diff.localValue || "(empty)"}
      </span>
      <span className="text-muted">→</span>
      <span
        data-testid={`remote-value-${battletag}-${diff.field}`}
        onClick={() => onChoose("remote")}
        className={cn(
          "flex-1 px-2.5 py-1 rounded-pill cursor-pointer text-center truncate border",
          remoteActive
            ? "bg-sky-soft border-sky-edge text-sky-ink font-semibold"
            : "bg-paper-2 border-rule text-muted hover:bg-sky-soft"
        )}
      >
        {diff.remoteValue || "(empty)"}
      </span>
    </div>
  );
}

function NewPlayerRow({
  player,
  onToggle,
}: {
  player: PlayerDiff;
  onToggle: () => void;
}) {
  const checkboxId = `sync-diff-${player.type}-${player.battletag}`;

  return (
    <Field
      orientation="horizontal"
      className="gap-3 py-1.5 px-2.5 rounded-well hover:bg-sky-soft/60"
    >
      <Checkbox
        id={checkboxId}
        checked={player.selected}
        onCheckedChange={onToggle}
        aria-label={player.battletag}
      />
      <FieldLabel htmlFor={checkboxId} className="cursor-pointer font-semibold text-ink">
        {player.battletag}
      </FieldLabel>
      {player.validationWarnings.length > 0 && (
        <Badge variant="warn" className="ml-auto">
          {player.validationWarnings.length} warning(s)
        </Badge>
      )}
    </Field>
  );
}
