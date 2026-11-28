import * as React from "react";
import { cn } from "@/lib/utils";

/** Styled text input using .app-input tokens. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "app-input w-full min-w-0 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad-edge aria-invalid:ring-2 aria-invalid:ring-bad/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
