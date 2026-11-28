import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-paper-3 border-rule text-ink-2",
        tank: "role-tank",
        dps: "role-dps",
        support: "role-support",
        pink: "app-chip--pink",
        sky: "app-chip--sky",
        purple: "app-chip--purple",
        emerald: "app-chip--emerald",
        amber: "app-chip--amber",
        slate: "app-chip--slate",
        ok: "bg-ok-soft border-ok-edge text-ok",
        warn: "bg-warn-soft border-warn-edge text-warn",
        bad: "bg-bad-soft border-bad-edge text-bad",
        lock: "bg-lock-soft border-lock-edge text-lock",
        muted: "bg-paper-3 border-rule text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type BadgeProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

/** Semantic pastel pill badge for roles, statuses, and player chips. */
function Badge({
  className,
  variant = "default",
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        "data-slot": "badge",
        "data-variant": variant,
        className: cn(badgeVariants({ variant, className })),
      } as React.ComponentProps<"span">,
      props
    ),
  });
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants, type BadgeProps };
