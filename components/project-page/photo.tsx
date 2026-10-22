import Image from "next/image";
import type { Photo } from "@/lib/project-pages";

// A Photo block (board 93b): one wide photo across the page's column, in the
// hero panel's frame, with its caption under it.
export function ProjectPhoto({ photo, caption }: { photo: Photo; caption: string }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <figure className="mx-auto max-w-[1312px]">
        <div className="relative h-[220px] overflow-hidden rounded-2xl md:h-[620px]">
          {/* An uploaded photo (the public store, or a preview's data URL) is served as it is, as Outreach photos are. */}
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 768px) 1312px, 100vw" unoptimized={!photo.src.startsWith("/")} className="object-cover" />
        </div>
        <figcaption className="mt-3 font-mono text-[10px] tracking-[0.2em] text-prt-muted md:mt-4 md:text-[11px]">{caption}</figcaption>
      </figure>
    </section>
  );
}
