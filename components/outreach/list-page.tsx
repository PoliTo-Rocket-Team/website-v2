import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import type { HeaderStats } from "@/lib/about/types";
import { outreachCopy, type FeaturedCard } from "@/lib/outreach";
import { siteFooterOf, type PageChrome } from "@/lib/page-chrome";
import { Feature, type FeatureFrame } from "./feature";
import type { PostCardData } from "./post-card";
import { Posts, type PostCardFrame } from "./posts";

// Boards 32 (desktop) and 32m (phone): the whole Outreach page, as /outreach
// shows it and as the dashboard's edit shell shows it with the post being
// edited in place (issue #294): `frame` wraps each post card and `keepInView`
// is the card the list must not hide behind "Show N more". The header and its
// figures (2 x 2 on phones), the Featured card, then the post cards. No
// apply band on this page (issue #110). The editor draws it with no navbar
// and no footer (`chrome="none"`, issue #495).
export function OutreachListPage(
  props: {
    stats: HeaderStats;
    /** The Featured card: the pinned post, or the summit alone (issue #392). */
    feature: FeaturedCard;
    /** Newest first. */
    cards: readonly PostCardData[];
    frame?: PostCardFrame;
    /** Wraps the Featured card in the edit shell (issue #431); /outreach passes none. */
    featureFrame?: FeatureFrame;
    keepInView?: PostCardData;
  } & PageChrome,
) {
  const { stats, feature, cards, frame, featureFrame, keepInView } = props;
  const footer = siteFooterOf(props);
  return (
    <div className="relative bg-ground">
      {footer !== null && <LandingNavbar />}
      <PageSky>
        <main className={footer !== null ? "pb-section pt-16 md:pt-[72px]" : "pb-section"}>
          <PageHeader {...outreachCopy.header} stats={stats} statsOnPhone="two-by-two" />
          <Feature feature={feature} frame={featureFrame} />
          <Posts title={outreachCopy.postsTitle} posts={cards} frame={frame} keepInView={keepInView} />
        </main>
        {footer !== null && <LandingFooter inSky projects={footer} />}
      </PageSky>
    </div>
  );
}
