import type { Warning } from "@engine/types";
import { AlertTriangle, CircleOff, Gamepad2, Link2, Scale, Swords, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// =============================================================================
// WarningsPanel - Displays algorithm warnings
// =============================================================================

interface WarningsPanelProps {
  warnings: Warning[];
  compact?: boolean;
}

function WarningIcon({ type }: { type: Warning["type"] }) {
  const props = { "aria-hidden": true as const };
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
  const alertSize = compact ? "compact" : "default";

  return (
    <div className="flex flex-col gap-2">
      {errors.map((warning, idx) => (
        <Alert key={`error-${idx}`} variant="bad" size={alertSize}>
          <WarningIcon type={warning.type} />
          <AlertTitle>{warning.message}</AlertTitle>
        </Alert>
      ))}

      {warningItems.map((warning, idx) => (
        <Alert key={`warning-${idx}`} variant="warn" size={alertSize}>
          <WarningIcon type={warning.type} />
          <AlertDescription className="text-ink">{warning.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
