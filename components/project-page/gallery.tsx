import { Gallery } from "@/components/gallery/gallery";
import type { GallerySection } from "@/lib/project-pages";
import { SectionHead } from "./parts";

// Gallery. Boards 23, 23m, 24 and 24m: the section head on the page column,
// then the carousel across the full width so the neighbours bleed off the
// edges.
export function ProjectGallery({ num, name, gallery }: { num: string; name: string; gallery: GallerySection }) {
  return (
    <section className="pt-14 md:pt-[120px]">
      <div className="px-5 md:px-16">
        <SectionHead className="mx-auto max-w-[1312px]" num={num} label="GALLERY" title={gallery.title} />
      </div>
      <div className="mt-5 md:mt-8">
        <Gallery items={gallery.items} label={`${name} gallery`} />
      </div>
    </section>
  );
}
