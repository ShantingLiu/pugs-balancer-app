import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// =============================================================================
// AppSelect - Typed wrapper around Base UI Select matching the app token system
// =============================================================================

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface AppSelectProps<T extends string> {
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
  className,
}: AppSelectProps<T>) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onChange(nextValue as T);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn("flex-1 min-w-0", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
