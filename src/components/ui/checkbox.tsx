import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible Base UI Checkbox styled with Stitch pastel input and accent tokens. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-input-edge bg-paper-2 text-accent-ink shadow-xs transition-colors outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 aria-invalid:border-bad-edge aria-invalid:ring-2 aria-invalid:ring-bad/20 data-[checked]:border-pink-edge data-[checked]:bg-accent data-[indeterminate]:border-pink-edge data-[indeterminate]:bg-accent",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <Check className="size-3 stroke-[2.75]" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
