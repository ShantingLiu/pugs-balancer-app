import type { Warning } from "@engine/types";
import { AlertTriangle, CircleOff, Gamepad2, Link2, Scale, Swords, Users } from "lucide-react";

// =============================================================================
// WarningsPanel - Displays algorithm warnings
// =============================================================================

interface WarningsPanelProps {
  warnings: Warning[];
  compact?: boolean;
}

function WarningIcon({ type }: { type: Warning["type"] }) {
  const props = { className: "h-4 w-4 shrink-0", "aria-hidden": true as const };
  switch (type) {
    case "one_trick_conflict":
      return <Gamepad2 {...props} />;
    case "archetype_gap":
      return <Swords {...props} />;
    case "soft_constraint_ignored":
      return <Link2 {...props} />;
    case "imbalanced_roles":
      return <Scale {...props} />;
    case "insufficient_players":
      return <Users {...props} />;
    case "impossible_composition":
      return <CircleOff {...props} />;
    default:
      return <AlertTriangle {...props} />;
  }
}

export function WarningsPanel({ warnings, compact = false }: WarningsPanelProps) {
  if (warnings.length === 0) return null;

  const errors = warnings.filter((w) => w.severity === "error");
  const warningItems = warnings.filter((w) => w.severity === "warning");

  return (
    <div className="space-y-2">
      {errors.map((warning, idx) => (
        <div
          key={`error-${idx}`}
          className={`flex items-start gap-2 rounded-well ${
            compact ? "p-2.5 text-xs" : "p-3 text-sm"
          } bg-bad-soft border border-bad-edge text-bad`}
        >
          <WarningIcon type={warning.type} />
          <span className="text-ink font-semibold">{warning.message}</span>
        </div>
      ))}

      {warningItems.map((warning, idx) => (
        <div
          key={`warning-${idx}`}
          className={`flex items-start gap-2 rounded-well ${
            compact ? "p-2.5 text-xs" : "p-3 text-sm"
          } bg-warn-soft border border-warn-edge text-warn`}
        >
          <WarningIcon type={warning.type} />
          <span className="text-ink">{warning.message}</span>
        </div>
      ))}
    </div>
  );
}
