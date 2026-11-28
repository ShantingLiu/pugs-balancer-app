import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-all outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 data-[disabled]:pointer-events-none data-[disabled]:opacity-60 aria-invalid:border-bad-edge aria-invalid:ring-2 aria-invalid:ring-bad/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>[data-icon=inline-start]]:-ml-0.5 [&>[data-icon=inline-end]]:-mr-0.5",
  {
    variants: {
      variant: {
        primary: "app-primary",
        win1: "app-win-1",
        sky: "app-sky",
        secondary: "app-secondary",
        quiet: "app-quiet",
        danger: "app-danger",
        ghost: "bg-transparent text-ink-2 hover:bg-sky-soft hover:text-ink",
        link: "bg-transparent text-sky-ink underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default:
          "px-4 py-2 text-sm has-[>svg]:px-3.5 has-data-[icon=inline-start]:pl-3 has-data-[icon=inline-end]:pr-3",
        sm: "px-3 py-1.5 text-xs gap-1.5 has-data-[icon=inline-start]:pl-2.5 has-data-[icon=inline-end]:pr-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "px-2.5 py-1 text-xs gap-1 has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-end]:pr-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "px-6 py-2.5 text-base has-[>svg]:px-5 has-data-[icon=inline-start]:pl-4.5 has-data-[icon=inline-end]:pr-4.5",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-6 p-0 [&_svg:not([class*='size-'])]:size-3.5",
      },
      shape: {
        pill: "rounded-pill",
        well: "rounded-well",
        card: "rounded-card",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      shape: "pill",
    },
  }
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

/** Tactile themed button built on Hallmark/Stitch tokens and Base UI Button. */
function Button({
  className,
  variant = "primary",
  size = "default",
  shape = "pill",
  render,
  nativeButton,
  type,
  ...props
}: ButtonProps) {
  const isNativeButton = nativeButton ?? !render;

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      render={render}
      nativeButton={nativeButton}
      type={isNativeButton ? (type ?? "button") : type}
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants, type ButtonProps };
