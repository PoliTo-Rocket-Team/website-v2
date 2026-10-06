import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { PageSky } from "@/components/landing/page-sky";
import { ProjectCard } from "@/components/projects/project-card";
import { headerStats, projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects · PoliTo Rocket Team",
  description:
    "Cavour, VES and Efesto: the rockets and the liquid engine designed, built and flown by students of Politecnico di Torino.",
};

// Approved /projects page per Pencil boards 22 (desktop) and 22m (phone, 390).
// The page sky runs behind everything above the footer; the header and the
// cards paint no background of their own.
export default function ProjectsPage() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        {/* The top clears the fixed bar (64px, 72px from md) and keeps board
            22's 48px / 98px under it. The bottom is the section rhythm, so the
            gap to the footer matches every other section gap. */}
        <main className="px-5 pb-section pt-[112px] md:px-16 md:pt-[170px]">
          <div className="mx-auto max-w-[1312px]">
            <header>
              <p className="font-mono text-xs tracking-[0.3em] text-accent">PROJECTS</p>
              <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.025em] md:mt-6 md:text-[64px] md:leading-[1.03]">
                From first launch <br className="hidden md:inline" />
                to first liquid engine.
              </h1>
              <p className="mt-5 max-w-[640px] text-[15px] leading-[1.55] text-text-2 md:mt-7 md:text-[18px]">
                Cavour and VES have flown four times across three countries. Efesto is the liquid
                engine that comes next. All of it designed, built and flown by students of
                Politecnico di Torino.
              </p>
              {/* Phones: 3 + 2, each row under its own hairline. From md: five
                  columns under one hairline. */}
              <dl className="mt-5 grid grid-cols-6 md:mt-8 md:grid-cols-5 md:border-t md:border-white-10 md:pt-7">
                {headerStats().map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex flex-col-reverse border-t border-white-10 py-4 md:col-span-1 md:border-0 md:py-0 ${
                      i < 3 ? "col-span-2" : "col-span-3"
                    }`}
                  >
                    <dt className="mt-2 font-mono text-[10px] tracking-[0.2em] text-prt-muted md:mt-3 md:text-[11px]">
                      {s.label}
                    </dt>
                    <dd className="text-[30px] font-bold leading-none tracking-[-0.02em] text-prt-text md:text-[36px]">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </header>

            <div className="-mx-1.5 mt-4 space-y-6 md:mx-0 md:mt-14">
              {projects.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
          </div>
        </main>
      </PageSky>
      <LandingFooter />
    </div>
  );
}
