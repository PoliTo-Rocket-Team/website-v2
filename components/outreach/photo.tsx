import Image from "next/image";
import { MarkFallback } from "@/components/mark-fallback";
import type { OutreachPhoto } from "@/lib/outreach-types";
import { outreachBlur } from "./outreach-blur";

// An outreach photo filling its frame (the frame sets the size and the
// corners), with its inline preview while it loads when the blur map has one.
// A draft may have no photo yet (board 74f): the frame then shows an empty
// tint with the PRT mark (issue #366), so the editor's cards and list keep
// their shape.
export function Photo({
  photo,
  sizes,
  priority = false,
  className = "",
}: {
  photo: OutreachPhoto | undefined;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (photo === undefined)
    return (
      <span aria-hidden className={`absolute inset-0 bg-white-5 ${className}`}>
        <MarkFallback fit="frame" />
      </span>
    );
  const blur = outreachBlur[photo.src];
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes={sizes}
      priority={priority}
      // An uploaded photo (the public store, or a preview's data URL) is served as it is, as Team photos are.
      unoptimized={!photo.src.startsWith("/")}
      {...(blur !== undefined ? { placeholder: "blur" as const, blurDataURL: blur } : {})}
      className={`object-cover ${className}`}
    />
  );
}
