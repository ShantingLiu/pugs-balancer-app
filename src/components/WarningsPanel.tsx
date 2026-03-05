import type { Warning } from "@engine/types";

// =============================================================================
// WarningsPanel - Displays algorithm warnings
// =============================================================================

interface WarningsPanelProps {
  warnings: Warning[];
  compact?: boolean;
}

/** Get icon for warning type */
function getWarningIcon(type: Warning["type"]): string {
  switch (type) {
    case "one_trick_conflict":
      return "🎮";
    case "archetype_gap":
      return "⚔️";
    case "soft_constraint_ignored":
      return "🔗";
    case "imbalanced_roles":
      return "⚖️";
    case "insufficient_players":
      return "👥";
    case "impossible_composition":
      return "❌";
    default:
      return "⚠️";
  }
}

export function WarningsPanel({ warnings, compact = false }: WarningsPanelProps) {
  if (warnings.length === 0) return null;

  const errors = warnings.filter((w) => w.severity === "error");
  const warningItems = warnings.filter((w) => w.severity === "warning");

  return (
    <div className="space-y-2">
      {/* Errors first */}
      {errors.map((warning, idx) => (
        <div
          key={`error-${idx}`}
          className={`flex items-start gap-2 rounded-lg ${
            compact ? "p-2 text-xs" : "p-3 text-sm"
          } bg-red-900/50 border border-red-700 text-red-300`}
        >
          <span className="shrink-0">{getWarningIcon(warning.type)}</span>
          <span>{warning.message}</span>
        </div>
      ))}

      {/* Warnings */}
      {warningItems.map((warning, idx) => (
        <div
          key={`warning-${idx}`}
          className={`flex items-start gap-2 rounded-lg ${
            compact ? "p-2 text-xs" : "p-3 text-sm"
          } bg-yellow-900/50 border border-yellow-700 text-yellow-300`}
        >
          <span className="shrink-0">{getWarningIcon(warning.type)}</span>
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}
