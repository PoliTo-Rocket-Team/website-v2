import { refused, written, type WriteResult } from "@/lib/dashboard/write";

// A gallery as an editor's panel types it: a Gallery block of the Edit
// <project> panel (board 93, epic #522) and the Gallery section of the Edit
// post panel (issue #430), which share one photo list (GalleryPhotosEditor in
// components/dashboard/project-list-sections.tsx). A project's gallery has a
// title and its photos in carousel order, and keeps one photo at least; a
// slot with no photo yet is a placeholder. A photo's description and caption
// are optional.

/** One slot of the carousel: an uploaded photo, or a placeholder (`src` null) until one is uploaded. */
export type GalleryItemFields = { readonly src: string | null; readonly alt: string; readonly caption: string };

/** A project's gallery block as the panel types it. */
export type GalleryFields = {
  readonly title: string;
  readonly items: readonly GalleryItemFields[];
};

/** The most photos a gallery holds. */
export const GALLERY_MAX = 50;

export const GALLERY_KEEPS_A_PHOTO = "A gallery keeps one photo at least. Remove the block to take it off the page.";

/** A new gallery block: one empty slot, which the page draws as a placeholder until a photo is uploaded. */
export const blankGallery = (): GalleryFields => ({ title: "", items: [{ src: null, alt: "", caption: "" }] });

/** A removed photo: the gallery without it, and its uploaded file, which the panel lets go. */
export type GalleryRemoval = { readonly fields: GalleryFields; readonly letGo: readonly string[] };

/** Removes a photo, or refuses: a gallery keeps one. Its uploaded file is let go. */
export function removeGalleryItem(fields: GalleryFields, index: number): WriteResult<GalleryRemoval> {
  if (fields.items.length <= 1) return refused(GALLERY_KEEPS_A_PHOTO);
  const src = fields.items[index]?.src ?? null;
  return written({ fields: { ...fields, items: fields.items.filter((_, i) => i !== index) }, letGo: src === null ? [] : [src] });
}

/** One field of a gallery that cannot be saved as it is, keyed as the editor's errors are ("gallery.title"). */
export type GalleryProblem = { readonly field: "gallery.title" | "gallery.items"; readonly error: string };

/**
 * What a save needs first in the gallery. A gallery always keeps a photo; its
 * title needs filling in only while it is on the page (`shown`).
 */
export function galleryProblems(fields: GalleryFields, shown: boolean): GalleryProblem[] {
  return [
    ...(shown && fields.title.trim() === "" ? [{ field: "gallery.title" as const, error: "Fill in the gallery title." }] : []),
    ...(fields.items.length === 0 ? [{ field: "gallery.items" as const, error: GALLERY_KEEPS_A_PHOTO }] : []),
  ];
}

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";

function readGalleryItem(v: unknown): GalleryItemFields | null {
  if (!isObject(v) || !isString(v.alt) || !isString(v.caption) || !(v.src === null || isString(v.src))) return null;
  return { src: v.src, alt: v.alt, caption: v.caption };
}

/** The gallery a request carries, or null when it does not carry one in this shape. Whose files its photos are, a save checks. */
export function readGalleryFields(v: unknown): GalleryFields | null {
  if (!isObject(v) || !isString(v.title)) return null;
  if (!Array.isArray(v.items) || v.items.length > GALLERY_MAX) return null;
  const items = v.items.map(readGalleryItem);
  if (!items.every((item) => item !== null)) return null;
  return { title: v.title, items: items as GalleryItemFields[] };
}
