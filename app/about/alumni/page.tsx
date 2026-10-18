import type { Metadata } from "next";
import { Suspense } from "react";
import { Founders } from "@/components/about/alumni/founders";
import { YearByYear } from "@/components/about/alumni/year-by-year";
import { PageHeader } from "@/components/about/page-header";
import { ApplyBand } from "@/components/landing/apply-band";
import { SiteFooter } from "@/components/landing/site-footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { alumni } from "@/lib/about/alumni";
import { alumniPageData } from "@/lib/about/alumni-data";
import type { AcademicYear, NonEmpty } from "@/lib/about/alumni-types";
import { foundersIntro, headerStats, selectedYear, yearSlug } from "@/lib/about/alumni-year";

export const metadata: Metadata = {
  title: "Alumni · PoliTo Rocket Team",
  description: alumni.description,
};

// Board 28 (desktop) and the Team page's phone patterns: the header and its
// figures, the founders, then everyone year by year, one academic year at a
// time. Who it lists is built from the team's roles, the imported early years
// and the dashboard's fixes (lib/about/alumni-data.ts, issue #257); the
// copy is lib/about/alumni.ts.

type SearchParams = Promise<{ year?: string | string[] }>;

function Years({ years, initial }: { years: NonEmpty<AcademicYear>; initial: string }) {
  return <YearByYear eyebrow={alumni.years.eyebrow} title={alumni.years.title} years={years} initial={initial} />;
}

/** The year ?year= names, so a shared link opens on it. */
async function YearsFromUrl({ years, searchParams }: { years: NonEmpty<AcademicYear>; searchParams: SearchParams }) {
  const { year } = await searchParams;
  return <Years years={years} initial={yearSlug(selectedYear(years, typeof year === "string" ? year : undefined) ?? years[0])} />;
}

export default async function AlumniPage({ searchParams }: { searchParams: SearchParams }) {
  const page = await alumniPageData();
  const [newest, ...older] = page.years;
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...alumni.header} stats={headerStats(page)} />
          {page.founders.length > 0 && (
            <Founders {...alumni.founders} intro={foundersIntro(page.founders)} people={page.founders} />
          )}
          {/* The page stays static: the URL is read only inside this
              boundary, whose fallback is the year a link with no ?year=
              opens on (the newest), so the stream lands with no
              change: no jump in the year switch, the page height or the sky. */}
          {newest !== undefined && (
            <Suspense fallback={<Years years={[newest, ...older]} initial={yearSlug(newest)} />}>
              <YearsFromUrl years={[newest, ...older]} searchParams={searchParams} />
            </Suspense>
          )}
        </main>
      </PageSky>
      <ApplyBand />
      <SiteFooter />
    </div>
  );
}
