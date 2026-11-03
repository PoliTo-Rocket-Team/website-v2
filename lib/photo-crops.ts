// A photo stored once with a crop per shape (epic #964, issue #969; Owner
// decision on grill #966, R1.2). Each place a photo is shown at several
// shapes names those shapes here, and a stored photo may carry `crops`: for
// each shape the editor framed, the part of the photo that shape shows, in
// fractions of the photo. A shape with no crop is shown centred, as every
// photo was before crops, so a photo stored without them looks as it did.
//
// The public pages draw a photo through these helpers. A box of a shape's
// own aspect ("exact") shows that shape's crop exactly. A box whose aspect
// moves with the page ("fluid", such as the landing card) keeps the photo
// covering it, as today, and moves it so the crop's centre sits as near the
// box's centre as the photo allows. Pure data and math, shared by the
// dashboard and the public pages.

/** A width and height in pixels, or the two sides of an aspect. */
export type Size = { readonly width: number; readonly height: number };

/** A shape's crop in fractions of the photo (0 to 1), its aspect the shape's. */
export type ShapeCrop = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** A photo's crops: a shape left unset has none, and shows centred. */
export type ShapeCrops<N extends string = string> = { readonly [name in N]?: ShapeCrop };

/** Where a photo is shown: each shape's name and aspect. */
export type PhotoPlace<N extends string> = { readonly [name in N]: Size };

/** An outreach post photo (components/outreach/post.tsx): the top photo is 3:2 on phones and 9:5 from md. */
export const POST_PHOTO = { phone: { width: 3, height: 2 }, desktop: { width: 9, height: 5 } } as const satisfies PhotoPlace<string>;
export type PostPhotoShape = keyof typeof POST_PHOTO;

/** A gallery photo (components/gallery/gallery.tsx): the carousel's current photo is 300:220 on phones and 760:480 from md. */
export const GALLERY_PHOTO = { phone: { width: 300, height: 220 }, desktop: { width: 760, height: 480 } } as const satisfies PhotoPlace<string>;
export type GalleryPhotoShape = keyof typeof GALLERY_PHOTO;

/** A launch's cover photo (components/project-page/launches.tsx, issue #970): the phone card's top strip is 326 x 112 at 390 wide, and the slot beside a launch is 300 x 180 from lg. */
export const LAUNCH_PHOTO = { phone: { width: 326, height: 112 }, desktop: { width: 5, height: 3 } } as const satisfies PhotoPlace<string>;
export type LaunchPhotoShape = keyof typeof LAUNCH_PHOTO;

/**
 * A project page's photo (issue #970): a Photo block (components/project-page/photo.tsx)
 * and the top's photo panel (components/project-page/hero.tsx) share one box,
 * 220 px high on phones (350 x 220 at 390 wide) and 620 px from md (1312 x 620 at 1440).
 */
export const PROJECT_PHOTO = { phone: { width: 350, height: 220 }, desktop: { width: 1312, height: 620 } } as const satisfies PhotoPlace<string>;
export type ProjectPhotoShape = keyof typeof PROJECT_PHOTO;

/** The crops an outreach post photo may carry. */
export type PostPhotoCrops = ShapeCrops<PostPhotoShape>;
/** The crops a gallery photo may carry. */
export type GalleryPhotoCrops = ShapeCrops<GalleryPhotoShape>;
/** The crops a launch's cover photo may carry. */
export type LaunchPhotoCrops = ShapeCrops<LaunchPhotoShape>;
/** The crops a project page's photo may carry. */
export type ProjectPhotoCrops = ShapeCrops<ProjectPhotoShape>;

/** A new photo's `crops` key as it is kept: absent when the editor framed no shape, so it reads as a photo with none. */
export function cropsKey<N extends string>(crops: ShapeCrops<N>): { readonly crops?: ShapeCrops<N> } {
  return Object.keys(crops).length > 0 ? { crops } : {};
}

const isFraction = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

/** How far a stored edge may pass 1 by rounding alone. */
const EDGE_SLACK = 1e-6;

function shapeCropOf(v: unknown): ShapeCrop | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { x, y, width, height } = v as Record<string, unknown>;
  if (!isFraction(x) || !isFraction(y) || !isFraction(width) || !isFraction(height)) return null;
  if (width === 0 || height === 0 || x + width > 1 + EDGE_SLACK || y + height > 1 + EDGE_SLACK) return null;
  return { x, y, width, height };
}

/**
 * A stored photo's `crops` read back: undefined when it has none (a photo
 * saved before crops, or by an older deploy), null when it is not a crops map
 * of `place`'s shapes, each a rectangle inside the photo.
 */
export function readShapeCrops<N extends string>(value: unknown, place: PhotoPlace<N>): ShapeCrops<N> | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const crops: { [name in N]?: ShapeCrop } = {};
  for (const [name, v] of Object.entries(value)) {
    if (!Object.hasOwn(place, name)) return null;
    const crop = shapeCropOf(v);
    if (crop === null) return null;
    crops[name as N] = crop;
  }
  return crops;
}

/** The photo's own aspect (width over height), as a crop and its shape tell it. */
export function photoAspectOf(shape: Size, crop: ShapeCrop): number {
  return ((shape.width / shape.height) * crop.height) / crop.width;
}

/** A box a photo fills: of `shape`'s own aspect, or one whose aspect moves with the page. */
export type BoxFit<N extends string> = { readonly shape: N; readonly box: "exact" | "fluid" };

/**
 * How a photo sits in a box. "crop": the crop fills the box exactly.
 * "centre": the photo covers the box, its point (`x`, `y`, in fractions of
 * the photo) as near the box's centre as the photo allows; `aspect` is the
 * photo's own, width over height.
 */
export type Placement =
  | { readonly kind: "crop"; readonly crop: ShapeCrop }
  | { readonly kind: "centre"; readonly x: number; readonly y: number; readonly aspect: number };

/**
 * How a photo with `crops` sits in a box of `fit`: null when it has no crop
 * at all, which is today's centred cover. A shape left unset is centred.
 */
export function placementOf<N extends string>(place: PhotoPlace<N>, crops: ShapeCrops<NoInfer<N>> | undefined, fit: BoxFit<NoInfer<N>>): Placement | null {
  if (crops === undefined) return null;
  const set = (Object.keys(place) as N[]).flatMap((name) => {
    const crop = crops[name];
    return crop === undefined ? [] : [{ name, crop }];
  });
  const [any] = set;
  if (any === undefined) return null;
  const own = crops[fit.shape];
  if (own !== undefined && fit.box === "exact") return { kind: "crop", crop: own };
  const aspect = photoAspectOf(place[any.name], any.crop);
  return own === undefined ? { kind: "centre", x: 0.5, y: 0.5, aspect } : { kind: "centre", x: own.x + own.width / 2, y: own.y + own.height / 2, aspect };
}

/** Where the photo lies from the box's top left, and its size, in the box's pixels. */
export type PlacedRect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A placement in a box of `box` pixels: what `placementStyle` draws there. */
export function placedRect(placement: Placement, box: Size): PlacedRect {
  if (placement.kind === "crop") {
    const { x, y, width: w, height: h } = placement.crop;
    return { left: (-box.width * x) / w, top: (-box.height * y) / h, width: box.width / w, height: box.height / h };
  }
  const width = Math.max(box.width, box.height * placement.aspect);
  const height = width / placement.aspect;
  return {
    left: clamp(box.width / 2 - placement.x * width, box.width - width, 0),
    top: clamp(box.height / 2 - placement.y * height, box.height - height, 0),
    width,
    height,
  };
}

/** A placement's left, top, width and height as CSS lengths. */
export type PlacementStyle = { readonly left: string; readonly top: string; readonly width: string; readonly height: string };

const n = (value: number) => String(Number(value.toFixed(5)));

/**
 * `placedRect` as CSS, in the units of the box it is drawn in: the box is a
 * size container, so 100cqw and 100cqh are its width and height, whatever
 * they are on the page.
 */
export function placementStyle(placement: Placement): PlacementStyle {
  if (placement.kind === "crop") {
    const { x, y, width: w, height: h } = placement.crop;
    return { left: `${n((-100 * x) / w)}cqw`, top: `${n((-100 * y) / h)}cqh`, width: `${n(100 / w)}cqw`, height: `${n(100 / h)}cqh` };
  }
  const width = `max(100cqw, ${n(100 * placement.aspect)}cqh)`;
  const height = `max(${n(100 / placement.aspect)}cqw, 100cqh)`;
  return {
    left: `clamp(calc(100cqw - ${width}), calc(50cqw - ${n(placement.x)} * ${width}), 0px)`,
    top: `clamp(calc(100cqh - ${height}), calc(50cqh - ${n(placement.y)} * ${height}), 0px)`,
    width,
    height,
  };
}
