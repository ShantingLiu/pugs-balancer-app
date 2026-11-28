import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";

/** Base UI Slider styled to match .app-range (gradient fill, paper-3 track, 18px thumb). */
function Slider<
  Value extends number | readonly number[] = number | readonly number[],
>({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbAlignment = "center",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SliderPrimitive.Root.Props<Value>) {
  const thumbCount = React.useMemo(() => {
    if (Array.isArray(value)) return value.length;
    if (Array.isArray(defaultValue)) return defaultValue.length;
    return 1;
  }, [value, defaultValue]);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment={thumbAlignment}
      className={cn(
        "data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow rounded-pill border border-rule bg-paper-3 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="app-slider-range rounded-pill select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          />
          {Array.from({ length: thumbCount }, (_, index) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              key={index}
              index={index}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              className="app-slider-thumb block shrink-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2 data-[disabled]:pointer-events-none"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
