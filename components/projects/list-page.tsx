import { Fragment, type ReactNode } from "react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { siteFooterOf, type PageChrome } from "@/lib/page-chrome";
import { launchCounts, type Project, type Stat } from "@/lib/projects";
import { ProjectCard } from "./project-card";

/**
 * The header's two targets after its counts: VES Mark II's apogee and
 * Efesto's thrust. Page copy, like the intro above them; the no-break space
 * keeps the figure on one line.
 */
const targets: readonly Stat[] = [
  { value: "9 000 m", label: "TARGET APOGEE" },
  { value: "5 kN", label: "ENGINE TARGET" },
];

/** Wraps one project's card in place on the page. */
export type ProjectCardFrame = (project: Project, node: ReactNode) => ReactNode;

// Approved /projects page per Pencil boards 22 (desktop) and 22m (phone, 390).
// The page sky runs behind everything above the footer; the header and the
// cards paint no background of their own. The route hands it the published
// projects newest first (issue #381, `listingsNewestFirst`), and the header
// counts their launches.
// The edit shell's page switch (board 75d, issue #300) draws the same page
// with the project being edited in its place, and a `frame` that outlines its
// card and dims the others. The footer lists the published projects
// (`footerProjects`, issue #378), never the edit shell's draft; the edit
// shell draws the page with no navbar and no footer (`chrome="none"`,
// issue #495).
export function ProjectsListPage(
  props: {
    projects: readonly Project[];
    frame?: ProjectCardFrame;
  } & PageChrome,
) {
  const { projects, frame } = props;
  const footer = siteFooterOf(props);
  const stats = [...launchCounts(projects), ...targets];
  return (
    <div className="relative bg-ground">
      {footer !== null && <LandingNavbar />}
      <PageSky>
        {/* The top clears the fixed bar (64px, 72px from md, navbar.tsx) and
            then keeps one section pad under it, so the header sits on the
            same rhythm as every section; with no navbar, the section pad
            alone. The bottom has no pad: the footer's own top pad sets the
            gap under the last card (issue #582). */}
        <main
          className={
            footer !== null
              ? "px-5 pt-[calc(64px+var(--section-pad))] md:px-16 md:pt-[calc(72px+var(--section-pad))]"
              : "px-5 pt-section md:px-16"
          }
        >
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
                {stats.map((s, i) => (
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
              {projects.map((p) =>
                frame === undefined ? (
                  <ProjectCard key={p.slug} project={p} rocketTurns />
                ) : (
                  <Fragment key={p.slug}>{frame(p, <ProjectCard project={p} />)}</Fragment>
                ),
              )}
            </div>
          </div>
        </main>
        {footer !== null && <LandingFooter inSky projects={footer} />}
      </PageSky>
    </div>
  );
}
