import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { outreachCopy, type FeaturedCard, type OutreachStats } from "@/lib/outreach";
import type { UpToTwo } from "@/lib/outreach-types";
import { siteFooterOf, type PageChrome } from "@/lib/page-chrome";
import { Features, type FeatureFrame } from "./feature";
import type { PostCardData } from "./post-card";
import { Posts, type PostCardFrame } from "./posts";

// Boards 32 (desktop) and 32m (phone): the whole Outreach page, as /outreach
// shows it and as the dashboard's edit shell shows it with the post being
// edited in place (issue #294): `frame` wraps each post card and `keepInView`
// is the card the list must not hide behind "Show N more". The header and its
// two figures (events and awards, issue #496), the Featured cards, then the
// post cards. No apply band on this page (issue #110). The editor draws it
// with no navbar and no footer (`chrome="none"`, issue #495).
export function OutreachListPage(
  props: {
    stats: OutreachStats;
    /** The featured posts' cards (issue #496): none, one, or two stacked. */
    features: UpToTwo<FeaturedCard>;
    /** Newest first. */
    cards: readonly PostCardData[];
    frame?: PostCardFrame;
    /** Wraps each Featured card in the edit shell (issue #431); /outreach passes none. */
    featureFrame?: FeatureFrame;
    keepInView?: PostCardData;
  } & PageChrome,
) {
  const { stats, features, cards, frame, featureFrame, keepInView } = props;
  const footer = siteFooterOf(props);
  return (
    <div className="relative bg-ground">
      {footer !== null && <LandingNavbar />}
      <PageSky>
        <main className={footer !== null ? "pb-section pt-16 md:pt-[72px]" : "pb-section"}>
          <PageHeader {...outreachCopy.header} stats={stats} statsOnPhone="two-by-two" />
          <Features features={features} frame={featureFrame} />
          <Posts title={outreachCopy.postsTitle} posts={cards} frame={frame} keepInView={keepInView} />
        </main>
        {footer !== null && <LandingFooter inSky projects={footer} />}
      </PageSky>
    </div>
  );
}
