import type { Warning } from "@engine/types";
import { AlertTriangle, CircleOff, Gamepad2, Link2, Scale, Swords, Users } from "lucide-react";

// =============================================================================
// WarningsPanel - Displays algorithm warnings
// =============================================================================

interface WarningsPanelProps {
  warnings: Warning[];
  compact?: boolean;
}

/** Get icon for warning type */
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
      {/* Errors first */}
      {errors.map((warning, idx) => (
        <div
          key={`error-${idx}`}
          className={`flex items-start gap-2 rounded-lg ${
            compact ? "p-2 text-xs" : "p-3 text-sm"
          } bg-[var(--color-bad-soft)] border border-[var(--color-bad)] text-[var(--color-ink)]`}
        >
          <WarningIcon type={warning.type} />
          <span>{warning.message}</span>
        </div>
      ))}

      {/* Warnings */}
      {warningItems.map((warning, idx) => (
        <div
          key={`warning-${idx}`}
          className={`flex items-start gap-2 rounded-lg ${
            compact ? "p-2 text-xs" : "p-3 text-sm"
          } bg-[var(--color-accent-soft)] border border-[var(--color-accent)] text-[var(--color-ink)]`}
        >
          <WarningIcon type={warning.type} />
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}
