import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-well border text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-2.5 [&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg]:translate-y-0.5 [&>svg]:text-current [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        info: "bg-sky-soft border-sky-edge text-sky-ink",
        ok: "bg-ok-soft border-ok-edge text-ok",
        warn: "bg-warn-soft border-warn-edge text-warn",
        bad: "bg-bad-soft border-bad-edge text-bad",
      },
      size: {
        default: "px-3.5 py-2.5 text-sm",
        compact:
          "px-2.5 py-2 text-xs has-[>svg]:grid-cols-[0.875rem_1fr] has-[>svg]:gap-x-2 [&>svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "info",
      size: "default",
    },
  }
);

type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants>;

/** Semantic callout banner for info, ok, warn, and bad statuses. */
function Alert({
  className,
  variant = "info",
  size = "default",
  ...props
}: AlertProps) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role="alert"
      className={cn(alertVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** Short title inside Alert. */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 min-h-4 font-semibold leading-snug text-ink",
        className
      )}
      {...props}
    />
  );
}

/** Body copy inside Alert. */
function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-ink-2 [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Alert, AlertTitle, AlertDescription, alertVariants, type AlertProps };
