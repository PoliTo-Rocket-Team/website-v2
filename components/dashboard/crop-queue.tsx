"use client";

import { useRef, useState, type ReactNode } from "react";
import type { CropsEntry, ShapeCrops } from "@/lib/dashboard/crop-settings";
import { cancelQueue, currentFile, nextInQueue, NO_QUEUE, queueOf, queuePosition, type CropQueue } from "@/lib/dashboard/crop-queue";
import { CropDialog } from "./crop-dialog";

// The shared crop of a photo pick (epic #964, issue #969): the place's crop
// dialog opens on each picked file in turn, with Skip for one file and
// Cancel for the rest. Each cropped file goes to the place at once, so it
// can upload while the editor crops the next.

/** A photo ready to upload: the file and its crop for each shape the editor framed. */
export type CroppedPhoto<N extends string> = { readonly file: File; readonly crops: ShapeCrops<N> };

/**
 * A place's pick: `pick` opens the place's crop dialog on the first of
 * `files`, and `dialog` is the dialog to render.
 */
export function useCropQueue<N extends string>(
  entry: CropsEntry<N>,
  onCropped: (photo: CroppedPhoto<N>) => void,
): { pick: (files: readonly File[]) => void; dialog: ReactNode } {
  const [queue, setQueue] = useState<CropQueue<File>>(NO_QUEUE);
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
