import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  OctagonX,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useSessionStore } from "@store/sessionStore";

/** Sonner toast container styled with Hallmark/Stitch tokens and synced to session colorMode. */
function Toaster({ theme, ...props }: ToasterProps) {
  const colorMode = useSessionStore((state) => state.colorMode);

  return (
    <Sonner
      theme={theme ?? colorMode}
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="size-4" aria-hidden="true" />,
        info: <Info className="size-4" aria-hidden="true" />,
        warning: <AlertTriangle className="size-4" aria-hidden="true" />,
        error: <OctagonX className="size-4" aria-hidden="true" />,
        loading: (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-paper-2)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-modal-edge)",
          "--border-radius": "var(--radius-well)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
