// The crop dialog of My profile (board 55a, issue #169): a square crop box
// over the photo, which the person drags and zooms. The box stays still and
// the photo moves under it, so the crop is always square and always inside
// the photo. Pure math, in the box's own pixels; the dialog draws it and
// cuts the saved square from `sourceSquare`.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/** The photo under the box: its natural size, the zoom, and where its top left sits from the box's top left. */
export type Crop = {
  readonly width: number;
  readonly height: number;
  /** The crop box's side on screen. */
  readonly box: number;
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
};

/** Screen pixels per photo pixel: at zoom 1 the photo's short side fills the box. */
export function scaleOf(crop: Pick<Crop, "width" | "height" | "box" | "zoom">): number {
  return (crop.box / Math.min(crop.width, crop.height)) * crop.zoom;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The same crop with the photo moved back to cover the box wherever it was pulled past an edge. */
export function clampCrop(crop: Crop): Crop {
  const zoom = clamp(crop.zoom, ZOOM_MIN, ZOOM_MAX);
  const scale = scaleOf({ ...crop, zoom });
  return {
    ...crop,
    zoom,
    x: clamp(crop.x, crop.box - crop.width * scale, 0),
    y: clamp(crop.y, crop.box - crop.height * scale, 0),
  };
}

/** A new photo, centred under the box at zoom 1. */
export function centredCrop(width: number, height: number, box: number): Crop {
  const scale = scaleOf({ width, height, box, zoom: 1 });
  return clampCrop({ width, height, box, zoom: 1, x: (box - width * scale) / 2, y: (box - height * scale) / 2 });
}

/** Drag: the photo follows the pointer by (dx, dy) screen pixels. */
export function moveCrop(crop: Crop, dx: number, dy: number): Crop {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

/** Zoom about the box's centre, so the face in the middle stays in the middle. */
export function zoomCrop(crop: Crop, zoom: number): Crop {
  const before = scaleOf(crop);
  const after = scaleOf({ ...crop, zoom: clamp(zoom, ZOOM_MIN, ZOOM_MAX) });
  const centre = crop.box / 2;
  const ratio = after / before;
  return clampCrop({ ...crop, zoom, x: centre - (centre - crop.x) * ratio, y: centre - (centre - crop.y) * ratio });
}

/** The square of the photo the box shows, in the photo's own pixels: what the saved photo is cut from. */
export function sourceSquare(crop: Crop): { readonly sx: number; readonly sy: number; readonly side: number } {
  const scale = scaleOf(crop);
  const side = Math.min(crop.box / scale, crop.width, crop.height);
  return {
    sx: clamp(-crop.x / scale, 0, crop.width - side),
    sy: clamp(-crop.y / scale, 0, crop.height - side),
    side,
  };
}
