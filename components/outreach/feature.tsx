import type { ReactNode } from "react";
import Link from "next/link";
import { CopyText } from "@/components/project-page/parts";
import type { FeaturedCard } from "@/lib/outreach";
import type { UpToTwo } from "@/lib/outreach-types";
import { Photo } from "./photo";

// Boards 32 and 32m, "Featured": the posts featured at the top of the page
// (issue #496), each drawn from the post alone as one glass card. From md the
// photo fills the left part and the post's date and place, title and card
// summary sit right of it; on phones the photo sits on top. The title is the
// link, and its ::after covers the card, so the whole card opens the post, as
// a post card does; its edge brightens on hover and on keyboard focus
// (.glass-linked). Two featured posts stack in the same design. With none
// featured the section is not drawn, and the post list starts the page.
//
// The dashboard's edit shell may `frame` each card (issue #431), as it frames
// each post card; /outreach passes none and draws the cards as they are.

/** Wraps a Featured card in the edit shell; `layout` holds the classes that place it in its section. */
export type FeatureFrame = (card: FeaturedCard, node: ReactNode, layout: string) => ReactNode;

const FEATURE_LAYOUT = "mx-auto max-w-[1312px]";

function FeatureCard({ feature }: { feature: FeaturedCard }) {
  return (
    <article className="glass-card glass-linked mx-auto grid max-w-[1312px] overflow-hidden rounded-xl md:grid-cols-[minmax(0,47fr)_minmax(0,53fr)]">
      <div className="relative h-[200px] md:h-auto md:min-h-[460px]">
        <Photo photo={feature.photo} sizes="(min-width: 1440px) 620px, (min-width: 768px) 47vw, 100vw" />
      </div>
      <div className="flex flex-col justify-center p-5 md:p-12">
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{feature.eyebrow}</p>
        <h2 className="mt-3 text-[22px] font-bold leading-[1.2] tracking-[-0.02em] md:mt-4 md:text-[34px] md:leading-[1.15]">
          <Link
            href={`/outreach/${feature.slug}`}
            className="after:absolute after:inset-0 after:z-[2] after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
          >
            {feature.title}
          </Link>
        </h2>
        <p className="mt-3 text-[14px] leading-[1.6] text-text-2 md:mt-5 md:text-[15px]">
          <CopyText copy={feature.summary} />
        </p>
      </div>
    </article>
  );
}

export function Features({ features, frame }: { features: UpToTwo<FeaturedCard>; frame?: FeatureFrame }) {
  if (features.length === 0) return null;
  return (
    <section aria-label="Featured" className="flex flex-col gap-4 px-5 pt-section md:gap-6 md:px-16">
      {(features as readonly FeaturedCard[]).map((feature) => {
        const card = <FeatureCard feature={feature} />;
        return <div key={feature.slug}>{frame === undefined ? card : frame(feature, card, FEATURE_LAYOUT)}</div>;
      })}
    </section>
  );
}
