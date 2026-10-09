import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/about/page-header";
import { Faq } from "@/components/apply/faq";
import { Positions } from "@/components/apply/positions";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { openApplyData } from "@/lib/apply/open";
import { applyPage, applyStats } from "@/lib/apply/page";
import { applyListing, type ApplyListing } from "@/lib/apply/positions";

export const metadata: Metadata = {
  title: "Apply · PoliTo Rocket Team",
  description: applyPage.description,
};

// Boards 34 (5+ positions open), 34c (1 to 4) and 34b (none), with 34m and
// 34bm on phones: the header and its figures (2 x 2 on phones), the
// positions in the state their count picks (applyListing), then the
// questions. The footer sits in the sky, as on the About pages.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          {/* The header's figures and the positions come from one read, so
              they wait for it together and paint together (issue #157).
              Until then the sky under the bar stays empty: a header shown
              first would have the positions pop in under it. */}
          <Suspense fallback={<div aria-hidden="true" className="min-h-svh" />}>
            <LiveApplyContent searchParams={searchParams} />
          </Suspense>
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}

// Positions are read on request only, so `next build` never queries the
// database. With no database configured the page shows the none-open state.
// In dummy mode (lib/apply/pick.ts), `?open=<n>` shows n open positions.
async function LiveApplyContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { open } = await searchParams;
  const data = await openApplyData(typeof open === "string" ? open : null);
  return <ApplyContent listing={applyListing(await data.publicPositions())} />;
}

function ApplyContent({ listing }: { listing: ApplyListing }) {
  return (
    <>
      <PageHeader {...applyPage.header} stats={applyStats(listing)} statsOnPhone="two-by-two" />
      <Positions listing={listing} />
      <Faq />
    </>
  );
}
