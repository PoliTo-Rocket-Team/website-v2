import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/about/page-header";
import { Faq } from "@/components/apply/faq";
import { Positions } from "@/components/apply/positions";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { getPublicPositions } from "@/app/actions/get-apply-positions";
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
export default function ApplyPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          {/* Until the read answers, the header shows without its figures:
              a count shown early would be a guess. */}
          <Suspense fallback={<PageHeader {...applyPage.header} />}>
            <LiveApplyContent />
          </Suspense>
          <Faq />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}

// Positions are read on request only, so `next build` never queries the
// database. With no database configured the page shows the none-open state.
async function LiveApplyContent() {
  await connection();
  const result = await getPublicPositions();
  const positions = result.status === "available" ? result.positions : [];
  return <ApplyContent listing={applyListing(positions)} />;
}

function ApplyContent({ listing }: { listing: ApplyListing }) {
  return (
    <>
      <PageHeader {...applyPage.header} stats={applyStats(listing)} statsOnPhone="two-by-two" />
      <Positions listing={listing} />
    </>
  );
}
