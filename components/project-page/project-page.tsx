import { notFound } from "next/navigation";
import { listingOf, pageRecordOf, publishedPageOf } from "@/lib/project-content/record";
import { publishedProjects } from "@/lib/project-content/public";
import { ProjectPageView } from "./view";

// Boards 23 to 25 (1440) and 23m to 25m (390): one template for every
// project page, drawn from the project's published record
// (lib/project-content/record.ts). The homepage's navbar and footer, and the
// shared page sky behind everything above the footer, as on /projects; the
// sections paint no background. A project with no published version has no
// page.
export async function ProjectPage({ slug }: { slug: string }) {
  const found = publishedPageOf(await publishedProjects(), slug);
  if (found === null) notFound();
  return (
    <ProjectPageView
      project={listingOf(found.record, found.position)}
      record={pageRecordOf(found.record)}
    />
  );
}

/** The page's title and description, from its published record. */
export async function projectPageMetadata(slug: string) {
  const found = publishedPageOf(await publishedProjects(), slug);
  return found === null ? {} : { title: found.record.name, description: found.record.description };
}
