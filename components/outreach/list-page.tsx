import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import type { HeaderStats } from "@/lib/about/types";
import type { FooterProject } from "@/lib/landing-links";
import { outreachCopy, type FeaturedCard } from "@/lib/outreach";
import { Feature } from "./feature";
import type { PostCardData } from "./post-card";
import { Posts, type PostCardFrame } from "./posts";

// Boards 32 (desktop) and 32m (phone): the whole Outreach page, as /outreach
// shows it and as the dashboard's edit shell shows it with the post being
// edited in place (issue #294): `frame` wraps each post card and `keepInView`
// is the card the list must not hide behind "Show N more". The header and its
// figures (2 x 2 on phones), the Featured card, then the post cards. No
// apply band on this page (issue #110).
export function OutreachListPage({
  stats,
  feature,
  cards,
  years,
  footerProjects,
  frame,
  keepInView,
}: {
  stats: HeaderStats;
  /** The Featured card: the pinned post, or the summit alone (issue #392). */
  feature: FeaturedCard;
  /** Newest first. */
  cards: readonly PostCardData[];
  years: readonly number[];
  /** The published projects the footer lists (issue #378). */
  footerProjects: readonly FooterProject[];
  frame?: PostCardFrame;
  keepInView?: PostCardData;
}) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...outreachCopy.header} stats={stats} statsOnPhone="two-by-two" />
          <Feature feature={feature} />
          <Posts title={outreachCopy.postsTitle} posts={cards} years={years} frame={frame} keepInView={keepInView} />
        </main>
        <LandingFooter inSky projects={footerProjects} />
      </PageSky>
    </div>
  );
}
