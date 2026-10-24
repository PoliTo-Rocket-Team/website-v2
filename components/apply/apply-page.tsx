import type { ReactNode } from "react";
import { PageHeader } from "@/components/about/page-header";
import { Faq as FaqSection } from "@/components/apply/faq";
import { Positions } from "@/components/apply/positions";
import { SiteFooter } from "@/components/landing/site-footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { applyPage, applyStats, type Faq } from "@/lib/apply/page";
import type { ApplyListing } from "@/lib/apply/positions";

// Boards 34 (one or more positions open) and 34b (none), with 34m and 34bm
// on phones: the header and its figures (2 x 2 on phones), the positions
// in the state the listing picks (applyListing), then the
// questions. The footer sits in the sky, as on the About pages.

/** The navbar, the sky and the footer around the page's content. */
export function ApplyFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">{children}</main>
        <SiteFooter inSky />
      </PageSky>
    </div>
  );
}

/** The header and its figures and the positions, from one listing, then the published questions. */
export function ApplyContent({ listing, faqs }: { listing: ApplyListing; faqs: readonly Faq[] }) {
  return (
    <>
      <PageHeader {...applyPage.header} stats={applyStats(listing)} statsOnPhone="two-by-two" />
      <Positions listing={listing} />
      <FaqSection faqs={faqs} />
    </>
  );
}
