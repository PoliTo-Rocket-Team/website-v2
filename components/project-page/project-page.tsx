import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { nextOf, pageRecord, projectOf, sectionsOf, teaserOf, type NumberedSection } from "@/lib/project-pages";
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

// Boards 23 to 25 (1440) and 23m to 25m (390): one template for every
// project page, drawn from the project's record (lib/project-pages). The
// homepage's navbar and footer, and the shared page sky behind everything
// above the footer, as on /projects; the sections paint no background.
export function ProjectPage({ slug }: { slug: PageSlug }) {
  const record = pageRecord(slug);
  const project = projectOf(slug);
  const next = nextOf(slug);
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
          <NextProject project={next} teaser={teaserOf(next.slug)} />
        </main>
      </PageSky>
      <LandingFooter />
    </div>
  );
}

/** The page's title and description, from its record. */
export function projectPageMetadata(slug: PageSlug) {
  return { title: projectOf(slug).name, description: pageRecord(slug).description };
}
