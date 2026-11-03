"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { ImageIcon, Info, LoaderCircle, Move, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import {
  cutOf,
  shapeCropsOf,
  type CropOutput,
  type CropPreview,
  type CropResult,
  type Cut,
  type CutShape,
  type FixedEntry,
  type FixedShape,
  type Size,
} from "@/lib/dashboard/crop-settings";
import { centredFrameCrop, frameIn, frameScaleOf, moveFrameCrop, zoomFrameCrop, ZOOM_MIN, type FrameCrop } from "@/lib/dashboard/photo-crop";
import { SHEET_BUTTONS, SHEET_CANCEL, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber, sheetConfirm } from "./confirm-dialog";
import { CONTENT_FOCUS } from "./content-parts";
import { EYEBROW } from "./page-header";
import { ZoomSlider } from "./zoom-slider";

// The one crop dialog every dashboard image place opens (epic #964, issue
// #968). What it does in a place is that place's entry in
// lib/dashboard/crop-settings.ts. One shape draws the square photo crop of
// board 55a: one frame still over the photo on a square stage, the outside
// dimmed, a grid of thirds, round previews at the sizes the site shows it.
// Several shapes draw the background crop of board 93f: one frame per shape,
// side by side. In both, dragging (or the arrow keys) moves the photo under a
// frame, and its slider or a pinch zooms it. A "cut" entry hands back a file
// per frame at its preset size; a "crops" entry hands back the photo, its
// long side at most the entry's, and a crop for each shape the editor moved,
// the rest left centred. For a pick of several files (issue #969) it says
// which photo of how many it shows and adds Skip; Cancel stops the rest. A dialog on a
// redesigned page: it fades in under motion-safe only and closes at once
// (design-system-manifest.md).

/** The square layout's frame: its share of the stage. */
const BOX_SHARE = 0.78;

/** How far one arrow key press moves the photo, in screen pixels. */
const KEY_STEP = 10;

/** The side-by-side layout's sheet: a bottom sheet on phones, a 940 px card from sm (board 93f). */
const WIDE_FRAME =
  "fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel px-5 pb-6 pt-3 text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 max-sm:motion-safe:data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[940px] sm:max-w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-7 sm:shadow-[0_16px_40px_rgba(0,0,0,0.6)]";

const WIDE_BUTTON = `inline-flex h-8 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${CONTENT_FOCUS}`;

type Frames = Readonly<Record<string, FrameCrop | null>>;

/** The cut drawn onto a canvas and encoded as the entry's output. */
async function encoded(image: HTMLImageElement, cut: Cut, output: CropOutput, name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = cut.width;
  canvas.height = cut.height;
  canvas.getContext("2d")!.drawImage(image, cut.sx, cut.sy, cut.sw, cut.sh, 0, 0, cut.width, cut.height);
  const quality = output.type === "image/jpeg" ? output.quality : undefined;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, output.type, quality));
  if (blob === null) throw new Error("Could not read that image.");
  return new File([blob], `${name}.${output.type === "image/jpeg" ? "jpg" : "png"}`, { type: output.type });
}

const bytesText = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${Math.round(bytes / (1024 * 1024))} MB`);

export function CropDialog<E extends FixedEntry>({
  entry,
  file,
  pending,
  onCancel,
  onChooseAnother,
  queue,
  onDone,
}: {
  /** The place's settings entry. */
  entry: E;
  /** The photo to crop; null keeps the dialog closed. */
  file: File | null;
  /** The result is uploading. */
  pending: boolean;
  onCancel: () => void;
  /** Swaps the file, where the place offers it; the square layout draws "Choose another photo" for it. */
  onChooseAnother?: () => void;
  /** Where the photo is in a pick of several, which the dialog crops in turn: Skip leaves this one out, and Cancel stops the rest. */
  queue?: CropQueuePlace;
  onDone: (result: CropResult<E>) => void;
}) {
  const shapes: readonly FixedShape[] = entry.shapes;
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const [frames, setFrames] = useState<Frames>({});
  const [set, setSet] = useState<ReadonlySet<string>>(new Set());
  const image = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (file === null) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setFrames({});
    setSet(new Set());
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A new photo, or a frame's new width, starts that frame centred at zoom 1.
  useEffect(() => {
    if (natural === null) return;
    const next: Record<string, FrameCrop | null> = {};
    for (const shape of shapes) {
      const width = widths[shape.name] ?? 0;
      next[shape.name] = width > 0 ? centredFrameCrop(natural.width, natural.height, width, (width * shape.aspect.height) / shape.aspect.width) : null;
    }
    setFrames(next);
    setSet(new Set());
  }, [natural, widths, shapes]);

  const measured = useCallback(
    (name: string) => (width: number) => setWidths((all) => (all[name] === width ? all : { ...all, [name]: width })),
    [],
  );
  const changed = (name: string) => (crop: FrameCrop) => {
    setFrames((all) => ({ ...all, [name]: crop }));
    setSet((all) => (all.has(name) ? all : new Set(all).add(name)));
  };
  const ready = shapes.every((shape) => frames[shape.name]);

  const done = async () => {
    if (image.current === null || !ready) return;
    try {
      if (entry.kind === "cut") {
        const files: Record<string, File> = {};
        for (const shape of entry.shapes as readonly CutShape[]) files[shape.name] = await encoded(image.current, cutOf(shape, frames[shape.name]!), entry.output, shape.name);
        const over = Object.values(files).find((f) => f.size > entry.maxBytes);
        if (over !== undefined) return void toast.error("Could not use that photo", { description: `The cropped photo must be under ${bytesText(entry.maxBytes)}.` });
        onDone({ kind: "cut", files } as CropResult<E>);
      } else {
        const { naturalWidth: sw, naturalHeight: sh } = image.current;
        // The photo is kept whole, its long side at most the entry's; the crops are fractions of it, so they hold at any size.
        const scale = Math.min(1, entry.maxSide / Math.max(sw, sh));
        const whole = { sx: 0, sy: 0, sw, sh, width: Math.round(sw * scale), height: Math.round(sh * scale) };
        const photo = await encoded(image.current, whole, entry.output, "photo");
        if (photo.size > entry.maxBytes) return void toast.error("Could not use that photo", { description: `The photo must be under ${bytesText(entry.maxBytes)}.` });
        const placed = Object.fromEntries(shapes.map((shape) => [shape.name, frames[shape.name] ?? undefined]));
        onDone({ kind: "crops", file: photo, crops: shapeCropsOf(placed, set) } as CropResult<E>);
      }
    } catch (err) {
      toast.error("Could not use that photo", { description: err instanceof Error ? err.message : "Please try again." });
    }
  };

  const layout = { entry, src, frames, ready, pending, measured, changed, done, onChooseAnother, queue: queue !== undefined && queue.count > 1 ? queue : undefined };
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogPortal>{shapes.length === 1 ? <SquareLayout {...layout} shape={shapes[0]} /> : <SideBySideLayout {...layout} shapes={shapes} />}</DialogPortal>
    </Dialog>
  );
}

type LayoutProps = {
  entry: FixedEntry;
  src: string | null;
  frames: Frames;
  ready: boolean;
  pending: boolean;
  measured: (name: string) => (width: number) => void;
  changed: (name: string) => (crop: FrameCrop) => void;
  done: () => void;
  onChooseAnother?: () => void;
  /** Set only for a pick of more than one photo. */
  queue?: CropQueuePlace;
};

/** A photo's place in a pick of several: its position (from 1), how many were picked, and the Skip action. */
export type CropQueuePlace = { readonly position: number; readonly count: number; readonly onSkip: () => void };

/** "Photo 2 of 5", under the title of a pick of several. */
function QueueLine({ queue }: { queue: CropQueuePlace }) {
  return (
    <p className="mt-1 font-mono text-[11px] tracking-[0.15em] text-prt-muted">
      PHOTO {queue.position} OF {queue.count}
    </p>
  );
}

/** The pointer and key handlers that move and zoom the photo under one frame: drag or arrow keys move it, a pinch zooms it. */
function useFrameGestures(crop: FrameCrop | null, onCrop: (crop: FrameCrop) => void) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && crop) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
      }
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const last = pointers.current.get(e.pointerId);
      if (!last || !crop) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        onCrop(zoomFrameCrop(crop, pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance)));
      } else {
        onCrop(moveFrameCrop(crop, e.clientX - last.x, e.clientY - last.y));
      }
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
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
    },
  };
}

/** Reports an element's laid-out width as it mounts and resizes: the dialog's portal mounts it after the dialog's first effects. */
function useMeasuredWidth(onMeasure: (width: number) => void) {
  const latest = useRef(onMeasure);
  useEffect(() => {
    latest.current = onMeasure;
  });
  return useCallback((el: HTMLDivElement | null) => {
    if (el === null) return;
    const observer = new ResizeObserver(([entry]) => latest.current(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
}

/** The photo as it sits under a frame, drawn at `width` pixels for the frame's width. */
function Placed({ src, crop, width }: { src: string; crop: FrameCrop; width: number }) {
  const f = width / crop.frameWidth;
  const scale = frameScaleOf(crop) * f;
  return (
    // A blob: URL of the editor's own file; next/image cannot take one.
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

/** Board 55a: one frame still on a square stage, the outside dimmed, the previews beside it. */
function SquareLayout({ entry, shape, src, frames, ready, pending, measured, changed, done, onChooseAnother, queue }: LayoutProps & { shape: FixedShape }) {
  const [stage, setStage] = useState(0);
  const measureStage = useMeasuredWidth(setStage);
  const room = Math.round(stage * BOX_SHARE);
  const frame = frameIn(shape.aspect, { width: room, height: room });
  const report = measured(shape.name);
  useEffect(() => report(frame.width), [report, frame.width]);
  const crop = frames[shape.name] ?? null;
  const onCrop = changed(shape.name);
  const gestures = useFrameGestures(crop, onCrop);

  return (
    <>
      <DialogOverlay className={SHEET_OVERLAY} />
      <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[640px]`}>
        <SheetGrabber />
        <div className="flex items-center justify-between gap-4">
          <div>
            <DialogTitle className="text-[20px] font-bold leading-snug">{entry.words.title}</DialogTitle>
            {queue && <QueueLine queue={queue} />}
          </div>
          <DialogClose
            aria-label="Close"
            disabled={pending}
            className="-mr-2 flex h-8 w-8 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </DialogClose>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[360px_1fr]">
          <div
            ref={measureStage}
            role="application"
            tabIndex={0}
            aria-label="Photo to crop. Drag or use the arrow keys to move it."
            {...gestures}
            className={`relative aspect-square w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-ground active:cursor-grabbing ${CONTENT_FOCUS}`}
          >
            {src && crop && (
              <div className="absolute" style={{ left: (stage - frame.width) / 2, top: (stage - frame.height) / 2, width: frame.width, height: frame.height }}>
                <Placed src={src} crop={crop} width={frame.width} />
                {/* The dimmed outside, the frame's edge, its grid of thirds and its corner handles. */}
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
            {(entry.previews?.length ?? 0) > 0 && <p className={`${EYEBROW} hidden sm:block`}>Preview</p>}
            {entry.previews?.map((preview) => <Preview key={preview.caption} src={src} crop={crop} shape={shape} preview={preview} />)}
            <p className="hidden text-[13px] leading-relaxed text-prt-muted sm:block">Drag to move. Pinch or use the slider to zoom.</p>
          </div>
        </div>

        <ZoomSlider label="Zoom" zoom={crop?.zoom ?? ZOOM_MIN} disabled={crop === null} onZoom={(zoom) => crop && onCrop(zoomFrameCrop(crop, zoom))} className="mt-5" />
        {onChooseAnother && (
          <button
            type="button"
            onClick={onChooseAnother}
            className="mt-4 inline-flex items-center gap-2 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Choose another photo
          </button>
        )}
        {entry.words.note && <Note text={entry.words.note} />}

        <div className={SHEET_BUTTONS}>
          <DialogClose disabled={pending} className={SHEET_CANCEL}>
            Cancel
          </DialogClose>
          {queue && (
            <button type="button" onClick={queue.onSkip} disabled={pending} className={SHEET_CANCEL}>
              Skip this photo
            </button>
          )}
          <button type="button" onClick={done} disabled={pending || !ready} className={sheetConfirm(false)}>
            {entry.words.confirm}
          </button>
        </div>
      </DialogPrimitive.Content>
    </>
  );
}

function Preview({ src, crop, shape, preview }: { src: string | null; crop: FrameCrop | null; shape: FixedShape; preview: CropPreview }) {
  const height = Math.round((preview.size * shape.aspect.height) / shape.aspect.width);
  return (
    <figure className="flex items-center gap-3">
      <span className="relative block shrink-0 overflow-hidden rounded-full bg-white-10" style={{ width: preview.size, height }}>
        {src && crop && <Placed src={src} crop={crop} width={preview.size} />}
      </span>
      <figcaption className="text-[13px] text-text-2">{preview.caption}</figcaption>
    </figure>
  );
}

/** Board 93f: one frame per shape, side by side, each with its own zoom. A portrait frame takes a 232 px column from sm. */
function SideBySideLayout({ entry, shapes, src, frames, ready, pending, measured, changed, done, queue }: LayoutProps & { shapes: readonly FixedShape[] }) {
  const portrait = (shape: FixedShape) => shape.aspect.width < shape.aspect.height;
  const columns = shapes.map((shape) => (portrait(shape) ? "232px" : "minmax(0,1fr)")).join(" ");
  return (
    <>
      <DialogOverlay className={SHEET_OVERLAY} />
      <DialogPrimitive.Content {...(entry.words.description ? {} : { "aria-describedby": undefined })} className={WIDE_FRAME}>
        <SheetGrabber />
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-[20px] font-bold leading-snug">{entry.words.title}</DialogTitle>
            {queue && <QueueLine queue={queue} />}
            {entry.words.description && (
              <DialogPrimitive.Description className="mt-1 text-[14px] leading-relaxed text-text-2">{entry.words.description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogClose
            aria-label="Close"
            disabled={pending}
            className={`-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${CONTENT_FOCUS}`}
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </DialogClose>
        </div>

        {/* The columns follow the shapes, which no static class can name. */}
        <div className="mt-6 grid gap-7 sm:grid-cols-[var(--crop-columns)]" style={{ "--crop-columns": columns } as CSSProperties}>
          {shapes.map((shape) => {
            const crop = frames[shape.name] ?? null;
            const onCrop = changed(shape.name);
            return (
              <div key={shape.name} className={portrait(shape) ? "mx-auto w-[min(232px,100%)] sm:w-full" : "min-w-0"}>
                <p className="mb-2.5 text-[14px] leading-snug">
                  <span className="font-semibold text-prt-text">{shape.label}</span>
                  <span className="ml-2 text-prt-muted">{shape.use}</span>
                </p>
                <ShapeFrame
                  shape={shape}
                  label={`${shape.label} crop, for the ${shape.use.toLowerCase()}. Drag or use the arrow keys to move the photo.`}
                  src={src}
                  crop={crop}
                  onMeasure={measured(shape.name)}
                  onCrop={onCrop}
                />
                <ZoomSlider
                  label={`Zoom the ${shape.label.toLowerCase()} crop`}
                  zoom={crop?.zoom ?? ZOOM_MIN}
                  disabled={crop === null}
                  onZoom={(zoom) => crop && onCrop(zoomFrameCrop(crop, zoom))}
                />
              </div>
            );
          })}
        </div>

        {entry.words.note && <Note text={entry.words.note} />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <DialogClose disabled={pending} className={`${WIDE_BUTTON} border border-white-10 transition-colors duration-300 ease-out enabled:hover:border-border-strong`}>
            Cancel
          </DialogClose>
          {queue && (
            <button
              type="button"
              onClick={queue.onSkip}
              disabled={pending}
              className={`${WIDE_BUTTON} border border-white-10 transition-colors duration-300 ease-out enabled:hover:border-border-strong`}
            >
              Skip this photo
            </button>
          )}
          <button
            type="button"
            onClick={done}
            disabled={pending || !ready}
            className={`${WIDE_BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out enabled:hover:opacity-90`}
          >
            {pending && <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.75} />}
            {entry.words.confirm}
          </button>
        </div>
      </DialogPrimitive.Content>
    </>
  );
}

/** The line above the buttons: what the place takes. */
function Note({ text }: { text: string }) {
  return (
    <p className="mt-7 flex items-center gap-2 text-[13px] leading-snug text-prt-muted">
      <Info aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {text}
    </p>
  );
}

/** One frame of the shape's aspect, the photo placed under it as its crop says; it reports its width as it is laid out. */
function ShapeFrame({
  shape,
  label,
  src,
  crop,
  onMeasure,
  onCrop,
}: {
  shape: FixedShape;
  label: string;
  src: string | null;
  crop: FrameCrop | null;
  onMeasure: (width: number) => void;
  onCrop: (crop: FrameCrop) => void;
}) {
  const measure = useMeasuredWidth(onMeasure);
  const gestures = useFrameGestures(crop, onCrop);
  return (
    <div
      ref={measure}
      role="application"
      tabIndex={0}
      aria-label={label}
      {...gestures}
      style={{ aspectRatio: `${shape.aspect.width} / ${shape.aspect.height}` }}
      className={`relative w-full cursor-grab touch-none select-none overflow-hidden rounded-[10px] bg-ground ring-2 ring-accent active:cursor-grabbing ${CONTENT_FOCUS}`}
    >
      {src !== null && crop !== null && <Placed src={src} crop={crop} width={crop.frameWidth} />}
      <span className="pointer-events-none absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ground/80 px-3 py-1.5 text-[13px] leading-none text-prt-text">
        <Move aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Drag to move
      </span>
    </div>
  );
}
