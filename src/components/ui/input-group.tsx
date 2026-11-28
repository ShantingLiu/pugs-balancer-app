import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Composable input wrapper with shared .app-input border, hover, focus ring, and invalid styling. */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "app-input-group group/input-group relative flex w-full min-w-0 items-center transition-[color,background-color,border-color,box-shadow]",
        "has-[>textarea]:h-auto",
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
        "has-[[data-slot][aria-invalid=true]]:border-bad-edge has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-bad/20",
        className
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-1.5 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-well [&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:ml-[-0.35rem] has-[>kbd]:ml-[-0.25rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:mr-[-0.35rem] has-[>kbd]:mr-[-0.25rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-2.5 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2.5",
        "block-end":
          "order-last w-full justify-start px-3 pb-2.5 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
);

/** Leading, trailing, or block addon slot inside an InputGroup. */
function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement
          ?.querySelector<HTMLElement>("input, textarea")
          ?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-1.5 text-xs shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-pill px-2 py-0 has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 gap-1.5 rounded-pill px-2.5 py-0 has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs":
          "size-6 rounded-pill p-0 has-[>svg]:p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-7 rounded-pill p-0 has-[>svg]:p-0 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
);

/** Compact action button tailored for placement inside InputGroupAddon. */
function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

/** Static prefix/suffix text or icon label inside InputGroupAddon. */
function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-text"
      className={cn(
        "flex items-center gap-1.5 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/** Borderless Input bound to its parent InputGroup focus and validation ring. */
function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:outline-none aria-invalid:ring-0",
        className
      )}
      {...props}
    />
  );
}

/** Borderless Textarea bound to its parent InputGroup focus and validation ring. */
function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2.5 shadow-none focus-visible:outline-none aria-invalid:ring-0",
        className
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
