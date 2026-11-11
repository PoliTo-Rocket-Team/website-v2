// A photo stored once with a crop per shape (epic #964, issue #969; Owner
// decision on grill #966, R1.2). Each place a photo is shown at several
// shapes names those shapes here, and a stored photo may carry `crops`: for
// each shape the editor framed, the part of the photo that shape shows, in
// fractions of the photo. A shape with no crop is shown centred, as every
// photo was before crops, so a photo stored without them looks as it did.
//
// The public pages draw a photo through these helpers. A box of a shape's
// own aspect ("exact") shows that shape's crop exactly. A box near a shape's
// aspect whose size moves with the page ("framed", such as a project's photo
// panel or an outreach card) shows that shape's crop at its zoom: the crop
// covers the box, centred, so the box shows the crop and, where the box's
// aspect differs, a little of the photo around it. A box whose aspect moves
// freely ("fluid", the landing card) keeps the photo covering it, as before
// crops, and moves it so the crop's centre sits as near the box's centre as
// the photo allows. Pure data and math, shared by the dashboard and the
// public pages.

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

/** The Team page group photo (components/about/core-members.tsx, issue #971): its box is 350:210 on phones and 1312:520 from md. */
export const GROUP_PHOTO = { phone: { width: 350, height: 210 }, desktop: { width: 1312, height: 520 } } as const satisfies PhotoPlace<string>;
export type GroupPhotoShape = keyof typeof GROUP_PHOTO;

/** The crops an outreach post photo may carry. */
export type PostPhotoCrops = ShapeCrops<PostPhotoShape>;
/** The crops a gallery photo may carry. */
export type GalleryPhotoCrops = ShapeCrops<GalleryPhotoShape>;
/** The crops a launch's cover photo may carry. */
export type LaunchPhotoCrops = ShapeCrops<LaunchPhotoShape>;
/** The crops a project page's photo may carry. */
export type ProjectPhotoCrops = ShapeCrops<ProjectPhotoShape>;
/** The crops the Team page group photo may carry. */
export type GroupPhotoCrops = ShapeCrops<GroupPhotoShape>;

/** A new photo's `crops` key as it is kept: absent when the editor framed no shape, so it reads as a photo with none. */
export function cropsKey<N extends string>(crops: ShapeCrops<N>): { readonly crops?: ShapeCrops<N> } {
  return Object.keys(crops).length > 0 ? { crops } : {};
}

/**
 * A stored photo with new crops and nothing else changed (issue #975): its
 * file, its words and its place in a list stay as they are, and with no shape
 * framed it has no `crops` key, as a photo stored before crops.
 */
export function withCrops<N extends string, P extends { readonly crops?: ShapeCrops<N> }>(photo: P, crops: ShapeCrops<N>): P {
  const { crops: _old, ...rest } = photo;
  return { ...rest, ...cropsKey(crops) } as P;
}

/** Whether two photos' crops frame every shape the same; none and an empty map are the same, a photo with no crop. */
export function sameCrops<N extends string>(a: ShapeCrops<N> | undefined, b: ShapeCrops<N> | undefined): boolean {
  const names = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]) as Set<N>;
  return [...names].every((name) => {
    const [p, q] = [a?.[name], b?.[name]];
    return p !== undefined && q !== undefined && p.x === q.x && p.y === q.y && p.width === q.width && p.height === q.height;
  });
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

/**
 * A box a photo fills, and the shape whose crop it shows. "exact": the box
 * is the shape's own aspect. "framed": its aspect is near the shape's, and
 * the crop's zoom holds. "fluid": its aspect moves freely, and only the
 * crop's centre holds.
 */
export type BoxFit<N extends string> = { readonly shape: N; readonly box: "exact" | "framed" | "fluid" };

/**
 * How a photo sits in a box. "crop": the crop fills the box exactly.
 * "cover": the crop covers the box, centred in it as far as the photo
 * allows. "centre": the photo covers the box, its point (`x`, `y`, in
 * fractions of the photo) as near the box's centre as the photo allows.
 * `aspect` is the photo's own, width over height.
 */
export type Placement =
  | { readonly kind: "crop"; readonly crop: ShapeCrop }
  | { readonly kind: "cover"; readonly crop: ShapeCrop; readonly aspect: number }
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
  const aspect = photoAspectOf(place[any.name], any.crop);
  if (own === undefined) return { kind: "centre", x: 0.5, y: 0.5, aspect };
  switch (fit.box) {
    case "exact":
      return { kind: "crop", crop: own };
    case "framed":
      return { kind: "cover", crop: own, aspect };
    case "fluid":
      return { kind: "centre", x: own.x + own.width / 2, y: own.y + own.height / 2, aspect };
  }
}

/**
 * A placement that covers its box, as one zoom over the photo: the photo is
 * drawn at least `zoomX` box widths wide and `zoomY` box heights high, at
 * its own `aspect`, its point (`x`, `y`) as near the box's centre as it
 * allows. A crop's zoom is the inverse of its size; a centred photo's is 1.
 */
type Cover = { readonly aspect: number; readonly zoomX: number; readonly zoomY: number; readonly x: number; readonly y: number };

function coverOf(placement: Exclude<Placement, { kind: "crop" }>): Cover {
  if (placement.kind === "centre") return { aspect: placement.aspect, zoomX: 1, zoomY: 1, x: placement.x, y: placement.y };
  const { crop, aspect } = placement;
  return { aspect, zoomX: 1 / crop.width, zoomY: 1 / crop.height, x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
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
  const cover = coverOf(placement);
  const width = Math.max(box.width * cover.zoomX, box.height * cover.zoomY * cover.aspect);
  const height = width / cover.aspect;
  return {
    left: clamp(box.width / 2 - cover.x * width, box.width - width, 0),
    top: clamp(box.height / 2 - cover.y * height, box.height - height, 0),
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
  const cover = coverOf(placement);
  const width = `max(${n(100 * cover.zoomX)}cqw, ${n(100 * cover.zoomY * cover.aspect)}cqh)`;
  const height = `max(${n((100 * cover.zoomX) / cover.aspect)}cqw, ${n(100 * cover.zoomY)}cqh)`;
  return {
    left: `clamp(calc(100cqw - ${width}), calc(50cqw - ${n(cover.x)} * ${width}), 0px)`,
    top: `clamp(calc(100cqh - ${height}), calc(50cqh - ${n(cover.y)} * ${height}), 0px)`,
    width,
    height,
  };
}
