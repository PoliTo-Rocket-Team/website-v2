import type { Metadata } from "next";
import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { Feature } from "@/components/outreach/feature";
import type { PostCardData } from "@/components/outreach/post-card";
import { Posts } from "@/components/outreach/posts";
import { monthYear, outreach, outreachStats, postsNewestFirst, postYears, slugOf, yearOf } from "@/lib/outreach";

export const metadata: Metadata = {
  title: "Outreach · PoliTo Rocket Team",
  description: outreach.description,
};

// Boards 32 (desktop) and 32m (phone): the header and its figures (2 x 2 on
// phones), the summit we started, then every post as a card, all drawn from
// one record (lib/outreach.ts). No apply band on this page (issue #110).
export default function OutreachPage() {
  const cards: PostCardData[] = postsNewestFirst.map((p) => ({
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
          <PageHeader {...outreach.header} stats={outreachStats()} statsOnPhone="two-by-two" />
          <Feature feature={outreach.feature} />
          <Posts title={outreach.postsTitle} posts={cards} years={postYears()} />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
