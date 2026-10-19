import { refused, written, type WriteResult } from "@/lib/dashboard/write";

// A gallery as an editor's panel types it: the Gallery section of the Edit
// <project> panel (board 75c, issue #299) and of the Edit post panel (issue
// #430), which share one editor (GalleryEditor in
// components/dashboard/project-list-sections.tsx). It has a show-on-page
// switch, a title and its photos in carousel order. The rule both keep: a
// gallery on the page has a title and one photo at least. A photo's
// description and caption are optional.

/** One slot of the carousel: an uploaded photo, or a placeholder (`src` null) until one is uploaded. */
export type GalleryItemFields = { readonly src: string | null; readonly alt: string; readonly caption: string };

/** The gallery with its show-on-page switch. Switched off, it leaves the page and its fields stay. */
export type GalleryFields = {
  readonly shown: boolean;
  readonly title: string;
  readonly items: readonly GalleryItemFields[];
};

/** The most photos a gallery holds. */
export const GALLERY_MAX = 50;

export const GALLERY_KEEPS_A_PHOTO = "A gallery on the page keeps one photo at least. Switch Gallery off to take it off the page.";

/** A gallery with nothing in it, switched off. */
export const NO_GALLERY: GalleryFields = { shown: false, title: "", items: [] };

/** A removed photo: the gallery without it, and its uploaded file, which the panel lets go. */
export type GalleryRemoval = { readonly fields: GalleryFields; readonly letGo: readonly string[] };

/** Removes a photo, or refuses: a gallery on the page keeps one. Its uploaded file is let go. */
export function removeGalleryItem(fields: GalleryFields, index: number): WriteResult<GalleryRemoval> {
  if (fields.shown && fields.items.length <= 1) return refused(GALLERY_KEEPS_A_PHOTO);
  const src = fields.items[index]?.src ?? null;
  return written({ fields: { ...fields, items: fields.items.filter((_, i) => i !== index) }, letGo: src === null ? [] : [src] });
}

/** One field of a gallery that cannot be saved as it is, keyed as the editor's errors are ("gallery.title"). */
export type GalleryProblem = { readonly field: "gallery.title" | "gallery.items"; readonly error: string };

/** What a save needs first in the gallery. A gallery switched off never stops a save. */
export function galleryProblems(fields: GalleryFields): GalleryProblem[] {
  if (!fields.shown) return [];
  return [
    ...(fields.title.trim() === "" ? [{ field: "gallery.title" as const, error: "Fill in the gallery title." }] : []),
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
  if (!isObject(v) || typeof v.shown !== "boolean" || !isString(v.title)) return null;
  if (!Array.isArray(v.items) || v.items.length > GALLERY_MAX) return null;
  const items = v.items.map(readGalleryItem);
  if (!items.every((item) => item !== null)) return null;
  return { shown: v.shown, title: v.title, items: items as GalleryItemFields[] };
}
