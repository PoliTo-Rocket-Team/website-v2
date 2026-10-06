// A project's gallery, as a list of items. A photo is `{ src, alt, caption? }`,
// the shape the dashboard will fill. Until it exists a slot can hold a
// placeholder instead: it has no `src`, so a placeholder can never be drawn as
// a broken image, and a photo can never be drawn as a placeholder.

export type GalleryPhoto = {
  /** A path under public/ or an allowed remote URL; drawn through next/image. */
  src: string;
  alt: string;
  caption?: string;
};

export type GalleryPlaceholder = {
  placeholder: true;
  /** What the photo in this slot will show, for assistive tech. */
  alt: string;
  caption?: string;
};

export type GalleryItem = GalleryPhoto | GalleryPlaceholder;

/** A gallery with at least one item: the only kind the carousel can draw. */
export type FilledGallery = readonly [GalleryItem, ...GalleryItem[]];

export const isPhoto = (item: GalleryItem): item is GalleryPhoto => "src" in item;

export const isFilled = (items: readonly GalleryItem[]): items is FilledGallery => items.length > 0;

/** The index `step` places from `index`, wrapping around both ends. */
export const wrapIndex = (index: number, step: number, count: number) => (((index + step) % count) + count) % count;

/**
 * Where item `index` sits relative to the current one, wrapped so the list
 * reads as a ring: 0 is current, -1 and 1 are its neighbours.
 */
export function ringOffset(index: number, current: number, count: number) {
  const d = wrapIndex(index, -current, count);
  return d > count / 2 ? d - count : d;
}
