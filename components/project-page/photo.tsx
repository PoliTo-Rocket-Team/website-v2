import { CroppedImage } from "@/components/cropped-image";
import { placementOf, PROJECT_PHOTO } from "@/lib/photo-crops";
import type { Photo } from "@/lib/project-pages";
import { BlockColumn, type BlockFrame } from "./parts";

// A Photo block (board 93b): one wide photo across the page's column, in the
// hero panel's frame, with its caption under it.

/** The panel's width moves with the page at a fixed height, so each shape's crop covers it at its zoom (lib/photo-crops.ts). */
const PHONE_PANEL = { shape: "phone", box: "framed" } as const;
const LAPTOP_PANEL = { shape: "desktop", box: "framed" } as const;

/**
 * An uploaded photo filling a project page's photo panel, the Photo block's
 * or the top's (components/project-page/hero.tsx), with its crop for the
 * phone shape below md and the laptop shape from md (issue #970). A photo
 * from the public store, or a preview's data URL, is served as it is, as
 * Outreach photos are.
 */
export function ProjectPhotoFill({ photo, priority = false }: { photo: Photo; priority?: boolean }) {
  return (
    <CroppedImage
      base={placementOf(PROJECT_PHOTO, photo.crops, PHONE_PANEL)}
      md={placementOf(PROJECT_PHOTO, photo.crops, LAPTOP_PANEL)}
      src={photo.src}
      alt={photo.alt}
      priority={priority}
      sizes="(min-width: 768px) 1312px, 100vw"
      unoptimized={!photo.src.startsWith("/")}
    />
  );
}

export function ProjectPhoto({ photo, caption, frame }: { photo: Photo; caption: string; frame?: BlockFrame }) {
  return (
    <BlockColumn frame={frame}>
      <figure>
        <div className="relative h-[220px] overflow-hidden rounded-2xl md:h-[620px]">
          <ProjectPhotoFill photo={photo} />
        </div>
        <figcaption className="mt-3 font-mono text-[10px] tracking-[0.2em] text-prt-muted md:mt-4 md:text-[11px]">{caption}</figcaption>
      </figure>
    </BlockColumn>
  );
}
