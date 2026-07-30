import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn's class merger.
 *
 * Kept exactly as shadcn ships it so `npx shadcn@latest add <component>` drops
 * new components in and they work — the point of using the library is that we
 * do not maintain a fork of it.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
