import type { ReactNode } from "react";
import { PageHeader } from "@/components/about/page-header";
import { Faq } from "@/components/apply/faq";
import { Positions } from "@/components/apply/positions";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { applyPage, applyStats } from "@/lib/apply/page";
import type { ApplyListing } from "@/lib/apply/positions";

// Boards 34 (5+ positions open), 34c (1 to 4) and 34b (none), with 34m and
// 34bm on phones: the header and its figures (2 x 2 on phones), the
// positions in the state their count picks (applyListing), then the
// questions. The footer sits in the sky, as on the About pages. Both /apply
// routes draw it: the prerendered page and its dummy-state twin.

/** The navbar, the sky and the footer around the page's content. */
export function ApplyFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">{children}</main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}

/** The header and its figures, the positions and the questions, from one listing. */
export function ApplyContent({ listing }: { listing: ApplyListing }) {
  return (
    <>
      <PageHeader {...applyPage.header} stats={applyStats(listing)} statsOnPhone="two-by-two" />
      <Positions listing={listing} />
      <Faq />
    </>
  );
}
