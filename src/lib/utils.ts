import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind CSS classes with conditional clsx support. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
