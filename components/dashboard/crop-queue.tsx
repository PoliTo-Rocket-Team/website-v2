"use client";

import { useRef, useState, type ReactNode } from "react";
import type { CropsEntry, ShapeCrops } from "@/lib/dashboard/crop-settings";
import { cancelQueue, currentFile, nextInQueue, NO_QUEUE, queueOf, queuePosition, type CropQueue } from "@/lib/dashboard/crop-queue";
import { CropDialog } from "./crop-dialog";

// The shared crop of a photo pick (epic #964, issue #969): the place's crop
// dialog opens on each picked file in turn, with Skip for one file and
// Cancel for the rest. Each cropped file goes to the place at once, so it
// can upload while the editor crops the next.

/** The longest side a picked photo is sent at where its place has no crop entry. Uploaded photos are served as they are, so they are shrunk first. */
const PHOTO_EDGE = 2400;

/** The picked photo turned upright, shrunk to `PHOTO_EDGE` and sent as a JPEG; the file itself when the browser cannot draw it. */
export async function shrunkPhoto(file: File): Promise<File> {
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

/** A photo ready to upload: the file and its crop for each shape the editor framed (none where the place has no crop entry). */
export type CroppedPhoto<N extends string> = { readonly file: File; readonly crops: ShapeCrops<N> };

/**
 * A place's pick: `pick` opens the dialog on the first of `files`, and
 * `dialog` is the dialog to render. A place with no crop entry yet (`null`)
 * draws no dialog, and hands each picked file on shrunk, with no crop.
 */
export function useCropQueue<N extends string>(
  entry: CropsEntry<N> | null,
  onCropped: (photo: CroppedPhoto<N>) => void,
): { pick: (files: readonly File[]) => void; dialog: ReactNode } {
  const [queue, setQueue] = useState<CropQueue<File>>(NO_QUEUE);
  if (entry === null) {
    const pick = async (files: readonly File[]) => {
      for (const file of files) onCropped({ file: await shrunkPhoto(file), crops: {} });
    };
    return { pick: (files) => void pick(files), dialog: null };
  }
  const dialog = (
    <CropDialog
      entry={entry}
      file={currentFile(queue)}
      pending={false}
      onCancel={() => setQueue(cancelQueue)}
      queue={{ ...queuePosition(queue), onSkip: () => setQueue(nextInQueue) }}
      onDone={(result) => {
        setQueue(nextInQueue);
        onCropped(result as CroppedPhoto<N>);
      }}
    />
  );
  return { pick: (files) => setQueue(queueOf(files)), dialog };
}

/** Runs each task after the one before it ends, so photos uploaded one by one land in the order they were picked. */
export function useInOrder(): (task: () => Promise<void>) => void {
  const last = useRef<Promise<void>>(Promise.resolve());
  return (task) => {
    last.current = last.current.then(task, task);
  };
}
