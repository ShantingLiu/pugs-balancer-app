import * as React from "react";
import { cn } from "@/lib/utils";

/** Styled multi-line textarea using .app-input tokens. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "app-input flex min-h-20 w-full min-w-0 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad-edge aria-invalid:ring-2 aria-invalid:ring-bad/20",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
