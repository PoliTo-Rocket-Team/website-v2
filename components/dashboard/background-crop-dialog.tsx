"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Info, LoaderCircle, Move, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { centredFrameCrop, frameScaleOf, moveFrameCrop, sourceRect, zoomFrameCrop, ZOOM_MIN, type FrameCrop } from "@/lib/dashboard/photo-crop";
import { BACKGROUND_FRAMES, type BackgroundShape } from "@/lib/project-content/record";
import { SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";
import { CONTENT_FOCUS } from "./content-parts";
import { ZoomSlider } from "./zoom-slider";

// Board 93f (issue #529): one uploaded picture, cropped twice. Tall (9:16)
// is the Home card's and phones'; Wide (2:1) is the project page's and
// laptops'. Each frame stays still over the picture: dragging moves the
// picture under it (the arrow keys too), and its slider zooms it. "Use this
// background" cuts both crops as JPEGs at the presets' sizes
// (`BACKGROUND_FRAMES`), never larger than the picture itself; Cancel or the
// close button drops the picture. A dialog on a redesigned page: it fades in
// under motion-safe only and closes at once (design-system-manifest.md).

/** Both crops, cut and ready to upload. */
export type BackgroundCrops = { readonly [shape in BackgroundShape]: File };

const FRAME =
  "fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel px-5 pb-6 pt-3 text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 max-sm:motion-safe:data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[940px] sm:max-w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-7 sm:shadow-[0_16px_40px_rgba(0,0,0,0.6)]";

const BUTTON = `inline-flex h-8 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${CONTENT_FOCUS}`;

/** What each frame is for, under its name (board 93f). */
const SHAPES: readonly { shape: BackgroundShape; name: string; use: string }[] = [
  { shape: "tall", name: "Tall", use: "Home card, phones" },
  { shape: "wide", name: "Wide", use: "Project page, laptops" },
];

/** How far one arrow key press moves the picture, in screen pixels. */
const KEY_STEP = 10;

/** One crop of the picture, cut at most at its shape's preset size, as a JPEG. */
async function cutCrop(image: HTMLImageElement, crop: FrameCrop, shape: BackgroundShape): Promise<File> {
  const { sx, sy, sw, sh } = sourceRect(crop);
  const size = BACKGROUND_FRAMES[shape];
  const width = Math.round(Math.min(sw, size.width));
  const height = Math.round((width * size.height) / size.width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (blob === null) throw new Error("Could not read that picture.");
  return new File([blob], `${shape}.jpg`, { type: "image/jpeg" });
}

export function BackgroundCropDialog({
  file,
  pending,
  onCancel,
  onUse,
}: {
  /** The picture to crop; null keeps the dialog closed. */
  file: File | null;
  /** Both crops are uploading. */
  pending: boolean;
  onCancel: () => void;
  onUse: (crops: BackgroundCrops) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crops, setCrops] = useState<{ [shape in BackgroundShape]: FrameCrop | null }>({ tall: null, wide: null });
  const [frames, setFrames] = useState<{ [shape in BackgroundShape]: number }>({ tall: 0, wide: 0 });
  const image = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (file === null) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setCrops({ tall: null, wide: null });
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A new picture, or a frame's new width, starts that frame's crop centred at zoom 1.
  useEffect(() => {
    if (natural === null) return;
    const centred = (shape: BackgroundShape) => {
      const width = frames[shape];
      const { width: w, height: h } = BACKGROUND_FRAMES[shape];
      return width > 0 ? centredFrameCrop(natural.width, natural.height, width, (width * h) / w) : null;
    };
    setCrops({ tall: centred("tall"), wide: centred("wide") });
  }, [natural, frames]);

  const use = async () => {
    const { tall, wide } = crops;
    if (image.current === null || tall === null || wide === null) return;
    onUse({ tall: await cutCrop(image.current, tall, "tall"), wide: await cutCrop(image.current, wide, "wide") });
  };

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content className={FRAME}>
          <SheetGrabber />
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-[20px] font-bold leading-snug">Crop your background</DialogTitle>
              <DialogPrimitive.Description className="mt-1 text-[14px] leading-relaxed text-text-2">
                One photo, two shapes. Drag the photo inside each frame to choose what shows.
              </DialogPrimitive.Description>
            </div>
            <DialogClose
              aria-label="Close"
              disabled={pending}
              className={`-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${CONTENT_FOCUS}`}
            >
              <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </DialogClose>
          </div>

          <div className="mt-6 grid gap-7 sm:grid-cols-[232px_minmax(0,1fr)]">
            {SHAPES.map(({ shape, name, use: purpose }) => (
              <div key={shape} className={shape === "tall" ? "mx-auto w-[min(232px,100%)] sm:w-full" : "min-w-0"}>
                <p className="mb-2.5 text-[14px] leading-snug">
                  <span className="font-semibold text-prt-text">{name}</span>
                  <span className="ml-2 text-prt-muted">{purpose}</span>
                </p>
                <CropFrame
                  shape={shape}
                  label={`${name} crop, for the ${purpose.toLowerCase()}. Drag or use the arrow keys to move the photo.`}
                  src={src}
                  crop={crops[shape]}
                  onMeasure={(width) => setFrames((all) => (all[shape] === width ? all : { ...all, [shape]: width }))}
                  onCrop={(crop) => setCrops((all) => ({ ...all, [shape]: crop }))}
                />
                <ZoomSlider
                  label={`Zoom the ${name.toLowerCase()} crop`}
                  zoom={crops[shape]?.zoom ?? ZOOM_MIN}
                  disabled={crops[shape] === null}
                  onZoom={(zoom) => setCrops((all) => ({ ...all, [shape]: all[shape] && zoomFrameCrop(all[shape], zoom) }))}
                />
              </div>
            ))}
          </div>

          <p className="mt-7 flex items-center gap-2 text-[13px] leading-snug text-prt-muted">
            <Info aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            JPG, PNG or WebP, up to 10 MB. At least 2400 px wide works best.
          </p>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose disabled={pending} className={`${BUTTON} border border-white-10 transition-colors duration-300 ease-out enabled:hover:border-border-strong`}>
              Cancel
            </DialogClose>
            <button
              type="button"
              onClick={use}
              disabled={pending || crops.tall === null || crops.wide === null}
              className={`${BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out enabled:hover:opacity-90`}
            >
              {pending && <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.75} />}
              Use this background
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** One frame of the shape's aspect, the picture placed under it as its crop says; it reports its width as it is laid out. */
function CropFrame({
  shape,
  label,
  src,
  crop,
  onMeasure,
  onCrop,
}: {
  shape: BackgroundShape;
  label: string;
  src: string | null;
  crop: FrameCrop | null;
  onMeasure: (width: number) => void;
  onCrop: (crop: FrameCrop) => void;
}) {
  const last = useRef<{ x: number; y: number } | null>(null);
  const measured = useRef(onMeasure);
  useEffect(() => {
    measured.current = onMeasure;
  });

  // Measured as the frame mounts: the dialog's portal mounts it after the dialog's first effects.
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (el === null) return;
    const observer = new ResizeObserver(([entry]) => measured.current(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (last.current === null || crop === null) return;
    onCrop(moveFrameCrop(crop, e.clientX - last.current.x, e.clientY - last.current.y));
    last.current = { x: e.clientX, y: e.clientY };
  };
  const up = () => {
    last.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const by: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const step = by[e.key];
    if (step === undefined || crop === null) return;
    e.preventDefault();
    onCrop(moveFrameCrop(crop, step[0], step[1]));
  };

  const scale = crop === null ? 0 : frameScaleOf(crop);
  return (
    <div
      ref={measure}
      role="application"
      tabIndex={0}
      aria-label={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className={`relative w-full cursor-grab touch-none select-none overflow-hidden rounded-[10px] bg-ground ring-2 ring-accent active:cursor-grabbing ${
        shape === "tall" ? "aspect-[9/16]" : "aspect-[2/1]"
      } ${CONTENT_FOCUS}`}
    >
      {src !== null && crop !== null && (
        // A blob: URL of the editor's own file; next/image cannot take one.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
          style={{ width: crop.width * scale, height: crop.height * scale, transform: `translate(${crop.x}px, ${crop.y}px)` }}
        />
      )}
      <span className="pointer-events-none absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ground/80 px-3 py-1.5 text-[13px] leading-none text-prt-text">
        <Move aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Drag to move
      </span>
    </div>
  );
}
