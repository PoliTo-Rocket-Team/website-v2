import { Gallery } from "@/components/gallery/gallery";
import type { GallerySection } from "@/lib/project-pages";
import { asIs, SectionHead, type BlockFrame } from "./parts";

// Gallery. Boards 23, 23m, 24 and 24m: the section head on the page column,
// then the carousel across the full width so the neighbours bleed off the
// edges. Its content runs past the column, so `frame` wraps it across the
// page's full width.
export function ProjectGallery({ num, name, gallery, frame = asIs }: { num: string; name: string; gallery: GallerySection; frame?: BlockFrame }) {
  return (
    <section className="pt-14 md:pt-[120px]">
      {frame(
        <>
          <div className="px-5 md:px-16">
            <SectionHead className="mx-auto max-w-[1312px]" num={num} label="GALLERY" title={gallery.title} />
          </div>
          <div className="mt-5 md:mt-8">
            <Gallery items={gallery.items} label={`${name} gallery`} />
          </div>
        </>,
      )}
    </section>
  );
}
