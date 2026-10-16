import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { notFound } from "next/navigation";
import { listingOf, pageRecordOf, type ProjectRecord } from "@/lib/project-content/record";
import { publishedProjects } from "@/lib/project-content/public";
import { sectionsOf, type NumberedSection } from "@/lib/project-pages";
import type { PageSlug, Project } from "@/lib/projects";
import { ProjectGallery } from "./gallery";
import { ProjectHero } from "./hero";
import { ProjectLaunches } from "./launches";
import { NextProject } from "./next-project";
import { ProjectPlan } from "./plan";
import { ProjectReasons } from "./reasons";
import { ProjectStory } from "./story";
import { ProjectVersions } from "./versions";

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

/** The project published at `slug`, with its place in the site order; null when none is. */
async function published(slug: PageSlug): Promise<{ record: ProjectRecord; position: number; all: readonly ProjectRecord[] } | null> {
  const all = await publishedProjects();
  const position = all.findIndex((r) => r.slug === slug);
  return position === -1 ? null : { record: all[position], position, all };
}

// Boards 23 to 25 (1440) and 23m to 25m (390): one template for every
// project page, drawn from the project's published record
// (lib/project-content/record.ts). The homepage's navbar and footer, and the
// shared page sky behind everything above the footer, as on /projects; the
// sections paint no background. A project with no published version has no
// page.
export async function ProjectPage({ slug }: { slug: PageSlug }) {
  const found = await published(slug);
  if (found === null) notFound();
  const record = pageRecordOf(found.record);
  const project = listingOf(found.record, found.position);
  // The project after this one; the last loops back to the first.
  const nextPosition = (found.position + 1) % found.all.length;
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main>
          <ProjectHero project={project} hero={record.hero} />
          <ProjectStory name={record.name} design={record.design} />
          {sectionsOf(record).map((s) => (
            <Section key={s.kind} section={s} project={project} />
          ))}
          <NextProject project={listingOf(found.all[nextPosition], nextPosition)} teaser={found.all[nextPosition].teaser} />
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}

/** The page's title and description, from its published record. */
export async function projectPageMetadata(slug: PageSlug) {
  const found = await published(slug);
  return found === null ? {} : { title: found.record.name, description: found.record.description };
}
