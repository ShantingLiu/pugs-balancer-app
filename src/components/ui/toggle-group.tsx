import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cn } from "@/lib/utils";

type ToggleGroupActiveVariant = "primary" | "sky" | "ok" | "bad" | "none";

type ToggleGroupContextValue = {
  activeVariant?: ToggleGroupActiveVariant;
  size?: "default" | "sm";
};

const activeVariantClassMap: Record<ToggleGroupActiveVariant, string> = {
  primary: "app-tab-primary",
  sky: "app-tab-sky",
  ok: "app-tab-ok",
  bad: "app-tab-bad",
  none: "",
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  activeVariant: "primary",
  size: "sm",
});

/** Pill-well segmented toggle group built on Base UI ToggleGroup. */
function ToggleGroup<Value extends string = string>({
  className,
  activeVariant = "primary",
  size = "sm",
  children,
  ...props
}: ToggleGroupPrimitive.Props<Value> & ToggleGroupContextValue) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        "app-well rounded-pill inline-flex w-fit items-center gap-0.5 p-0.5",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ activeVariant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

/** Individual pill item inside ToggleGroup backed by Base UI Toggle. */
function ToggleGroupItem({
  className,
  activeVariant,
  size,
  ...props
}: TogglePrimitive.Props & ToggleGroupContextValue) {
  const context = React.useContext(ToggleGroupContext);
  const resolvedVariant = activeVariant ?? context.activeVariant ?? "primary";
  const resolvedSize = size ?? context.size ?? "sm";

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-pill border border-transparent font-semibold whitespace-nowrap text-muted transition-all outline-none hover:text-ink focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        resolvedSize === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        activeVariantClassMap[resolvedVariant],
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem, type ToggleGroupActiveVariant };
