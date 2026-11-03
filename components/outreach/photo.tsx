import { CroppedImage } from "@/components/cropped-image";
import { MarkFallback } from "@/components/mark-fallback";
import { placementOf, POST_PHOTO, type BoxFit, type PostPhotoShape } from "@/lib/photo-crops";
import type { OutreachPhoto } from "@/lib/outreach-types";
import { outreachBlur } from "./outreach-blur";

// An outreach photo filling its frame (the frame sets the size and the
// corners), with its inline preview while it loads when the blur map has one.
// A draft may have no photo yet (board 74f): the frame then shows an empty
// tint with the PRT mark (issue #366), so the editor's cards and list keep
// their shape. A photo with crops (issue #969) shows the crop for its frame's
// shape: `fit` names the shape below md and from md, and whether the frame
// is that shape exactly; a card's frame, whose shape moves with the page,
// keeps the laptop crop's centre by default.

/** Which crop a frame shows below md and from md. */
export type PhotoFit = { readonly base: BoxFit<PostPhotoShape>; readonly md?: BoxFit<PostPhotoShape> };

/** A frame whose shape moves with the page, as a card's: the laptop crop's centre, at every width. */
export const CARD_FIT: PhotoFit = { base: { shape: "desktop", box: "fluid" } };

export function Photo({
  photo,
  sizes,
  priority = false,
  className = "",
  fit = CARD_FIT,
}: {
  photo: OutreachPhoto | undefined;
  sizes: string;
  priority?: boolean;
  className?: string;
  fit?: PhotoFit;
}) {
  if (photo === undefined)
    return (
      <span aria-hidden className={`absolute inset-0 bg-white-5 ${className}`}>
        <MarkFallback fit="frame" />
      </span>
    );
  const blur = outreachBlur[photo.src];
  return (
    <CroppedImage
      base={placementOf(POST_PHOTO, photo.crops, fit.base)}
      md={placementOf(POST_PHOTO, photo.crops, fit.md ?? fit.base)}
      src={photo.src}
      alt={photo.alt}
      sizes={sizes}
      priority={priority}
      // An uploaded photo (the public store, or a preview's data URL) is served as it is, as Team photos are.
      unoptimized={!photo.src.startsWith("/")}
      {...(blur !== undefined ? { placeholder: "blur" as const, blurDataURL: blur } : {})}
      className={className}
    />
  );
}
