import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

/** Root Base UI Tabs container. */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      className={cn(
        "flex gap-3 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  );
}

/** Pill-shaped surface container for TabsTrigger items. */
function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "app-surface rounded-pill inline-flex w-full items-center gap-1.5 p-1.5",
        className
      )}
      {...props}
    />
  );
}

/** Tactile pill tab button supporting primary (pink) and sky active accents. */
function TabsTrigger({
  className,
  activeVariant = "primary",
  ...props
}: TabsPrimitive.Tab.Props & {
  activeVariant?: "primary" | "sky";
}) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill border border-transparent px-4 py-2 text-sm font-bold whitespace-nowrap text-muted transition-all outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        activeVariant === "sky" ? "app-tab-sky" : "app-tab-primary",
        className
      )}
      {...props}
    />
  );
}

/** Panel content rendered for the active tab. */
function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
