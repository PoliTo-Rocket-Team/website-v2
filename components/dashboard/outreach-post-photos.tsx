"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Photo } from "@/components/outreach/photo";
import type { CropsEntry, ShapeCrops } from "@/lib/dashboard/crop-settings";
import type { WriteResult } from "@/lib/dashboard/write";
import type { PhotoSrc } from "@/lib/outreach-types";
import { cropsKey } from "@/lib/photo-crops";
import { describePhoto, movePhoto, neighbourOf, pickedPhoto, removePhoto, reorderPhotos } from "@/lib/photo-list";
import { CONTENT_FOCUS, useDragOrder } from "./content-parts";
import { useCropQueue, useInOrder, type CroppedPhoto } from "./crop-queue";
import { inputClass } from "./field";

// The Photos section of the Edit post panel (board 74h, issue #291): the
// post's photos in a grid, the first one the cover and the card photo. Drag
// a photo to move it; click one to write its description for screen readers,
// move it or remove it; Add uploads new ones. A photo is uploaded the moment
// it is picked, so the page beside the panel shows it at once; Save draft or
// Publish puts it on the post. A photo removed before any save used it is
// deleted from the store again. A launch card of the Edit <project> panel
// (issue #299) holds its photos here too, through the projects' own upload,
// with no cover and two photos at most.
//
// Each photo is known by its file (lib/photo-list.ts, issue #430): the box
// shows the picked photo's own description, and every keystroke goes into
// the panel's fields at once, so Save draft keeps it. The box's arrows pick
// the previous or next photo and never carry the text along. A description
// is optional.
//
// The place's crop entry (issue #969) opens the shared crop dialog on each
// picked file in turn, Skip and Cancel included, and keeps the photo once
// with its crop for each shape.

/** A photo in a panel's list: its file, its description, and its crop for each shape the editor framed. */
export type CroppablePhoto<N extends string> = { readonly src: PhotoSrc; readonly alt: string; readonly crops?: ShapeCrops<N> };

const TILE = "relative aspect-[16/9] overflow-hidden rounded-lg";

/** Where a panel's photos go: stored the moment they are picked, and deleted again when removed before a save used them. */
export type PhotoUploads = {
  readonly upload: (form: FormData) => Promise<WriteResult<PhotoSrc>>;
  readonly discard: (src: string) => Promise<unknown>;
};

export function PhotosSection<N extends string>({
  photos,
  onChange,
  uploads,
  crop,
  cover,
  max,
  error,
}: {
  photos: readonly CroppablePhoto<N>[];
  /** Takes a change to the photos as they are when it lands, so an upload that ends late never undoes an edit. */
  onChange: (change: (photos: readonly CroppablePhoto<N>[]) => CroppablePhoto<N>[]) => void;
  uploads: PhotoUploads;
  /** The place's crop entry (lib/dashboard/crop-settings.ts). */
  crop: CropsEntry<N>;
  /** The first photo is the cover, and says so. */
  cover: boolean;
  /** The most photos the list takes; null for no limit. */
  max: number | null;
  error?: string;
}) {
  // The picked photo, by its file: its place may change, it stays picked.
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const altId = useId();
  const srcs = photos.map((p) => p.src);
  const photoOf = new Map(photos.map((p) => [p.src, p]));

  const drag = useDragOrder(srcs, (order) => onChange((list) => reorderPhotos(list, order)));
  const describe = (src: string, alt: string) => onChange((list) => describePhoto(list, src, alt));
  const remove = (src: string) => {
    onChange((list) => removePhoto(list, src));
    setOpen(null);
    // The server keeps the file while a stored version of a post shows it.
    void uploads.discard(src);
  };
  const move = (src: string, by: -1 | 1) => onChange((list) => movePhoto(list, src, by));

  // The first photo of a pick to land opens, so its description is the next thing to write.
  const opensNext = useRef(false);
  const inOrder = useInOrder();
  const store = ({ file, crops }: CroppedPhoto<N>) => {
    setUploading((n) => n + 1);
    inOrder(async () => {
      const form = new FormData();
      form.set("photo", file);
      const result = await uploads.upload(form);
      setUploading((n) => n - 1);
      if (!result.ok) return void toast.error(result.error);
      const src = result.value;
      onChange((list) => [...list, { src, alt: "", ...cropsKey(crops) }]);
      if (opensNext.current) setOpen(src);
      opensNext.current = false;
    });
  };
  const queue = useCropQueue(crop, store);

  const room = max === null ? Infinity : max - photos.length - uploading;
  const add = (picked: readonly File[]) => {
    const files = picked.slice(0, Math.max(0, room));
    if (files.length < picked.length) toast.error(`Keep ${max} photos at most.`);
    opensNext.current = true;
    queue.pick(files);
  };

  const picked = pickedPhoto(photos, open);
  const previous = neighbourOf(photos, open, -1);
  const next = neighbourOf(photos, open, 1);

  return (
    <>
      {cover && <p className="text-[12px] text-prt-muted">The first is the top photo and the card photo. Drag to reorder.</p>}
      <ul className="grid grid-cols-3 gap-2" {...drag.list}>
        {drag.order.map((src, index) => {
          const photo = photoOf.get(src);
          if (photo === undefined) return null;
          const row = drag.row(src, index);
          return (
            <li
              key={src}
              draggable
              onDragStart={row.onDragStart}
              onDragOver={row.onDragOver}
              onDragEnd={row.onDragEnd}
              className={`${TILE} cursor-grab ${row.dragged ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                aria-pressed={open === src}
                aria-label={`Photo ${index + 1}${cover && index === 0 ? ", the cover" : ""}: ${photo.alt.trim() || "no description"}`}
                onClick={() => setOpen(open === src ? null : src)}
                className={`absolute inset-0 rounded-lg ${CONTENT_FOCUS}`}
              >
                <Photo photo={{ src: photo.src, alt: "" }} sizes="140px" />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-lg border transition-colors duration-300 ease-out ${
                    open === src ? "border-2 border-accent" : "border-transparent hover:border-border-strong"
                  }`}
                />
              </button>
              {cover && index === 0 && (
                <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-ground/80 px-2 py-0.5 text-[11px] font-semibold text-prt-text">
                  Cover
                </span>
              )}
            </li>
          );
        })}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`uploading-${i}`} className={`${TILE} flex items-center justify-center border border-hairline bg-white-5`}>
            <LoaderCircle aria-hidden className="h-4 w-4 text-prt-muted motion-safe:animate-spin" strokeWidth={1.75} />
            <span className="sr-only">Uploading a photo</span>
          </li>
        ))}
        <li className={room > 0 ? TILE : "hidden"}>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-hairline text-[13px] text-text-2 transition-colors duration-300 ease-out hover:border-border-strong hover:text-prt-text ${CONTENT_FOCUS}`}
          >
            <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Add
          </button>
          <input
            ref={input}
            type="file"
            accept={crop.accept.join(",")}
            multiple
            hidden
            aria-label="Add photos"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length > 0) add(files);
            }}
          />
        </li>
      </ul>

      {picked !== null && (
        <div className="space-y-2.5 rounded-[10px] border border-accent bg-white-5 p-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={altId} className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
              Photo {picked.index + 1}
              {cover && picked.index === 0 && " · cover"}
            </label>
            <span className="flex items-center gap-1">
              <ArrowButton label="Previous photo" onClick={previous === null ? null : () => setOpen(previous)}>
                <ChevronLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </ArrowButton>
              <ArrowButton label="Next photo" onClick={next === null ? null : () => setOpen(next)}>
                <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </ArrowButton>
            </span>
          </div>
          {/* Keyed by the photo's file: another photo gets a fresh box holding its own text. */}
          <textarea
            key={picked.photo.src}
            id={altId}
            autoFocus
            rows={2}
            placeholder="Optional: what the photo shows, for screen readers"
            value={picked.photo.alt}
            onChange={(e) => describe(picked.photo.src, e.target.value)}
            className={`${inputClass()} h-auto resize-none py-2 text-[13px] leading-relaxed`}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <TextButton label="Move earlier" onClick={picked.index > 0 ? () => move(picked.photo.src, -1) : null} />
            <TextButton label="Move later" onClick={picked.index < photos.length - 1 ? () => move(picked.photo.src, 1) : null} />
            <button
              type="button"
              onClick={() => remove(picked.photo.src)}
              className={`ml-auto rounded-md text-[13px] text-danger transition-opacity duration-300 ease-out hover:opacity-80 ${CONTENT_FOCUS}`}
            >
              Remove photo
            </button>
          </div>
        </div>
      )}

      {queue.dialog}
      {error !== undefined && <p className="text-[12px] text-danger">{error}</p>}
      <p className="text-[12px] text-prt-muted">Click a photo to describe it for screen readers (optional). The text is kept as you type.</p>
    </>
  );
}

/** A plain text action in the box: Move earlier, Move later; dimmed where it cannot act. */
function TextButton({ label, onClick }: { label: string; onClick: (() => void) | null }) {
  return (
    <button
      type="button"
      disabled={onClick === null}
      onClick={onClick ?? undefined}
      className={`rounded-md text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text disabled:pointer-events-none disabled:opacity-40 ${CONTENT_FOCUS}`}
    >
      {label}
    </button>
  );
}

function ArrowButton({ label, onClick, children }: { label: string; onClick: (() => void) | null; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={onClick === null}
      onClick={onClick ?? undefined}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:pointer-events-none disabled:opacity-40 ${CONTENT_FOCUS}`}
    >
      {children}
    </button>
  );
}
