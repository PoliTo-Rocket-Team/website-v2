import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { HomeProjectCard } from "@/components/landing/project-card";
import { ProjectHero } from "@/components/project-page/hero";
import { importedRecords } from "@/lib/project-content/import";
import { homeCardOf, pageRecordOf } from "@/lib/project-content/record";
import { samplePagesOn } from "@/lib/sample-pages";

export const metadata: Metadata = {
  title: "Efesto engine · PoliTo Rocket Team",
  robots: { index: false },
};

// Efesto's outline engine (issue #382): its home card and its page hero,
// drawn by the same components as the real pages, from Efesto's record as
// the migrations leave it (lib/project-content/import.ts). It reads no
// database, so a preview shows the engine whatever its seeded database holds
// (lib/sample-pages.ts). In production the route does not exist.

const EFESTO = 2; // its place in the site order, from 0

export default function EfestoEnginePreview() {
  if (!samplePagesOn()) notFound();
  const record = importedRecords[EFESTO];
  const card = homeCardOf(record, EFESTO);
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section">
          <ProjectHero project={{ index: card.num, name: card.name, texture: card.texture }} hero={pageRecordOf(record).hero} />
          <section className="px-5 pt-section md:px-16">
            {/* A flex row, as the home row is: the card's width is a share of the row's. */}
            <div className="mx-auto flex max-w-[1312px] gap-4">
              <HomeProjectCard project={card} />
            </div>
          </section>
        </main>
      </PageSky>
    </div>
  );
}
