import type { Metadata } from "next";
import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { Feature } from "@/components/outreach/feature";
import type { PostCardData } from "@/components/outreach/post-card";
import { Posts } from "@/components/outreach/posts";
import { monthYear, newestFirst, outreachCopy, outreachStats, postYears, slugOf, yearOf } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";

export const metadata: Metadata = {
  title: "Outreach · PoliTo Rocket Team",
  description: outreachCopy.description,
};

// Boards 32 (desktop) and 32m (phone): the header and its figures (2 x 2 on
// phones), the summit we started, then every published post as a card, read
// from the store (issue #287, lib/outreach-public.ts). No apply band on this
// page (issue #110).
export default async function OutreachPage() {
  const content = await publishedOutreach();
  const cards: PostCardData[] = newestFirst(content.posts).map((p) => ({
    slug: slugOf(p),
    year: yearOf(p.date),
    date: monthYear(p.date),
    title: p.title,
    summary: p.summary,
    photo: p.photos[0],
  }));
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...outreachCopy.header} stats={outreachStats(content)} statsOnPhone="two-by-two" />
          <Feature feature={content.feature} />
          <Posts title={outreachCopy.postsTitle} posts={cards} years={postYears(content.posts)} />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
