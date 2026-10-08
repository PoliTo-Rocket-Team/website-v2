import Image from "next/image";
import type { OutreachPhoto } from "@/lib/outreach-types";
import { outreachBlur } from "./outreach-blur";

// An outreach photo filling its frame (the frame sets the size and the
// corners), with its inline preview while it loads.
export function Photo({
  photo,
  sizes,
  priority = false,
  className = "",
}: {
  photo: OutreachPhoto;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const blur = outreachBlur[photo.src];
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes={sizes}
      priority={priority}
      {...(blur !== undefined ? { placeholder: "blur" as const, blurDataURL: blur } : {})}
      className={`object-cover ${className}`}
    />
  );
}
