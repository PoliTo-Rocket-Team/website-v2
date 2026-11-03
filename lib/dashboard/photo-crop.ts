// The crop dialog's math (components/dashboard/crop-dialog.tsx). A square
// photo's crop (board 55a, issue #169) is a square box over the photo, which
// the person drags and zooms; a project background's (board 93f, issue #529)
// is the same with a frame of any shape, Tall 9:16 or Wide 2:1. The frame
// stays still and the photo moves under it, so the crop always has the
// frame's shape and always lies inside the photo. Pure math, in the frame's
// own pixels; the dialog draws it and cuts the saved picture from
// `sourceRect` (`sourceSquare` for the square). A partner logo's free frame
// (issue #971) is the other way round, below.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/** The photo under a frame: its natural size, the frame's size on screen, the zoom, and where the photo's top left sits from the frame's top left. */
export type FrameCrop = {
  readonly width: number;
  readonly height: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
};

/** The photo under a square box: a frame whose sides are both `box`. */
export type Crop = {
  readonly width: number;
  readonly height: number;
  /** The crop box's side on screen. */
  readonly box: number;
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
};

const frameOf = ({ box, ...rest }: Crop): FrameCrop => ({ ...rest, frameWidth: box, frameHeight: box });
const boxOf = (c: FrameCrop): Crop => ({ width: c.width, height: c.height, box: c.frameWidth, zoom: c.zoom, x: c.x, y: c.y });

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Screen pixels per photo pixel: at zoom 1 the photo just covers the frame. */
export function frameScaleOf(crop: Pick<FrameCrop, "width" | "height" | "frameWidth" | "frameHeight" | "zoom">): number {
  return Math.max(crop.frameWidth / crop.width, crop.frameHeight / crop.height) * crop.zoom;
}

/** The same crop with the photo moved back to cover the frame wherever it was pulled past an edge. */
export function clampFrameCrop(crop: FrameCrop): FrameCrop {
  const zoom = clamp(crop.zoom, ZOOM_MIN, ZOOM_MAX);
  const scale = frameScaleOf({ ...crop, zoom });
  return {
    ...crop,
    zoom,
    x: clamp(crop.x, crop.frameWidth - crop.width * scale, 0),
    y: clamp(crop.y, crop.frameHeight - crop.height * scale, 0),
  };
}

/** A new photo, centred under the frame at zoom 1. */
export function centredFrameCrop(width: number, height: number, frameWidth: number, frameHeight: number): FrameCrop {
  const scale = frameScaleOf({ width, height, frameWidth, frameHeight, zoom: 1 });
  return clampFrameCrop({ width, height, frameWidth, frameHeight, zoom: 1, x: (frameWidth - width * scale) / 2, y: (frameHeight - height * scale) / 2 });
}

/** Drag: the photo follows the pointer by (dx, dy) screen pixels. */
export function moveFrameCrop(crop: FrameCrop, dx: number, dy: number): FrameCrop {
  return clampFrameCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

/** Zoom about the frame's centre, so what sits in the middle stays in the middle. */
export function zoomFrameCrop(crop: FrameCrop, zoom: number): FrameCrop {
  const before = frameScaleOf(crop);
  const after = frameScaleOf({ ...crop, zoom: clamp(zoom, ZOOM_MIN, ZOOM_MAX) });
  const cx = crop.frameWidth / 2;
  const cy = crop.frameHeight / 2;
  const ratio = after / before;
  return clampFrameCrop({ ...crop, zoom, x: cx - (cx - crop.x) * ratio, y: cy - (cy - crop.y) * ratio });
}

/** The part of the photo the frame shows, in the photo's own pixels: what the saved picture is cut from. */
export function sourceRect(crop: FrameCrop): { readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number } {
  const scale = frameScaleOf(crop);
  const sw = Math.min(crop.frameWidth / scale, crop.width);
  const sh = Math.min(crop.frameHeight / scale, crop.height);
  return { sx: clamp(-crop.x / scale, 0, crop.width - sw), sy: clamp(-crop.y / scale, 0, crop.height - sh), sw, sh };
}

/** Screen pixels per photo pixel: at zoom 1 the photo's short side fills the box. */
export function scaleOf(crop: Pick<Crop, "width" | "height" | "box" | "zoom">): number {
  return frameScaleOf({ width: crop.width, height: crop.height, frameWidth: crop.box, frameHeight: crop.box, zoom: crop.zoom });
}

/** The same crop with the photo moved back to cover the box wherever it was pulled past an edge. */
export function clampCrop(crop: Crop): Crop {
  return boxOf(clampFrameCrop(frameOf(crop)));
}

/** A new photo, centred under the box at zoom 1. */
export function centredCrop(width: number, height: number, box: number): Crop {
  return boxOf(centredFrameCrop(width, height, box, box));
}

/** Drag: the photo follows the pointer by (dx, dy) screen pixels. */
export function moveCrop(crop: Crop, dx: number, dy: number): Crop {
  return boxOf(moveFrameCrop(frameOf(crop), dx, dy));
}

/** Zoom about the box's centre, so the face in the middle stays in the middle. */
export function zoomCrop(crop: Crop, zoom: number): Crop {
  return boxOf(zoomFrameCrop(frameOf(crop), zoom));
}

/** The square of the photo the box shows, in the photo's own pixels: what the saved photo is cut from. */
export function sourceSquare(crop: Crop): { readonly sx: number; readonly sy: number; readonly side: number } {
  const { sx, sy, sw } = sourceRect(frameOf(crop));
  return { sx, sy, side: sw };
}

/** The largest frame of `aspect` that fits in `room`, in whole pixels. */
export function frameIn(aspect: { readonly width: number; readonly height: number }, room: { readonly width: number; readonly height: number }): { readonly width: number; readonly height: number } {
  const scale = Math.min(room.width / aspect.width, room.height / aspect.height);
  return { width: Math.round(aspect.width * scale), height: Math.round(aspect.height * scale) };
}

// A free frame (issue #971): a partner logo keeps whatever shape the editor
// draws. The photo is shown whole and still; the frame moves and resizes over
// it by its edges and corners, and always lies inside the photo. Its
// rectangle is kept in the photo's own pixels, so it is the saved picture's
// source rectangle as it stands.

/** The smallest side a free frame keeps, in the photo's pixels; a smaller photo's own side. */
export const FREE_MIN_SIDE = 16;

/** A free frame over a photo: the photo's natural size and the part of it the frame holds, in its pixels. */
export type FreeCrop = {
  readonly width: number;
  readonly height: number;
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
};

/** An edge or corner of a free frame the editor drags to resize it. */
export type FreeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

export const FREE_HANDLES: readonly FreeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** A new photo's free frame: the whole photo, so a logo confirmed as it opens is kept whole. */
export function wholeFreeCrop(width: number, height: number): FreeCrop {
  return { width, height, sx: 0, sy: 0, sw: width, sh: height };
}

/** Drag inside the frame: it follows the pointer by (dx, dy) photo pixels and stops at the photo's edges. */
export function moveFreeCrop(crop: FreeCrop, dx: number, dy: number): FreeCrop {
  return { ...crop, sx: clamp(crop.sx + dx, 0, crop.width - crop.sw), sy: clamp(crop.sy + dy, 0, crop.height - crop.sh) };
}

/**
 * Drag a handle by (dx, dy) photo pixels: each edge the handle holds follows
 * the pointer, never past the photo's edge and never closer to the opposite
 * edge than `FREE_MIN_SIDE`. The edges it does not hold stay where they are.
 */
export function resizeFreeCrop(crop: FreeCrop, handle: FreeHandle, dx: number, dy: number): FreeCrop {
  const minW = Math.min(FREE_MIN_SIDE, crop.width);
  const minH = Math.min(FREE_MIN_SIDE, crop.height);
  let left = crop.sx;
  let top = crop.sy;
  let right = crop.sx + crop.sw;
  let bottom = crop.sy + crop.sh;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - minW);
  if (handle.includes("e")) right = clamp(right + dx, left + minW, crop.width);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - minH);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + minH, crop.height);
  return { ...crop, sx: left, sy: top, sw: right - left, sh: bottom - top };
}

/** The part of the photo a free frame holds, in whole pixels inside the photo: what the saved picture is cut from. */
export function freeSourceRect(crop: FreeCrop): { readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number } {
  const sx = clamp(Math.round(crop.sx), 0, crop.width - 1);
  const sy = clamp(Math.round(crop.sy), 0, crop.height - 1);
  const right = clamp(Math.round(crop.sx + crop.sw), sx + 1, crop.width);
  const bottom = clamp(Math.round(crop.sy + crop.sh), sy + 1, crop.height);
  return { sx, sy, sw: right - sx, sh: bottom - sy };
}
