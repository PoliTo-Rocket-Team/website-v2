import type { Metadata } from "next";
import { Advisors } from "@/components/about/advisors";
import { CoreMembers } from "@/components/about/core-members";
import { Departments } from "@/components/about/departments";
import { InNumbers } from "@/components/about/in-numbers";
import { OrgChart } from "@/components/about/org-chart";
import { CopyText } from "@/components/project-page/parts";
import { ApplyBand } from "@/components/landing/apply-band";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { team } from "@/lib/about/team";

export const metadata: Metadata = {
  title: "The Team · PoliTo Rocket Team",
  description: team.description,
};

// Boards 26 (desktop) and 26m (phone): the header and its
// figures, then who leads, the departments, the advisors, the numbers and
// every core member, all drawn from one record (lib/about/team.ts). The page
// sky runs behind everything above the apply band; the sections paint no
// background of their own and each sits one section pad below the last, as
// on the project pages.
export default function TeamPage() {
  const { header } = team;
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section pt-16 md:pt-[72px]">
          <div className="px-5 md:px-16">
            <div className="mx-auto max-w-[1312px]">
              {/* The About pages are in the navbar's About menu (board 27), so
                  the page starts with its header: 40px under the bar on
                  phones, 96px from md (boards 26m and 26). */}
              <header className="pt-10 md:pt-24">
                <p className="font-mono text-xs tracking-[0.3em] text-accent">{header.eyebrow}</p>
                <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.025em] md:mt-6 md:text-[64px] md:leading-[1.03]">
                  {header.title}
                </h1>
                <p className="mt-4 max-w-[600px] text-[15px] leading-[1.6] text-text-2 md:mt-7 md:text-[18px]">
                  {header.intro}
                </p>
                <dl className="mt-5 grid grid-cols-4 border-t border-white-10 pt-4 md:mt-7 md:pt-7">
                  {header.stats.map((s) => (
                    <div key={s.value} className="flex flex-col-reverse">
                      <dt className="mt-1.5 font-mono text-[9px] tracking-[0.15em] text-prt-muted md:mt-3 md:text-[11px] md:tracking-[0.2em]">
                        <CopyText copy={s.label} />
                      </dt>
                      <dd className="text-[22px] font-bold leading-none tracking-[-0.02em] text-prt-text md:text-[36px]">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </header>
            </div>
          </div>

          <OrgChart chart={team.orgChart} />
          <Departments departments={team.departments} />
          <Advisors advisors={team.advisors} />
          <InNumbers numbers={team.inNumbers} />
          <CoreMembers core={team.coreMembers} />
        </main>
      </PageSky>
      <ApplyBand />
      <LandingFooter />
    </div>
  );
}
