"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Maximize2, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { isPhoto, ringOffset, wrapIndex, type FilledGallery, type GalleryItem } from "./items";

// Boards 23 / 23m (carousel) and 23L (lightbox). The current photo sits
// centred (760 x 480, phones 300 x 220); its neighbours peek in at both sides,
// smaller and at 35 % opacity, clipped by the page edge. It wraps around,
// never autoplays, and nothing moves while idle. The lightbox is the repo's
// Radix dialog, so focus trap, Escape and scroll lock come with it.

const SWIPE_PX = 40;

/** Round glass button on a photo: ink under a blur, a white-10 edge. */
const glassButton =
  "flex shrink-0 items-center justify-center rounded-full border border-white-10 bg-ground/60 text-prt-text backdrop-blur-md transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60";

function PlaceholderTile({ large = false }: { large?: boolean }) {
  return (
    <div className="glass-card absolute inset-0 overflow-hidden rounded-xl">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-white-5 to-transparent" />
      <p
        aria-hidden
        className={`absolute font-mono tracking-[0.2em] text-prt-muted ${
          large ? "bottom-5 left-5 text-[11px] md:text-[13px]" : "bottom-3 left-3 text-[10px] md:bottom-4 md:left-4 md:text-[11px]"
        }`}
      >
        PHOTO<span className={large ? "" : "hidden md:inline"}> · PLACEHOLDER</span>
      </p>
    </div>
  );
}

function ItemView({ item, sizes, fit, large }: { item: GalleryItem; sizes: string; fit: "cover" | "contain"; large?: boolean }) {
  if (!isPhoto(item)) return <PlaceholderTile large={large} />;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes={sizes}
        className={fit === "cover" ? "object-cover" : "object-contain"}
      />
    </div>
  );
}

export function Gallery({ items, label }: { items: FilledGallery; label: string }) {
  const count = items.length;
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const step = (by: number) => setCurrent((i) => wrapIndex(i, by, count));

  // A slide that jumps more than one place (round the back of the ring) moves
  // while hidden; it skips the ease so it never sweeps across the current photo.
  const lastOffsets = useRef<number[]>([]);
  const offsets = items.map((_, i) => ringOffset(i, current, count));
  useEffect(() => {
    lastOffsets.current = offsets;
  });

  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  // A click that ends a swipe is not a tap. Keyboard activation (detail 0) always is.
  const tapped = (e: MouseEvent) => e.detail === 0 || !swiped.current;
  const onPointerDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    step(dx < 0 ? 1 : -1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else return;
    e.preventDefault();
  };

  const item = items[current];

  return (
    <div>
      <div className="overflow-x-clip">
        <div
          ref={regionRef}
          role="region"
          aria-roledescription="carousel"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
          className="relative mx-auto aspect-[300/220] w-[var(--w)] touch-pan-y select-none rounded-xl [--gap:12px] [--peek-scale:0.8636] [--peek-x:calc(var(--w)*(1_+_var(--peek-scale))/2_+_var(--gap))] [--w:min(300px,calc(100vw_-_90px))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 md:aspect-[760/480] md:[--gap:24px] md:[--peek-scale:0.8333] md:[--w:min(760px,calc(100vw_-_160px))]"
        >
          {items.map((it, i) => {
            const d = offsets[i];
            const isCurrent = d === 0;
            const shown = Math.abs(d) <= 1;
            const jumped = Math.abs(d - (lastOffsets.current[i] ?? d)) > 1;
            return (
              <div
                key={i}
                aria-hidden={!isCurrent}
                style={{
                  transform: `translateX(calc(var(--peek-x) * ${d})) scale(${isCurrent ? 1 : "var(--peek-scale)"})`,
                  opacity: isCurrent ? 1 : shown ? 0.35 : 0,
                  zIndex: isCurrent ? 2 : 1,
                }}
                className={`absolute inset-0 ${shown ? "" : "pointer-events-none"} ${
                  jumped ? "" : "motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-out"
                }`}
              >
                <ItemView item={it} sizes="(min-width: 768px) 760px, 300px" fit="cover" />
                {isCurrent ? (
                  <button
                    type="button"
                    aria-label={`Open photo ${i + 1} of ${count}: ${it.alt}`}
                    onClick={(e) => tapped(e) && setOpen(true)}
                    className="absolute inset-0 z-[2] cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60"
                  />
                ) : (
                  shown && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      onClick={(e) => tapped(e) && step(d)}
                      className="absolute inset-0 z-[2] cursor-pointer rounded-xl"
                    />
                  )
                )}
              </div>
            );
          })}

          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => step(-1)}
            className={`${glassButton} absolute left-3 top-1/2 z-[3] h-9 w-9 -translate-y-1/2 md:left-4 md:h-12 md:w-12`}
          >
            <ArrowLeft aria-hidden className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => step(1)}
            className={`${glassButton} absolute right-3 top-1/2 z-[3] h-9 w-9 -translate-y-1/2 md:right-4 md:h-12 md:w-12`}
          >
            <ArrowRight aria-hidden className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Open the photo full screen"
            onClick={() => setOpen(true)}
            className={`${glassButton} absolute right-3 top-3 z-[3] h-9 w-9 md:right-4 md:top-4 md:h-12 md:w-12`}
          >
            <Maximize2 aria-hidden className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        Photo {current + 1} of {count}: {item.alt}
      </p>

      <div className="mt-5 flex items-center justify-center gap-2 md:mt-8">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show photo ${i + 1} of ${count}`}
            aria-current={i === current ? "true" : undefined}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-prt-text/60 ${
              i === current ? "w-5 bg-accent" : "w-1.5 bg-dim hover:bg-prt-muted"
            }`}
          />
        ))}
      </div>

      <Lightbox
        items={items}
        current={current}
        onStep={step}
        open={open}
        onOpenChange={setOpen}
        label={label}
        onClosed={() => regionRef.current?.focus()}
      />
    </div>
  );
}

// Board 23L: a full-screen dark dialog. The photo large and contained, prev
// and next beside it, "n / total" top left, close top right, a one-line
// caption under the photo. It shares the carousel's index, so the carousel
// shows the last photo browsed when it closes.
function Lightbox({
  items,
  current,
  onStep,
  open,
  onOpenChange,
  label,
  onClosed,
}: {
  items: FilledGallery;
  current: number;
  onStep: (by: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  onClosed: () => void;
}) {
  const item = items[current];
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") onStep(-1);
    else if (e.key === "ArrowRight") onStep(1);
    else return;
    e.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed();
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 text-prt-text duration-200 focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <p className="absolute left-5 top-6 font-mono text-[13px] tracking-[0.1em] md:left-[62px] md:top-12 md:text-sm">
            {current + 1} / {items.length}
          </p>
          <DialogClose aria-label="Close" className={`${glassButton} absolute right-4 top-3 h-11 w-11 md:right-[96px] md:top-[38px]`}>
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </DialogClose>

          <div className="relative flex w-full justify-center">
            <figure className="w-[min(calc(100vw_-_40px),calc((100dvh_-_200px)_*_1.5833))] md:w-[min(1003px,calc(100vw_-_380px),calc((100dvh_-_274px)_*_1.5833))]">
              <div className="relative aspect-[760/480] w-full">
                <ItemView item={item} sizes="(min-width: 768px) 1003px, 100vw" fit="contain" large />
              </div>
              <figcaption className="mt-4 flex items-baseline justify-between gap-6 md:mt-5">
                <span className="min-w-0 truncate text-[15px] text-text-2">{item.caption}</span>
                <span aria-hidden className="hidden shrink-0 font-mono text-[10px] tracking-[0.2em] text-prt-muted md:block">
                  ESC TO CLOSE · ← → TO BROWSE
                </span>
              </figcaption>
            </figure>

            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => onStep(-1)}
              className={`${glassButton} absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 md:left-[72px] md:h-[54px] md:w-[54px]`}
            >
              <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => onStep(1)}
              className={`${glassButton} absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 md:right-[72px] md:h-[54px] md:w-[54px]`}
            >
              <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
