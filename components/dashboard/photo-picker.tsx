"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { PHOTO_ACCEPT, PhotoCropDialog } from "./photo-crop-dialog";

// Pick a photo and crop it square (the member photo's flow, board 61g),
// shared by the Alumni panels (issue #257) and the Team page editor's
// Replace photo (issue #323).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The accent text button that picks a photo ("Replace photo", "Upload photo"), as the Alumni panels draw it. */
export const PHOTO_BUTTON = `inline-flex items-center gap-1.5 rounded-md text-[14px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;

/** A file input kept off screen, its button, and the square crop it opens. */
export function PhotoPicker({
  label,
  pending,
  onCropped,
  buttonClass = PHOTO_BUTTON,
  iconClass = "h-4 w-4",
}: {
  label: string;
  pending: boolean;
  /** The cropped square; true closes the crop. */
  onCropped: (square: File) => Promise<boolean> | boolean;
  /** The button's look where a panel draws its links smaller. */
  buttonClass?: string;
  iconClass?: string;
}) {
  const [cropping, setCropping] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) setCropping(file);
        }}
      />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className={buttonClass}>
        <Upload aria-hidden className={iconClass} strokeWidth={1.75} />
        {label}
      </button>
      <PhotoCropDialog
        file={cropping}
        onOpenChange={(next) => !next && setCropping(null)}
        onChooseAnother={() => input.current?.click()}
        onSave={async (square) => {
          if (await onCropped(square)) setCropping(null);
        }}
        pending={pending}
      />
    </>
  );
}
