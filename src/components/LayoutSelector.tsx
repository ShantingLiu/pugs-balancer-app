import { useState } from "react";
import { LayoutGrid, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@store/sessionStore";
import { LAYOUT_OPTIONS } from "@config/headerOptions";

// =============================================================================
// LayoutSelector - Dropdown to switch workspace layouts
// =============================================================================

export function LayoutSelector() {
  const layoutMode = useSessionStore((state) => state.layoutMode);
  const setLayoutMode = useSessionStore((state) => state.setLayoutMode);
  const [isOpen, setIsOpen] = useState(false);

  const currentLayout =
    LAYOUT_OPTIONS.find((opt) => opt.id === layoutMode) ?? LAYOUT_OPTIONS[0];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger render={<Button variant="secondary" />} />}
        >
          <LayoutGrid data-icon="inline-start" className="text-pink-ink" aria-hidden="true" />
          <span>{currentLayout.label}</span>
          <ChevronDown
            data-icon="inline-end"
            className={cn("transition-transform", isOpen && "rotate-180")}
            aria-hidden="true"
          />
        </TooltipTrigger>
        <TooltipContent>Layout: {currentLayout.label}</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-64 p-1.5 flex flex-col gap-1">
        {LAYOUT_OPTIONS.map((option) => {
          const isActive = option.id === layoutMode;
          return (
            <Button
              key={option.id}
              variant="ghost"
              shape="well"
              onClick={() => {
                setLayoutMode(option.id);
                setIsOpen(false);
              }}
              className={cn(
                "h-auto w-full flex-col items-start justify-start text-left whitespace-normal px-3 py-2.5 gap-0.5",
                isActive ? "bg-pink-soft hover:bg-pink-soft" : "hover:bg-sky-soft",
              )}
            >
              <div className="flex items-center gap-2">
                {isActive && (
                  <Check data-icon="inline-start" className="text-pink-ink" aria-hidden="true" />
                )}
                <span className="font-semibold text-ink">{option.label}</span>
              </div>
              <p className="text-xs text-muted font-normal ml-6">{option.description}</p>
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
