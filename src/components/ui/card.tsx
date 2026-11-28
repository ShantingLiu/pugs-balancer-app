import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("flex flex-col text-ink", {
  variants: {
    variant: {
      surface: "app-surface",
      well: "app-well",
      team1: "app-team-1",
      team2: "app-team-2",
    },
  },
  defaultVariants: {
    variant: "surface",
  },
});

type CardProps = React.ComponentProps<"div"> & VariantProps<typeof cardVariants>;

/** Hallmark/Stitch card container supporting surface, well, team1, and team2 variants. */
function Card({ className, variant = "surface", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  );
}

/** Header section for Card titles, descriptions, and optional actions. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  );
}

/** Heading title inside CardHeader. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-semibold leading-none text-heading", className)}
      {...props}
    />
  );
}

/** Muted supporting description inside CardHeader. */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}

/** Primary body container inside Card. */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pb-5", className)}
      {...props}
    />
  );
}

/** Footer actions container inside Card. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-5 pb-5", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  // eslint-disable-next-line react-refresh/only-export-components
  cardVariants,
  type CardProps,
};
