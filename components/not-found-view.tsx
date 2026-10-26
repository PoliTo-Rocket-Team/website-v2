import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Board 103d (issue #328): the not-found view the dashboard and the public site
// share. Text only, centred: the "404" eyebrow, "Off the trajectory.", a line of
// body and a paper pill back. Behind it the arc brand texture of the Latest
// news cards at 60%, under a radial dark fade so the centre text stays
// readable. The texture's bottom edge is a light strip: the texture layer runs
// past the frame's bottom so the strip is cropped, and a bottom fade to the
// ground colour (transparent from 75% of the height) leaves no light band at
// the end of the frame. Only the body and the button differ by where it shows,
// and the frame's size is the caller's (`className`).
export function NotFoundView({
  body,
  back,
  className = "",
}: {
  body: string;
  back: { label: string; href: string };
  className?: string;
}) {
  return (
    <section className={`relative isolate flex items-center justify-center overflow-hidden bg-ground px-5 ${className}`}>
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[106%]">
        <Image src="/design/news/tex-arc.jpg" alt="" fill sizes="100vw" className="object-cover object-top opacity-60" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,theme(colors.ground)_0%,transparent_100%)] opacity-90"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent from-75% to-ground" />

      <div className="flex max-w-[480px] flex-col items-center text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-accent">404</p>
        <h1 className="mt-3 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[34px]">Off the trajectory.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-2">{body}</p>
        <Link
          href={back.href}
          className="mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-prt-text px-5 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          {back.label}
        </Link>
      </div>
    </section>
  );
}
