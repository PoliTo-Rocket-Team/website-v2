// A pick of several photos, cropped one at a time in the crop dialog (epic
// #964, issue #969). The dialog shows the queue's current file; cropping it
// or skipping it moves on to the next, and Cancel stops the rest. Skip and
// Cancel upload nothing; a cropped file is the place's to upload.

/** The picked files in order, and how far the editor has got through them. */
export type CropQueue<F> = { readonly files: readonly F[]; readonly at: number };

/** No pick in progress. */
export const NO_QUEUE: CropQueue<never> = { files: [], at: 0 };

/** A new pick: its first file is the one to crop. */
export const queueOf = <F>(files: readonly F[]): CropQueue<F> => ({ files, at: 0 });

/** The file the dialog shows, or null once every file is cropped, skipped or cancelled. */
export const currentFile = <F>(queue: CropQueue<F>): F | null => queue.files[queue.at] ?? null;

/** Where the current file is in the pick, from 1, and how many were picked. */
export const queuePosition = (queue: CropQueue<unknown>) => ({ position: queue.at + 1, count: queue.files.length });

/** The queue past its current file, which was cropped or skipped. */
export const nextInQueue = <F>(queue: CropQueue<F>): CropQueue<F> => ({ files: queue.files, at: Math.min(queue.at + 1, queue.files.length) });

/** The queue with the rest of the pick dropped: Cancel. */
export const cancelQueue = <F>(queue: CropQueue<F>): CropQueue<F> => ({ files: queue.files, at: queue.files.length });
