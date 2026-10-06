import { Gallery } from "@/components/gallery/gallery";
import { isFilled } from "@/components/gallery/items";
import { galleryItems } from "./data";
import { SectionHead } from "./parts";

// 05 Gallery. Boards 23 and 23m: the section head on the page column, then
// the carousel across the full width so the neighbours bleed off the edges.
export function CavourGallery() {
  if (!isFilled(galleryItems)) return null;
  return (
    <section className="pt-14 md:pt-[120px]">
      <div className="px-5 md:px-16">
        <SectionHead className="mx-auto max-w-[1312px]" eyebrow="05 – GALLERY" title="From the workshop to the pad." />
      </div>
      <div className="mt-5 md:mt-8">
        <Gallery items={galleryItems} label="Cavour gallery" />
      </div>
    </section>
  );
}
