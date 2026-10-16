"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { discardOutreachPhoto, uploadOutreachPhoto } from "@/app/dashboard/actions";
import { Photo } from "@/components/outreach/photo";
import type { PhotoFields } from "@/lib/outreach-post-fields";
import { CONTENT_FOCUS, useDragOrder } from "./content-parts";
import { inputClass } from "./field";

// The Photos section of the Edit post panel (board 74h, issue #291): the
// post's photos in a grid, the first one the cover and the card photo. Drag
// a photo to move it; click one to write its description for screen readers,
// move it or remove it; Add uploads new ones. A photo is uploaded the moment
// it is picked, so the page beside the panel shows it at once; Save draft or
// Publish puts it on the post. A photo removed before any save used it is
// deleted from the store again.

/** The longest side a picked photo is sent at. Uploaded photos are served as they are, so they are shrunk first. */
const PHOTO_EDGE = 2400;

/** The picked photo turned upright, shrunk to `PHOTO_EDGE` and sent as a JPEG; the file itself when the browser cannot draw it. */
async function shrunkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob === null ? file : new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const TILE = "relative aspect-[16/9] overflow-hidden rounded-lg";

export function PhotosSection({
  photos,
  onChange,
  error,
}: {
  photos: readonly PhotoFields[];
  /** Takes a change to the photos as they are when it lands, so an upload that ends late never undoes an edit. */
  onChange: (change: (photos: readonly PhotoFields[]) => PhotoFields[]) => void;
  error?: string;
}) {
  // Each photo keeps one key while it moves, so the open one stays open.
  const [keys, setKeys] = useState(() => photos.map((_, i) => i));
  const nextKey = useRef(photos.length);
  const [open, setOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const altId = useId();
  const photoOf = new Map(keys.map((key, i) => [key, photos[i]]));

  const reorder = (order: readonly number[]) => {
    setKeys([...order]);
    onChange(() => order.map((key) => photoOf.get(key)!));
  };
  const drag = useDragOrder(keys, reorder);

  const update = (key: number, alt: string) => {
    const src = photoOf.get(key)!.src;
    onChange((list) => list.map((p) => (p.src === src ? { ...p, alt } : p)));
  };
  const remove = (key: number) => {
    const src = photoOf.get(key)!.src;
    setKeys((list) => list.filter((k) => k !== key));
    onChange((list) => list.filter((p) => p.src !== src));
    setOpen(null);
    // The server keeps the file while a stored version of a post shows it.
    void discardOutreachPhoto(src);
  };
  const move = (key: number, by: -1 | 1) => {
    const at = keys.indexOf(key);
    const order = [...keys];
    [order[at], order[at + by]] = [order[at + by], order[at]];
    reorder(order);
  };

  const add = async (files: readonly File[]) => {
    setUploading((n) => n + files.length);
    let first = true;
    for (const file of files) {
      const form = new FormData();
      form.set("photo", await shrunkPhoto(file));
      const result = await uploadOutreachPhoto(form);
      setUploading((n) => n - 1);
      if (!result.ok) {
        toast.error(result.error);
        continue;
      }
      const key = nextKey.current++;
      setKeys((list) => [...list, key]);
      onChange((list) => [...list, { src: result.value, alt: "" }]);
      // The first new photo opens, so its description is the next thing to write.
      if (first) setOpen(key);
      first = false;
    }
  };

  const openIndex = open === null ? -1 : keys.indexOf(open);
  const opened = open === null ? undefined : photoOf.get(open);

  return (
    <>
      <p className="text-[12px] text-prt-muted">The first is the top photo and the card photo. Drag to reorder.</p>
      <ul className="grid grid-cols-3 gap-2" {...drag.list}>
        {drag.order.map((key, index) => {
          const photo = photoOf.get(key)!;
          const row = drag.row(key, index);
          const undescribed = error !== undefined && photo.alt.trim() === "";
          return (
            <li
              key={key}
              draggable
              onDragStart={row.onDragStart}
              onDragOver={row.onDragOver}
              onDragEnd={row.onDragEnd}
              className={`${TILE} cursor-grab ${row.dragged ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                aria-pressed={open === key}
                aria-label={`Photo ${index + 1}${index === 0 ? ", the cover" : ""}: ${photo.alt.trim() || "no description yet"}`}
                onClick={() => setOpen(open === key ? null : key)}
                className={`absolute inset-0 rounded-lg ${CONTENT_FOCUS}`}
              >
                <Photo photo={{ src: photo.src, alt: "" }} sizes="140px" />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-lg border transition-colors duration-300 ease-out ${
                    open === key ? "border-2 border-accent" : undescribed ? "border-danger" : "border-transparent hover:border-border-strong"
                  }`}
                />
              </button>
              {index === 0 && (
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
        <li className={TILE}>
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
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            aria-label="Add photos"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length > 0) void add(files);
            }}
          />
        </li>
      </ul>

      {opened !== undefined && open !== null && (
        <div className="space-y-2.5 rounded-[10px] border border-accent bg-white-5/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={altId} className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
              Photo {openIndex + 1}
              {openIndex === 0 && " · cover"}
            </label>
            <span className="flex items-center gap-1">
              <MoveButton label="Move earlier" onClick={openIndex > 0 ? () => move(open, -1) : null}>
                <ChevronLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </MoveButton>
              <MoveButton label="Move later" onClick={openIndex < keys.length - 1 ? () => move(open, 1) : null}>
                <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </MoveButton>
            </span>
          </div>
          <textarea
            id={altId}
            autoFocus
            rows={2}
            placeholder="What the photo shows, for screen readers"
            value={opened.alt}
            aria-invalid={error !== undefined && opened.alt.trim() === ""}
            onChange={(e) => update(open, e.target.value)}
            className={`${inputClass()} h-auto resize-none py-2 text-[13px] leading-relaxed`}
          />
          <button
            type="button"
            onClick={() => remove(open)}
            className={`rounded-md text-[13px] text-danger transition-opacity duration-300 ease-out hover:opacity-80 ${CONTENT_FOCUS}`}
          >
            Remove photo
          </button>
        </div>
      )}

      {error !== undefined && <p className="text-[12px] text-danger">{error}</p>}
      <p className="text-[12px] text-prt-muted">Click a photo to add a short description for screen readers.</p>
    </>
  );
}

function MoveButton({ label, onClick, children }: { label: string; onClick: (() => void) | null; children: ReactNode }) {
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
