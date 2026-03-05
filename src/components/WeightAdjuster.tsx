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

  // Calculate effective SR for each role with the current weight
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
    // If weight equals base modifier, clear temp override
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">
          Adjust Weight: {player.battletag.split("#")[0]}
        </h3>

        {/* Current base weight info */}
        <div className="text-sm text-gray-400 mb-4">
          Base weight modifier: {player.weightModifier > 0 ? "+" : ""}
          {player.weightModifier}
        </div>

        {/* Slider */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
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
            className="w-full accent-blue-500"
          />
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setWeight(preset)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                weight === preset
                  ? "bg-blue-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {preset > 0 ? "+" : ""}
              {preset}
            </button>
          ))}
        </div>

        {/* Effective SR preview */}
        <div className="bg-gray-900 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-400 mb-2">Effective SR Preview:</div>
          <div className="space-y-1">
            {effectiveSRs.map(({ role, sr }) => (
              <div key={role} className="flex justify-between text-sm">
                <span
                  className={
                    role === "Tank"
                      ? "text-yellow-400"
                      : role === "DPS"
                      ? "text-red-400"
                      : "text-green-400"
                  }
                >
                  {role}:
                </span>
                <span className="font-mono">{sr.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Clear Override
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
