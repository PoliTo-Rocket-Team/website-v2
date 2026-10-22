// The crop dialogs' math. My profile's (board 55a, issue #169) is a square
// crop box over the photo, which the person drags and zooms; a project
// background's (board 93f, issue #529) is the same with a frame of any shape,
// Tall 9:16 or Wide 2:1. The frame stays still and the photo moves under it,
// so the crop always has the frame's shape and always lies inside the photo.
// Pure math, in the frame's own pixels; the dialogs draw it and cut the saved
// picture from `sourceRect` (`sourceSquare` for the square).

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
