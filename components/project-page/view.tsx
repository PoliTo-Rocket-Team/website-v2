import { Fragment, type ReactNode } from "react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { sectionsOf, type NumberedSection, type ProjectPageRecord } from "@/lib/project-pages";
import type { Project } from "@/lib/projects";
import { ProjectGallery } from "./gallery";
import { ProjectHero } from "./hero";
import { ProjectLaunches } from "./launches";
import { ProjectPlan } from "./plan";
import { ProjectReasons } from "./reasons";
import { ProjectStory } from "./story";
import { ProjectVersions } from "./versions";

// One project page as drawn, from a page record and the project's /projects
// entry: the public route draws the published record (./project-page.tsx),
// and the editor draws the record being typed under the edit shell, with each
// part outlined through `frame` (issue #298).

/** The page's parts, each one block the editor can outline. */
export type ProjectPart = "hero" | "name" | "design" | NumberedSection["kind"];

/** Wraps one part of the page; the public page draws each part as it is. */
export type ProjectFrame = (part: ProjectPart, node: ReactNode) => ReactNode;

const bare: ProjectFrame = (_, node) => node;

function Section({ section, project }: { section: NumberedSection; project: Project }) {
  switch (section.kind) {
    case "versions":
      return <ProjectVersions num={section.num} name={project.name} versions={section.versions} />;
    case "launches":
      return <ProjectLaunches num={section.num} log={section.launches} texture={project.texture} />;
    case "plan":
      return <ProjectPlan num={section.num} plan={section.plan} />;
    case "reasons":
      return <ProjectReasons num={section.num} reasons={section.reasons} />;
    case "gallery":
      return <ProjectGallery num={section.num} name={project.name} gallery={section.gallery} />;
  }
}

export function ProjectPageView({
  project,
  record,
  frame = bare,
}: {
  project: Project;
  record: ProjectPageRecord;
  frame?: ProjectFrame;
}) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main>
          {frame("hero", <ProjectHero project={project} hero={record.hero} />)}
          <ProjectStory name={record.name} design={record.design} frame={frame} />
          {sectionsOf(record).map((s) => (
            <Fragment key={s.kind}>{frame(s.kind, <Section section={s} project={project} />)}</Fragment>
          ))}
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
