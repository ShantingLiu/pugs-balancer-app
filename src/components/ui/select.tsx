import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Root Base UI Select container (bare re-export preserves generic Value/Multiple inference). */
const Select = SelectPrimitive.Root;

/** Semantic group wrapper for SelectItem elements. */
function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn(className)}
      {...props}
    />
  );
}

/** Displays the currently selected value or placeholder inside SelectTrigger. */
function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 truncate text-left", className)}
      {...props}
    />
  );
}

/** Select trigger button styled with .app-input. */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "app-input inline-flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 whitespace-nowrap text-left font-semibold disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 aria-invalid:border-bad-edge aria-invalid:ring-2 aria-invalid:ring-bad/20 data-[placeholder]:text-muted data-[size=default]:px-3 data-[size=default]:py-2 data-[size=default]:text-sm data-[size=sm]:px-3 data-[size=sm]:py-1.5 data-[size=sm]:text-xs [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDown
            className="size-3.5 text-ink-2 opacity-80"
            aria-hidden="true"
          />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

/** Scroll-up affordance when SelectContent overflows vertically. */
function SelectScrollUpButton({
  className,
  ...props
}: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center py-1 text-muted",
        className
      )}
      {...props}
    >
      <ChevronUp className="size-3.5" aria-hidden="true" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

/** Scroll-down affordance when SelectContent overflows vertically. */
function SelectScrollDownButton({
  className,
  ...props
}: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 text-muted",
        className
      )}
      {...props}
    >
      <ChevronDown className="size-3.5" aria-hidden="true" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

/** Portaled dropdown menu styled with .app-select-menu and rounded-well. */
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[450]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "app-select-menu rounded-well relative max-h-(--available-height) min-w-[max(8rem,var(--anchor-width))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none transition-[opacity,scale,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] data-[closed]:duration-[160ms] data-[closed]:ease-[cubic-bezier(0.4,0,0.2,1)] data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[side=bottom]:data-[starting-style]:-translate-y-1.5 data-[side=top]:data-[starting-style]:translate-y-1.5 data-[side=left]:data-[starting-style]:translate-x-1.5 data-[side=right]:data-[starting-style]:-translate-x-1.5",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/** Group heading label inside SelectGroup. */
function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-3 py-1.5 text-xs font-semibold text-muted", className)}
      {...props}
    />
  );
}

/** Selectable option styled with .app-select-option and Lucide Check indicator. */
function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "app-select-option relative flex w-full cursor-pointer items-center gap-2 rounded-well py-2 pr-3 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[selected]:font-semibold [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        render={
          <span
            data-slot="select-item-indicator"
            className="pointer-events-none absolute left-2.5 flex size-4 items-center justify-center"
          />
        }
      >
        <Check className="size-3.5 text-pink-ink" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="shrink-0 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/** Divider line between SelectGroups or SelectItems. */
function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-rule", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
