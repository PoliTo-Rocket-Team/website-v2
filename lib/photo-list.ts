// A panel's list of photos as the editor works on it (issue #430): the
// Photos section of the Edit post panel and a launch card's photos in the
// Edit <project> panel. Each photo is known by its file (`src`), which a list
// never holds twice, so a description always belongs to the photo it was
// typed for. The description box shows the picked photo; its previous and
// next arrows move the pick to another photo and never carry the text
// along. Each edit answers the whole list, for the panel to keep.

/** A photo in a list: its file, which is its id there, and its description. */
export type ListedPhoto = { readonly src: string; readonly alt: string };

/** The photo the description box shows, by its file, with its place in the list; null when none is picked or it is gone. */
export function pickedPhoto<P extends ListedPhoto>(photos: readonly P[], picked: string | null): { readonly photo: P; readonly index: number } | null {
  const index = picked === null ? -1 : photos.findIndex((p) => p.src === picked);
  return index === -1 ? null : { photo: photos[index], index };
}

/**
 * The photo `by` places from the picked one, for the box's previous and next
 * arrows; null at either end of the list, or when no photo is picked.
 */
export function neighbourOf(photos: readonly ListedPhoto[], picked: string | null, by: -1 | 1): string | null {
  const at = pickedPhoto(photos, picked);
  return at === null ? null : (photos[at.index + by]?.src ?? null);
}

/** The list with the description of the photo `src` set to `alt`; every other photo keeps its own. */
export function describePhoto<P extends ListedPhoto>(photos: readonly P[], src: string, alt: string): P[] {
  return photos.map((p) => (p.src === src ? { ...p, alt } : p));
}

/** The list with the photo `src` moved one place earlier or later, taking its description with it. */
export function movePhoto<P extends ListedPhoto>(photos: readonly P[], src: string, by: -1 | 1): P[] {
  const from = photos.findIndex((p) => p.src === src);
  const to = from + by;
  if (from === -1 || to < 0 || to >= photos.length) return [...photos];
  const order = [...photos];
  [order[from], order[to]] = [order[to], order[from]];
  return order;
}

/**
 * The list in the order a drag left `order` (files): a photo the order does
 * not name, one that landed while it was dragged, keeps its place after them.
 */
export function reorderPhotos<P extends ListedPhoto>(photos: readonly P[], order: readonly string[]): P[] {
  const bySrc = new Map(photos.map((p) => [p.src, p]));
  const placed = order.flatMap((src) => bySrc.get(src) ?? []);
  return [...placed, ...photos.filter((p) => !order.includes(p.src))];
}

/** The list without the photo `src`. */
export function removePhoto<P extends ListedPhoto>(photos: readonly P[], src: string): P[] {
  return photos.filter((p) => p.src !== src);
}
