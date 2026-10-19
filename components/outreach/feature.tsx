import type { ReactNode } from "react";
import Link from "next/link";
import { CopyText } from "@/components/project-page/parts";
import type { FeaturedCard } from "@/lib/outreach";
import { Photo } from "./photo";

// Boards 32 and 32m, "Featured": the story pinned to the top of the page
// (issue #392), under the summit's line and editions, as one glass card. From
// md the photo fills the left part and the story sits right of it; on phones
// the photo sits on top. The editions close the story. With a post pinned the
// title is the link, and its ::after covers the card, so the whole card opens
// the post, as a post card does; its edge brightens on hover and on keyboard
// focus (.glass-linked). With none pinned the card is the summit alone, with
// nothing to open.
//
// The dashboard's edit shell may `frame` the card (issue #431), as it frames
// each post card; /outreach passes none and draws the card as it is.

/** Wraps the Featured card in the edit shell; `layout` holds the classes that place it in its section. */
export type FeatureFrame = (card: ReactNode, layout: string) => ReactNode;

const FEATURE_LAYOUT = "mx-auto max-w-[1312px]";

export function Feature({ feature, frame }: { feature: FeaturedCard; frame?: FeatureFrame }) {
  const card = (
    <article
      className={`glass-card mx-auto grid max-w-[1312px] overflow-hidden rounded-xl md:grid-cols-[minmax(0,47fr)_minmax(0,53fr)] ${feature.slug === null ? "" : "glass-linked"}`}
    >
      <div className="relative h-[200px] md:h-auto md:min-h-[460px]">
        <Photo photo={feature.photo} sizes="(min-width: 1440px) 620px, (min-width: 768px) 47vw, 100vw" />
      </div>
      <div className="flex flex-col justify-center p-5 md:p-12">
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{feature.eyebrow}</p>
        <h2 className="mt-3 text-[22px] font-bold leading-[1.2] tracking-[-0.02em] md:mt-4 md:text-[34px] md:leading-[1.15]">
          {feature.slug === null ? (
            feature.title
          ) : (
            <Link
              href={`/outreach/${feature.slug}`}
              className="after:absolute after:inset-0 after:z-[2] after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
            >
              {feature.title}
            </Link>
          )}
        </h2>
        <p className="mt-3 text-[14px] leading-[1.6] text-text-2 md:mt-5 md:text-[15px]">
          <CopyText copy={feature.story} />
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 md:mt-8">
          {feature.editions.map((e) => (
            <div key={e.year} className="flex flex-col-reverse">
              <dt className="mt-1 font-mono text-[9px] tracking-[0.15em] text-prt-muted md:text-[10px] md:tracking-[0.2em]">
                {e.place.toUpperCase()}
              </dt>
              <dd className="text-[18px] font-bold leading-none text-prt-text md:text-[22px]">{e.year}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
  return <section className="px-5 pt-section md:px-16">{frame === undefined ? card : frame(card, FEATURE_LAYOUT)}</section>;
}
