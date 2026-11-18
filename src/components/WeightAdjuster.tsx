import { useState, useCallback, useMemo, useEffect } from "react";
import { X } from "lucide-react";
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 app-backdrop flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="app-modal p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">
            Adjust Weight: {player.battletag.split("#")[0]}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Current base weight info */}
        <div className="text-sm text-muted mb-4 app-measured">
          Base weight modifier: {player.weightModifier > 0 ? "+" : ""}
          {player.weightModifier}
        </div>

        {/* Slider */}
        <div className="mb-4">
          <label className="block text-sm text-ink-2 mb-2 app-measured">
            Temp Override: {weight > 0 ? "+" : ""}
            {weight}
          </label>
          <input
            type="range"
            min={-500}
            max={500}
            step={10}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Presets */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setWeight(preset)}
              className={`px-1 py-1 text-xs app-measured transition-colors text-center ${
                weight === preset ? "app-chip-active" : "app-chip"
              }`}
            >
              {preset > 0 ? "+" : ""}
              {preset}
            </button>
          ))}
        </div>

        {/* Effective SR preview */}
        <div className="app-subsurface p-3 mb-4">
          <div className="text-sm text-muted mb-2">Effective SR Preview:</div>
          <div className="space-y-1">
            {effectiveSRs.map(({ role, sr }) => (
              <div key={role} className="flex justify-between text-sm">
                <span
                  className={
                    role === "Tank"
                      ? "role-text-tank font-medium"
                      : role === "DPS"
                      ? "role-text-dps font-medium"
                      : "role-text-support font-medium"
                  }
                >
                  {role}:
                </span>
                <span className="app-measured text-ink">{sr.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="flex-1 py-2 px-4 app-secondary text-sm transition-colors"
          >
            Clear Override
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 px-4 app-primary text-sm font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
