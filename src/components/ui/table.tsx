import * as React from "react";
import { cn } from "@/lib/utils";

/** Responsive scrollable table wrapper and element. */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      />
    </div>
  );
}

/** Table header section with sticky-friendly paper-2 background and rule border. */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("text-muted [&_tr]:border-b [&_tr]:border-rule", className)}
      {...props}
    />
  );
}

/** Table body rows with hairline rule dividers. */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "divide-y divide-rule text-ink-2 [&_tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  );
}

/** Table row with pink-row-hover highlight. */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-rule transition-colors hover:bg-pink-row-hover data-[state=selected]:bg-sky-soft",
        className
      )}
      {...props}
    />
  );
}

/** Table header cell. */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-2 py-1.5 text-left align-middle font-bold whitespace-nowrap text-muted",
        className
      )}
      {...props}
    />
  );
}

/** Table data cell. */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-2 py-2 align-middle", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
};
