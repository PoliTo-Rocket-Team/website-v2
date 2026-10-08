import type { Metadata } from "next";
import { PageHeader } from "@/components/about/page-header";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { BecomePartner } from "@/components/partners/become-partner";
import { PartnerCard } from "@/components/partners/partner-card";
import { partnerStats, partnersOf, partnersPage, type Partner } from "@/lib/partners";

export const metadata: Metadata = {
  title: "Partners · PoliTo Rocket Team",
  description: partnersPage.description,
};

// Boards 31 (desktop), 31b (the card at rest and on hover) and 31m (phone):
// the header and its figures (2 x 2 on phones), the main partners in three
// columns, the media partners, then "Become a partner". Every partner comes
// from lib/partners.ts, the record the landing logo strip reads too. No
// apply band on this page (issue #107): the footer sits in the sky.
export default function PartnersPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...partnersPage.header} stats={partnerStats()} statsOnPhone="two-by-two" />
          <PartnerGroup title={partnersPage.mainTitle} partners={partnersOf("main")} />
          <PartnerGroup title={partnersPage.mediaTitle} partners={partnersOf("media")} />
          <BecomePartner />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}

/** A centred heading over the cards: three columns from lg, centred when a row is short, one column on phones. */
function PartnerGroup({ title, partners }: { title: string; partners: readonly Partner[] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <h2 className="text-center text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[40px]">{title}</h2>
        <ul className="mt-6 flex flex-wrap justify-center gap-3.5 md:mt-10 md:gap-x-6 md:gap-y-10">
          {partners.map((partner) => (
            <li key={partner.name} className="flex w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]">
              <PartnerCard partner={partner} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
