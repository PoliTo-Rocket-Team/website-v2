import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ApplyPosition } from "@/app/actions/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Convert a title to a URL-friendly slug
 */
export function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate apply URL for a position
 */
export function getApplyUrl(position: ApplyPosition): string {
  const slugTitle = slugifyTitle(position.title || "");
  return `/apply/${position.dept_code}-${position.div_code}-${slugTitle}`;
}

/**
 * Find a position from a slug by matching department code, division code, and slugified title
 */
export function getPositionFromSlug(
  slug: string,
  positions: ApplyPosition[]
): ApplyPosition | null {
  const parts = slug.split("-");
  if (parts.length < 3) {
    return null;
  }

  const deptCode = parts[0];
  const divCode = parts[1];
  const slugifiedTitle = parts.slice(2).join("-");

  return (
    positions.find(
      position =>
        position.dept_code === deptCode &&
        position.div_code === divCode &&
        slugifyTitle(position.title || "") === slugifiedTitle
    ) || null
  );
}
