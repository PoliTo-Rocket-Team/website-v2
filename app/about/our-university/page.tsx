import type { Metadata } from "next";
import { PageHeader } from "@/components/about/page-header";
import { EntrancePhoto, Politecnico, Support } from "@/components/about/university";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { university } from "@/lib/about/university";

export const metadata: Metadata = {
  title: "Our University · PoliTo Rocket Team",
  description: university.description,
};

// Boards 30 (desktop) and 30m (phone): the header and its figures (2 x 2 on
// phones), the entrance photo, Politecnico and how it supports the team, all
// drawn from one record (lib/about/university.ts). No apply band on this
// page (Huey's ruling, issue #103).
export default function OurUniversityPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...university.header} statsOnPhone="two-by-two" />
          <EntrancePhoto photo={university.photo} />
          <Politecnico politecnico={university.politecnico} />
          <Support support={university.support} />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
