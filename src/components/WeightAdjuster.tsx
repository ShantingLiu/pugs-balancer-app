import { useState, useCallback, useMemo } from "react";
import { useSessionStore } from "@store/sessionStore";
import { getEffectiveSR } from "@utils/rankMapper";
import type { LobbyPlayer, Role } from "@engine/types";

// =============================================================================
// WeightAdjuster - Popover for temporary weight adjustments
// =============================================================================

interface WeightAdjusterProps {
  player: LobbyPlayer;
  onClose: () => void;
}

export function WeightAdjuster({ player, onClose }: WeightAdjusterProps) {
  const setTempWeight = useSessionStore((state) => state.setTempWeight);

  const [weight, setWeight] = useState(
    player.tempWeightOverride ?? player.weightModifier
  );

  const effectiveSRs = useMemo(() => {
    const result: { role: Role; sr: number }[] = [];
    const tempPlayer = { ...player, tempWeightOverride: weight };

    for (const role of player.rolesWilling) {
      result.push({
        role,
        sr: getEffectiveSR(tempPlayer, role),
      });
    }
    return result;
  }, [player, weight]);

  const handleApply = useCallback(() => {
    if (weight === player.weightModifier) {
      setTempWeight(player.battletag, null);
    } else {
      setTempWeight(player.battletag, weight);
    }
    onClose();
  }, [weight, player, setTempWeight, onClose]);

  const handleClear = useCallback(() => {
    setTempWeight(player.battletag, null);
    onClose();
  }, [player.battletag, setTempWeight, onClose]);

  const presets = [-200, -100, -50, 0, 50, 100, 200];

  return (
    <div
      className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="app-modal p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink mb-3">
          Adjust Weight: {player.battletag.split("#")[0]}
        </h3>

        <div className="text-sm text-ink-2 mb-4">
          Base weight modifier:{" "}
          <span className="app-measured font-semibold">
            {player.weightModifier > 0 ? "+" : ""}
            {player.weightModifier}
          </span>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-ink-2 mb-2">
            Temp Override:{" "}
            <span className="app-measured text-pink-ink">
              {weight > 0 ? "+" : ""}
              {weight}
            </span>
          </label>
          <input
            type="range"
            min={-500}
            max={500}
            step={10}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            aria-label="Temporary weight override"
            style={{ "--range-pct": `${((weight + 500) / 1000) * 100}%` } as React.CSSProperties}
            className="w-full app-range"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset}
              onClick={() => setWeight(preset)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-pill border app-measured ${
                weight === preset
                  ? "app-primary"
                  : "bg-paper-3 border-rule text-ink-2 hover:bg-sky-soft"
              }`}
            >
              {preset > 0 ? "+" : ""}
              {preset}
            </button>
          ))}
        </div>

        <div className="app-well p-3 mb-4">
          <div className="text-xs font-semibold text-ink-2 mb-2">Effective SR Preview</div>
          <div className="space-y-1">
            {effectiveSRs.map(({ role, sr }) => (
              <div key={role} className="flex justify-between text-sm">
                <span
                  className={`font-semibold ${
                    role === "Tank"
                      ? "text-tank"
                      : role === "DPS"
                      ? "text-dps"
                      : "text-sup"
                  }`}
                >
                  {role}
                </span>
                <span className="app-measured font-semibold text-ink">{sr.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-2 px-4 app-secondary rounded-pill text-sm font-semibold"
          >
            Clear Override
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 px-4 app-primary rounded-pill text-sm font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
