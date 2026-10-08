import type { Metadata } from "next";
import { Suspense } from "react";
import { Founders } from "@/components/about/alumni/founders";
import { YearByYear } from "@/components/about/alumni/year-by-year";
import { PageHeader } from "@/components/about/page-header";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { alumni } from "@/lib/about/alumni";
import { headerStats, selectedYear, yearSlug, yearsNewestFirst } from "@/lib/about/alumni-year";

export const metadata: Metadata = {
  title: "Alumni · PoliTo Rocket Team",
  description: alumni.description,
};

// Board 28 (desktop) and the Team page's phone patterns: the header and its
// figures, the founders, then everyone year by year, one academic year at a
// time, all drawn from one record (lib/about/alumni.ts).

type SearchParams = Promise<{ year?: string | string[] }>;

const years = yearsNewestFirst(alumni.years.list);

function Years({ initial }: { initial: string }) {
  return (
    <YearByYear
      eyebrow={alumni.years.eyebrow}
      title={alumni.years.title}
      years={years}
      founders={alumni.founders.people}
      initial={initial}
    />
  );
}

/** The year ?year= names, so a shared link opens on it. */
async function YearsFromUrl({ searchParams }: { searchParams: SearchParams }) {
  const { year } = await searchParams;
  return <Years initial={yearSlug(selectedYear(years, typeof year === "string" ? year : undefined))} />;
}

export default function AlumniPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <PageHeader {...alumni.header} stats={headerStats(alumni)} />
          <Founders founders={alumni.founders} />
          {/* The page stays static: the URL is read only inside this
              boundary, whose fallback is the year a link with no ?year=
              opens on (the newest), so the stream lands with no
              change: no jump in the year switch, the page height or the sky. */}
          <Suspense fallback={<Years initial={yearSlug(selectedYear(years, undefined))} />}>
            <YearsFromUrl searchParams={searchParams} />
          </Suspense>
        </main>
      </PageSky>
      <ApplyBand />
      <LandingFooter />
    </div>
  );
}
