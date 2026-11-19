import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

// =============================================================================
// AppSelect - Accessible custom select menu matching the app token system
// =============================================================================

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface AppSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  ariaLabel: string;
  className?: string;
}

export function AppSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: AppSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isOpen]);

  const currentOption = options[selectedIndex] ?? options[0];

  function openMenu(initialIndex = selectedIndex) {
    setActiveIndex(initialIndex);
    setIsOpen(true);
  }

  function selectValue(nextValue: T) {
    onChange(nextValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!isOpen) {
          openMenu(selectedIndex);
        } else {
          setActiveIndex((prev) => (prev + 1) % options.length);
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!isOpen) {
          openMenu(selectedIndex);
        } else {
          setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
        }
        break;
      }
      case "Home": {
        if (isOpen) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      }
      case "End": {
        if (isOpen) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (!isOpen) {
          openMenu(selectedIndex);
        } else {
          const highlighted = options[activeIndex];
          if (highlighted) selectValue(highlighted.value);
        }
        break;
      }
      case "Tab": {
        if (isOpen) setIsOpen(false);
        break;
      }
    }
  }

  return (
    <div className="relative flex-1 min-w-0" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={isOpen ? `${listboxId}-opt-${activeIndex}` : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu(selectedIndex))}
        onKeyDown={handleTriggerKeyDown}
        className={`app-input w-full min-w-0 inline-flex items-center justify-between gap-1.5 px-3 py-1.5 text-xs font-semibold app-nowrap ${className}`}
      >
        <span className="truncate">{currentOption?.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-2 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="app-select-menu absolute left-0 top-full mt-1.5 min-w-[max(100%,11rem)] w-max z-50"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === activeIndex;
            return (
              <button
                key={option.value}
                id={`${listboxId}-opt-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectValue(option.value)}
                className={`app-select-option w-full flex items-center gap-2 pl-3 pr-9 py-2 text-left text-sm app-nowrap ${
                  isHighlighted ? "app-select-option--active" : ""
                }`}
              >
                <span
                  className="w-4 h-4 inline-flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-pink-ink" />}
                </span>
                <span className={isSelected ? "font-semibold" : "font-normal"}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
