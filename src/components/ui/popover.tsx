import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

/** Root Base UI Popover container. */
function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />;
}

/** Trigger that toggles the Popover. */
function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/** Portaled popover surface styled with .app-modal. */
function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-[450]"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "app-modal w-72 origin-(--transform-origin) p-4 text-ink outline-none transition-[opacity,scale,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] data-[closed]:duration-[160ms] data-[closed]:ease-[cubic-bezier(0.4,0,0.2,1)] data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[side=bottom]:data-[starting-style]:-translate-y-1.5 data-[side=top]:data-[starting-style]:translate-y-1.5 data-[side=left]:data-[starting-style]:translate-x-1.5 data-[side=right]:data-[starting-style]:-translate-x-1.5",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
