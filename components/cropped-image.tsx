import type { CSSProperties } from "react";
import Image, { type ImageProps } from "next/image";
import { placementStyle, type Placement } from "@/lib/photo-crops";

// A stored photo drawn in its box with the crop for the box's shape (epic
// #964, issues #969 and #970): the outreach post page and cards, the landing
// card, the gallery carousel, and a project page's photo panels and launch
// covers draw their photos through it. A photo with no crop
// draws exactly as before, centred and covering its box. With one, the box
// becomes a size container and the photo is placed in it by
// lib/photo-crops.ts, below md by `base` and from md by `md`, so one photo
// shows each shape's crop at the width that shape is shown at.

type Props = Omit<ImageProps, "fill" | "className" | "style"> & {
  /** Where the photo sits below md; null for a photo with no crop. */
  base: Placement | null;
  /** Where it sits from md; the same as below md when absent. */
  md?: Placement | null;
  className?: string;
};

export function CroppedImage({ base, md = base, className = "", alt, ...image }: Props) {
  if (base === null || md === null) return <Image {...image} alt={alt} fill className={`object-cover ${className}`} />;
  const below = placementStyle(base);
  const above = placementStyle(md);
  // The placement is data, which no static class can name; the classes pick
  // the side of md, and the variables carry each side's lengths.
  const vars = {
    "--crop-left": below.left,
    "--crop-top": below.top,
    "--crop-width": below.width,
    "--crop-height": below.height,
    "--crop-md-left": above.left,
    "--crop-md-top": above.top,
    "--crop-md-width": above.width,
    "--crop-md-height": above.height,
  } as CSSProperties;
  return (
    <span className="absolute inset-0 overflow-hidden [container-type:size]">
      <span
        style={vars}
        className="absolute left-[var(--crop-left)] top-[var(--crop-top)] h-[var(--crop-height)] w-[var(--crop-width)] md:left-[var(--crop-md-left)] md:top-[var(--crop-md-top)] md:h-[var(--crop-md-height)] md:w-[var(--crop-md-width)]"
      >
        <Image {...image} alt={alt} fill className={`object-cover ${className}`} />
      </span>
    </span>
  );
}
