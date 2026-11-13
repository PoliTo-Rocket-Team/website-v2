import { isPhotoSrc } from "@/lib/outreach-photos";
import type { PhotoSrc } from "@/lib/outreach-types";
import { readShapeCrops, type PhotoPlace, type ShapeCrops } from "@/lib/photo-crops";

// A project's uploaded photo as the Edit <project> panel sends it and a save
// keeps it (issue #970): the top's photo panel, a Photo block and a launch's
// cover. Each is stored once in the page record, and may carry its crop for
// each shape its place shows it at (lib/photo-crops.ts). The crops come back
// as sent; a photo with none reads as before crops, and is shown centred.

/** A project photo: its file, what it shows, and its crop for each shape its place framed. */
export type StoredPhoto<N extends string> = { readonly src: PhotoSrc; readonly alt: string; readonly crops?: ShapeCrops<N> };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A photo a request carries for `place`, or null when it is not one: a project's file, a description, and crops of `place`'s shapes or none. */
export function readPhotoIn<N extends string>(v: unknown, place: PhotoPlace<N>): StoredPhoto<N> | null {
  if (!isObject(v) || !isPhotoSrc(v.src) || typeof v.alt !== "string") return null;
  const crops = readShapeCrops(v.crops, place);
  if (crops === null) return null;
  return { src: v.src, alt: v.alt, ...(crops !== undefined && { crops }) };
}

/** The photo as a save keeps it: its description trimmed, its crops as they are. */
export function storedPhotoOf<N extends string>(photo: StoredPhoto<N>): StoredPhoto<N> {
  return { src: photo.src, alt: photo.alt.trim(), ...(photo.crops !== undefined && { crops: photo.crops }) };
}
