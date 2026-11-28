import { useState, useCallback, useMemo } from "react";
import { useSessionStore } from "@store/sessionStore";
import { getEffectiveSR } from "@utils/rankMapper";
import type { LobbyPlayer, Role } from "@engine/types";
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
import { Slider } from "@/components/ui/slider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// =============================================================================
// WeightAdjuster - Modal for temporary weight adjustments
// =============================================================================

interface WeightAdjusterProps {
  player: LobbyPlayer | null;
  isOpen?: boolean;
  onClose: () => void;
}

export function WeightAdjuster({ player, isOpen, onClose }: WeightAdjusterProps) {
  const open = isOpen ?? Boolean(player);
  const setTempWeight = useSessionStore((state) => state.setTempWeight);

  const [activePlayer, setActivePlayer] = useState<LobbyPlayer | null>(player);
  const [weight, setWeight] = useState(
    player ? (player.tempWeightOverride ?? player.weightModifier) : 0
  );
  const [prevProps, setPrevProps] = useState({ player, open });

  if (player !== prevProps.player || open !== prevProps.open) {
    setPrevProps({ player, open });
    if (player) {
      setActivePlayer(player);
      if (player !== prevProps.player || (open && !prevProps.open)) {
        setWeight(player.tempWeightOverride ?? player.weightModifier);
      }
    }
  }

  const effectiveSRs = useMemo(() => {
    if (!activePlayer) return [];
    const result: { role: Role; sr: number }[] = [];
    const tempPlayer = { ...activePlayer, tempWeightOverride: weight };

    for (const role of activePlayer.rolesWilling) {
      result.push({
        role,
        sr: getEffectiveSR(tempPlayer, role),
      });
    }
    return result;
  }, [activePlayer, weight]);

  const handleApply = useCallback(() => {
    if (!activePlayer) return;
    if (weight === activePlayer.weightModifier) {
      setTempWeight(activePlayer.battletag, null);
    } else {
      setTempWeight(activePlayer.battletag, weight);
    }
    onClose();
  }, [weight, activePlayer, setTempWeight, onClose]);

  const handleClear = useCallback(() => {
    if (!activePlayer) return;
    setTempWeight(activePlayer.battletag, null);
    onClose();
  }, [activePlayer, setTempWeight, onClose]);

  const presets = [-200, -100, -50, 0, 50, 100, 200];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Adjust Weight: {activePlayer?.battletag.split("#")[0] ?? ""}
          </DialogTitle>
          <DialogDescription>
            Base weight modifier:{" "}
            <span className="app-measured font-semibold text-ink">
              {(activePlayer?.weightModifier ?? 0) > 0 ? "+" : ""}
              {activePlayer?.weightModifier ?? 0}
            </span>
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field className="gap-2">
            <FieldLabel id="weight-adjuster-slider-label">
              Temp Override:{" "}
              <span className="app-measured text-pink-ink">
                {weight > 0 ? "+" : ""}
                {weight}
              </span>
            </FieldLabel>
            <Slider
              aria-labelledby="weight-adjuster-slider-label"
              min={-500}
              max={500}
              step={10}
              value={weight}
              onValueChange={(val) => setWeight(typeof val === "number" ? val : val[0])}
            />
          </Field>

          <Field className="gap-1.5">
            <FieldLabel id="weight-adjuster-presets-label" className="sr-only">
              Weight presets
            </FieldLabel>
            <ToggleGroup
              value={presets.includes(weight) ? [String(weight)] : []}
              onValueChange={(vals) => {
                if (vals[0] !== undefined) setWeight(Number(vals[0]));
              }}
              aria-labelledby="weight-adjuster-presets-label"
              className="w-full flex-wrap justify-between"
            >
              {presets.map((preset) => (
                <ToggleGroupItem
                  key={preset}
                  value={String(preset)}
                  className="app-measured flex-1 px-1.5"
                >
                  {preset > 0 ? "+" : ""}
                  {preset}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </FieldGroup>

        <Card variant="well">
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-xs text-ink-2">Effective SR Preview</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex flex-col gap-1">
            {effectiveSRs.map(({ role, sr }) => (
              <div key={role} className="flex justify-between text-sm">
                <span
                  className={cn(
                    "font-semibold",
                    role === "Tank"
                      ? "text-tank"
                      : role === "DPS"
                      ? "text-dps"
                      : "text-sup"
                  )}
                >
                  {role}
                </span>
                <span className="app-measured font-semibold text-ink">{sr.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <DialogFooter className="sm:justify-stretch gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={handleClear}>
            Clear Override
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
