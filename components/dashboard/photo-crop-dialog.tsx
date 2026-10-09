"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImageIcon, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { centredCrop, moveCrop, scaleOf, sourceSquare, zoomCrop, ZOOM_MAX, ZOOM_MIN, type Crop } from "@/lib/dashboard/photo-crop";
import { PHOTO_TYPES } from "@/lib/dashboard/self";
import { SHEET_BUTTONS, SHEET_CANCEL, SHEET_CONTENT, SheetGrabber, sheetConfirm } from "./confirm-dialog";
import { EYEBROW } from "./page-header";

/** The saved photo's side: square, so a JPEG fits well under the 2 MB limit. */
const PHOTO_SIZE = 800;

/** The crop box's share of the stage. */
const BOX_SHARE = 0.78;

/** The photo cut to the crop's square and scaled down, as a JPEG. */
async function croppedPhoto(image: HTMLImageElement, crop: Crop): Promise<File> {
  const { sx, sy, side } = sourceSquare(crop);
  const out = Math.round(Math.min(side, PHOTO_SIZE));
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  canvas.getContext("2d")!.drawImage(image, sx, sy, side, side, 0, 0, out, out);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (blob === null) throw new Error("Could not read that image.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** The photo as it sits under a crop, drawn at `size` pixels for the box's side. */
function Placed({ src, crop, size }: { src: string; crop: Crop; size: number }) {
  const f = size / crop.box;
  const scale = scaleOf(crop) * f;
  return (
    // A blob: URL of the person's own file; next/image cannot take one.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
      style={{ width: crop.width * scale, height: crop.height * scale, transform: `translate(${crop.x * f}px, ${crop.y * f}px)` }}
    />
  );
}

// Board 55a: crop the chosen photo to a square. The square box stays still
// over the photo; dragging moves the photo, and the slider or a pinch zooms
// it. The two previews show the photo at the sizes the site uses it. Save
// sends the square as a JPEG; Choose another photo swaps the file.
export function PhotoCropDialog({
  file,
  onOpenChange,
  onChooseAnother,
  onSave,
  pending,
}: {
  /** The photo to crop; null keeps the dialog closed. */
  file: File | null;
  onOpenChange: (open: boolean) => void;
  onChooseAnother: () => void;
  onSave: (photo: File) => void;
  pending: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [stage, setStage] = useState(0);
  const image = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    if (file === null) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A new photo, or a new stage size, starts centred at zoom 1.
  const box = Math.round(stage * BOX_SHARE);
  useEffect(() => {
    if (natural !== null && box > 0) setCrop(centredCrop(natural.width, natural.height, box));
  }, [natural, box]);

  useEffect(() => {
    const el = stageRef.current;
    if (el === null) return;
    const observer = new ResizeObserver(([entry]) => setStage(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && crop) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId);
    if (!last || !crop) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance;
      setCrop(zoomCrop(crop, pinch.current.zoom * ratio));
    } else {
      setCrop(moveCrop(crop, e.clientX - last.x, e.clientY - last.y));
    }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const save = async () => {
    if (!image.current || !crop) return;
    onSave(await croppedPhoto(image.current, crop));
  };

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground/70 backdrop-blur-[3px]" />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[640px]`}>
          <SheetGrabber />
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-[20px] font-bold leading-snug">Crop your photo</DialogTitle>
            <DialogClose
              aria-label="Close"
              className="-mr-2 flex h-8 w-8 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </DialogClose>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-[360px_1fr]">
            <div
              ref={stageRef}
              role="application"
              aria-label="Photo to crop. Drag to move it."
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              className="relative aspect-square w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-ground active:cursor-grabbing"
            >
              {src && crop && (
                <div className="absolute" style={{ left: (stage - box) / 2, top: (stage - box) / 2, width: box, height: box }}>
                  <Placed src={src} crop={crop} size={box} />
                  {/* The dimmed outside, the box's edge, its grid of thirds and its corner handles. */}
                  <div aria-hidden className="pointer-events-none absolute inset-0 border-2 border-prt-text shadow-[0_0_0_9999px_rgba(10,10,10,0.6)]">
                    <span className="absolute inset-y-0 left-1/3 w-px bg-prt-text/40" />
                    <span className="absolute inset-y-0 left-2/3 w-px bg-prt-text/40" />
                    <span className="absolute inset-x-0 top-1/3 h-px bg-prt-text/40" />
                    <span className="absolute inset-x-0 top-2/3 h-px bg-prt-text/40" />
                    {["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((at) => (
                      <span key={at} className={`absolute h-3 w-3 rounded-[2px] bg-prt-text ${at}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-row items-center gap-6 sm:flex-col sm:items-start sm:gap-4">
              <p className={`${EYEBROW} hidden sm:block`}>Preview</p>
              <Preview src={src} crop={crop} size={56} caption="Team page" />
              <Preview src={src} crop={crop} size={28} caption="Dashboard" />
              <p className="hidden text-[13px] leading-relaxed text-prt-muted sm:block">Drag to move. Pinch or use the slider to zoom.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <ZoomOut aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
            <input
              type="range"
              aria-label="Zoom"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={crop?.zoom ?? ZOOM_MIN}
              onChange={(e) => crop && setCrop(zoomCrop(crop, Number(e.target.value)))}
              className="h-1 flex-1 cursor-pointer accent-accent"
            />
            <ZoomIn aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
          </div>
          <button
            type="button"
            onClick={onChooseAnother}
            className="mt-4 inline-flex items-center gap-2 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Choose another photo
          </button>

          <div className={SHEET_BUTTONS}>
            <DialogClose className={SHEET_CANCEL}>Cancel</DialogClose>
            <button type="button" onClick={save} disabled={pending || crop === null} className={sheetConfirm(false)}>
              Save photo
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function Preview({ src, crop, size, caption }: { src: string | null; crop: Crop | null; size: number; caption: string }) {
  return (
    <figure className="flex items-center gap-3">
      <span className="relative block shrink-0 overflow-hidden rounded-full bg-white-10" style={{ width: size, height: size }}>
        {src && crop && <Placed src={src} crop={crop} size={size} />}
      </span>
      <figcaption className="text-[13px] text-text-2">{caption}</figcaption>
    </figure>
  );
}

/** The file types the photo input takes. */
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
