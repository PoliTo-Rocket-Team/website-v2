// What each dashboard image place crops to (epic #964, issue #968). Every
// place that takes an image opens the one crop dialog
// (components/dashboard/crop-dialog.tsx), and how that dialog behaves there is
// the place's entry below, never a choice inside a component.
//
// An entry is one of two kinds. "cut" cuts each frame to its own file, as
// square photos and project backgrounds are. "crops" stores the photo once and
// keeps, per named shape, a crop rectangle in fractions of the photo; a shape
// with no crop is shown centred. The types make three entries unwritable: one
// with no shape, a free frame with JPEG output (a free frame is for a PNG logo
// whose transparency must survive), and a "crops" entry with a free shape (a
// stored crop always has its shape's aspect).

import { BACKGROUND_CROP_MAX_BYTES, BACKGROUND_FRAMES } from "@/lib/project-content/record";
import { PHOTO_MAX_BYTES } from "@/lib/outreach-photos";
import { MAX_MEMBER_PHOTO_BYTES } from "./division-members";
import { GALLERY_PHOTO, LAUNCH_PHOTO, POST_PHOTO, type ShapeCrop, type ShapeCrops, type Size } from "@/lib/photo-crops";
import { sourceRect, type FrameCrop } from "./photo-crop";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "./self";

export type { ShapeCrop, ShapeCrops, Size };

/** At least one. */
export type NonEmpty<T> = readonly [T, ...T[]];

/** A shape of a fixed aspect. `name` keys its file or its crop; `label` and `use` are what the dialog writes over its frame. */
export type FixedShape<N extends string = string> = {
  readonly kind: "fixed";
  readonly name: N;
  readonly label: string;
  readonly use: string;
  readonly aspect: Size;
};

/** A fixed shape cut to its own file: at most `size` pixels, never larger than the photo gives. */
export type CutShape<N extends string = string> = FixedShape<N> & { readonly size: Size };

/** A frame the editor draws to any aspect, its file's long side at most `maxSide` pixels. */
export type FreeShape<N extends string = string> = {
  readonly kind: "free";
  readonly name: N;
  readonly label: string;
  readonly use: string;
  readonly maxSide: number;
};

export type JpegOutput = { readonly type: "image/jpeg"; readonly quality: number };
/** A PNG kept as a PNG, its transparency with it. */
export type PngOutput = { readonly type: "image/png" };
export type CropOutput = JpegOutput | PngOutput;

/** What the dialog says: its title, the confirm button, and the optional line under the title and note above the buttons. */
export type CropWords = {
  readonly title: string;
  readonly confirm: string;
  readonly description?: string;
  readonly note?: string;
};

/** A round preview of the result at a size the site shows it, beside a one-shape crop. */
export type CropPreview = { readonly caption: string; readonly size: number };

type EntryBase = {
  readonly words: CropWords;
  /** The file types the input takes. */
  readonly accept: readonly string[];
  /** The largest file the place's server action takes; every output stays under it. */
  readonly maxBytes: number;
  readonly previews?: readonly CropPreview[];
};

/** Each frame cut to its own file. Only a PNG entry may carry a free frame. */
export type CutEntry<N extends string = string> = EntryBase & { readonly kind: "cut" } & (
    | { readonly output: JpegOutput; readonly shapes: NonEmpty<CutShape<N>> }
    | { readonly output: PngOutput; readonly shapes: NonEmpty<CutShape<N> | FreeShape<N>> }
  );

/** The photo stored once, with a crop per fixed shape; its long side at most `maxSide` pixels. */
export type CropsEntry<N extends string = string> = EntryBase & {
  readonly kind: "crops";
  readonly output: CropOutput;
  readonly maxSide: number;
  readonly shapes: NonEmpty<FixedShape<N>>;
};

export type CropEntry<N extends string = string> = CutEntry<N> | CropsEntry<N>;

/** What the dialog hands back: a file per frame, or the photo and its crops. */
export type CropResult<E extends CropEntry> =
  E extends CutEntry<infer N> ? { readonly kind: "cut"; readonly files: { readonly [name in N]: File } }
  : E extends CropsEntry<infer N> ? { readonly kind: "crops"; readonly file: File; readonly crops: ShapeCrops<N> }
  : never;

/** The shape names an entry's shapes carry. */
export type ShapeName<E extends CropEntry> = E["shapes"][number]["name"];

/** An entry whose shapes are all fixed: what the dialog draws until a later slice adds the free frame's stage. */
export type FixedEntry = CropEntry & { readonly shapes: NonEmpty<FixedShape> };

/** One frame's cut: the part of the photo it shows (`sx`, `sy`, `sw`, `sh`, in the photo's pixels) and the file's size. */
export type Cut = { readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number; readonly width: number; readonly height: number };

/** The file a cut shape's frame makes: its preset size, or the photo's own pixels when they are fewer, keeping the shape's aspect. */
export function cutOf(shape: CutShape, crop: FrameCrop): Cut {
  const rect = sourceRect(crop);
  const width = Math.round(Math.min(rect.sw, shape.size.width));
  return { ...rect, width, height: Math.round((width * shape.size.height) / shape.size.width) };
}

/** A frame's crop in fractions of the photo, as a "crops" entry stores it. */
export function shapeCropOf(crop: FrameCrop): ShapeCrop {
  const { sx, sy, sw, sh } = sourceRect(crop);
  return { x: sx / crop.width, y: sy / crop.height, width: sw / crop.width, height: sh / crop.height };
}

/** A "crops" entry's crops: one for each shape the editor set, none for a shape left centred. */
export function shapeCropsOf<N extends string>(frames: { readonly [name in N]?: FrameCrop }, set: ReadonlySet<N>): ShapeCrops<N> {
  const crops: { [name in N]?: ShapeCrop } = {};
  for (const name of set) {
    const frame = frames[name];
    if (frame !== undefined) crops[name] = shapeCropOf(frame);
  }
  return crops;
}

/** The square photos' side, a JPEG at 0.9, as the photo crop dialog cut them (board 55a). */
const SQUARE_SIDE = 800;
const SQUARE_QUALITY = 0.9;

const SQUARE_WORDS: CropWords = { title: "Crop your photo", confirm: "Save photo" };
const SQUARE_PREVIEWS: readonly CropPreview[] = [
  { caption: "Team page", size: 56 },
  { caption: "Dashboard", size: 28 },
];

/** A person's square photo, an 800 px JPEG under the place's server limit. */
function squarePhoto(maxBytes: number) {
  return {
    kind: "cut",
    words: SQUARE_WORDS,
    accept: PHOTO_TYPES,
    maxBytes,
    previews: SQUARE_PREVIEWS,
    output: { type: "image/jpeg", quality: SQUARE_QUALITY },
    shapes: [{ kind: "fixed", name: "square", label: "Square", use: "Photo", aspect: { width: 1, height: 1 }, size: { width: SQUARE_SIDE, height: SQUARE_SIDE } }],
  } as const satisfies CutEntry<"square">;
}

/** The entry of every square photo place: one 800 px JPEG frame. */
export type SquarePhotoEntry = ReturnType<typeof squarePhoto>;

/** The longest side a photo stored once is kept at, a JPEG at 0.86, as outreach photos were sent before crops. */
const STORED_PHOTO_SIDE = 2400;
const STORED_PHOTO_QUALITY = 0.86;

const PHOTO_ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;

/** What the dialog says over a photo stored once and shown at two shapes. */
const TWO_SHAPE_WORDS: CropWords = {
  title: "Crop your photo",
  confirm: "Use this photo",
  description: "One photo, two shapes. Drag the photo inside each frame to choose what shows. A frame you leave as it is stays centred.",
  note: "JPG, PNG or WebP. The photo is kept once, with a crop for each shape.",
};

/** The dialog's entry for each place that crops. */
export const CROP_SETTINGS = {
  /** My profile's photo (board 55a), stored by `checkedPhoto`: at most 2 MB. */
  profilePhoto: squarePhoto(MAX_PHOTO_BYTES),
  /** A member photo from Edit details (board 61g), stored by `checkedMemberPhoto`: under 500 KB. */
  memberPhoto: squarePhoto(MAX_MEMBER_PHOTO_BYTES),
  /** An Alumni entry's or added advisor's photo (issue #257), stored by `checkedPhoto`: at most 2 MB. */
  alumniPhoto: squarePhoto(MAX_PHOTO_BYTES),
  /** A Team page member's uploaded photo (issue #323), stored by `checkPhotoUpload`: at most 4 MB. */
  teamMemberPhoto: squarePhoto(PHOTO_MAX_BYTES),
  /** A project background (board 93f, issue #529): Tall and Wide, each its own JPEG at the presets' sizes, under 4 MB each. */
  projectBackground: {
    kind: "cut",
    words: {
      title: "Crop your background",
      confirm: "Use this background",
      description: "One photo, two shapes. Drag the photo inside each frame to choose what shows.",
      note: "JPG, PNG or WebP, up to 10 MB. At least 2400 px wide works best.",
    },
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: BACKGROUND_CROP_MAX_BYTES,
    output: { type: "image/jpeg", quality: 0.86 },
    shapes: [
      { kind: "fixed", name: "tall", label: "Tall", use: "Home card, phones", aspect: { width: 9, height: 16 }, size: BACKGROUND_FRAMES.tall },
      { kind: "fixed", name: "wide", label: "Wide", use: "Project page, laptops", aspect: { width: 2, height: 1 }, size: BACKGROUND_FRAMES.wide },
    ],
  },
  /** An outreach post's cover and photos (issue #969): one photo, cropped for the post page's 3:2 on phones and 9:5 from md, under 4 MB. */
  outreachPhoto: {
    kind: "crops",
    words: TWO_SHAPE_WORDS,
    accept: PHOTO_ACCEPT,
    maxBytes: PHOTO_MAX_BYTES,
    maxSide: STORED_PHOTO_SIDE,
    output: { type: "image/jpeg", quality: STORED_PHOTO_QUALITY },
    shapes: [
      { kind: "fixed", name: "phone", label: "Phones", use: "Post page", aspect: POST_PHOTO.phone },
      { kind: "fixed", name: "desktop", label: "Laptops", use: "Post page and cards", aspect: POST_PHOTO.desktop },
    ],
  },
  /** An outreach post's gallery photo (issue #969): one photo, cropped for the carousel's 300:220 on phones and 760:480 from md, under 4 MB. */
  outreachGallery: {
    kind: "crops",
    words: TWO_SHAPE_WORDS,
    accept: PHOTO_ACCEPT,
    maxBytes: PHOTO_MAX_BYTES,
    maxSide: STORED_PHOTO_SIDE,
    output: { type: "image/jpeg", quality: STORED_PHOTO_QUALITY },
    shapes: [
      { kind: "fixed", name: "phone", label: "Phones", use: "Gallery", aspect: GALLERY_PHOTO.phone },
      { kind: "fixed", name: "desktop", label: "Laptops", use: "Gallery", aspect: GALLERY_PHOTO.desktop },
    ],
  },
  /** A launch's cover photo (issue #969): one photo, cropped for its 5:3 slot beside the launch, under 4 MB. */
  launchPhoto: {
    kind: "crops",
    words: { title: "Crop your photo", confirm: "Use this photo" },
    accept: PHOTO_ACCEPT,
    maxBytes: PHOTO_MAX_BYTES,
    maxSide: STORED_PHOTO_SIDE,
    output: { type: "image/jpeg", quality: STORED_PHOTO_QUALITY },
    shapes: [{ kind: "fixed", name: "card", label: "Card", use: "Launch card", aspect: LAUNCH_PHOTO.card }],
  },
} as const satisfies Readonly<Record<string, CropEntry>>;

export type CropPlace = keyof typeof CROP_SETTINGS;
