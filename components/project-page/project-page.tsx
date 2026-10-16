import { notFound } from "next/navigation";
import { listingOf, pageRecordOf, type ProjectRecord } from "@/lib/project-content/record";
import { publishedProjects } from "@/lib/project-content/public";
import type { PageSlug } from "@/lib/projects";
import { ProjectPageView } from "./view";

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
  // The project after this one; the last loops back to the first.
  const nextPosition = (found.position + 1) % found.all.length;
  return (
    <ProjectPageView
      project={listingOf(found.record, found.position)}
      record={pageRecordOf(found.record)}
      next={{ project: listingOf(found.all[nextPosition], nextPosition), teaser: found.all[nextPosition].teaser }}
    />
  );
}

/** The page's title and description, from its published record. */
export async function projectPageMetadata(slug: PageSlug) {
  const found = await published(slug);
  return found === null ? {} : { title: found.record.name, description: found.record.description };
}
