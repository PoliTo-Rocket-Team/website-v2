import type { FilledGallery } from "@/components/gallery/items";

/**
 * Figures are set as the boards set them ("2 167 mm"), with no-break spaces so
 * a figure never wraps. Only figures go through n(), never running copy.
 */
export const n = (s: string) => s.replace(/ /g, " ");

/**
 * Six placeholder slots until the dashboard uploads real photos; a photo
 * then takes a slot as `{ src, alt, caption? }`.
 */
export function placeholderGallery(project: string): FilledGallery {
  const slot = (i: number) => ({ placeholder: true as const, alt: `Placeholder for ${project} photo ${i}` });
  return [slot(1), slot(2), slot(3), slot(4), slot(5), slot(6)];
}
