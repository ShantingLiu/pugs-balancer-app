import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible animated loading indicator built on Lucide Loader2Icon. */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
