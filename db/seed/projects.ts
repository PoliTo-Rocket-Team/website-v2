// The projects seed (issue #310): the project pages, /projects, the home
// Projects cards and the dashboard's Projects editor (epic #255, boards 75 to
// 75d). It starts from the projects the import migration carries in
// (lib/project-content/import.ts): Cavour, VES and Efesto, each published.
// VES holds draft changes, as board 75b draws it, so its pages keep showing
// the published version. One more project is published as New project makes
// it (lib/project-content/new-project.ts): it names no rocket model of its
// own, so its card and its page draw the shared placeholder rocket.

import { projects, projectVersions } from "@/db/schema";
import type { ContentItem } from "@/lib/content/versioned";
import { importedProjects } from "@/lib/project-content/import";
import { newProjectRecord } from "@/lib/project-content/new-project";
import { withIntro, type ProjectRecord } from "@/lib/project-content/record";
import { contentVersionRows } from "./content";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-09-12 10:00:00+00";
const PUBLISHED = "2026-09-12 10:00:00+00";
const DRAFTED = "2026-10-09 14:00:00+00";

/** VES: published, with a draft change to its intro (board 75b). */
export const DRAFT_CHANGES_PROJECT = 2;

/** A project with no rocket model of its own, published, so its card and page draw the placeholder. */
export const PLACEHOLDER_ROCKET_PROJECT = 4;

const PLACEHOLDER_ROCKET = newProjectRecord({ name: "Galileo", slug: "galileo", kind: "vehicle" }, 2026);

export const PROJECT_ITEMS: readonly ContentItem<ProjectRecord>[] = [
  ...importedProjects().map((item): ContentItem<ProjectRecord> => {
    if (item.id !== DRAFT_CHANGES_PROJECT || item.version.state !== "published") return item;
    const published = item.version.published;
    const intro = "The second Founding Fathers rocket, named after Vittorio Emanuele II. Mark II won Design & Build at IREC 2025.";
    const draft = withIntro(published, intro);
    return { ...item, version: { state: "published", published, draft } };
  }),
  {
    id: PLACEHOLDER_ROCKET_PROJECT,
    siteOrder: PLACEHOLDER_ROCKET_PROJECT,
    version: { state: "published", published: PLACEHOLDER_ROCKET, draft: null },
  },
];

export const PROJECT_ROWS = rowsOf(
  projects,
  PROJECT_ITEMS.map(({ id, siteOrder }) => ({ id, siteOrder, createdAt: CREATED })),
);

export const PROJECT_VERSION_ROWS = rowsOf(
  projectVersions,
  contentVersionRows(PROJECT_ITEMS).map(({ itemId, kind, content }) => ({
    projectId: itemId,
    version: kind,
    content,
    updatedAt: kind === "published" ? PUBLISHED : DRAFTED,
  })),
);

export const projectsSeed = tableSeedModule({
  name: "projects",
  owns: [projects, projectVersions],
  rows: [PROJECT_ROWS, PROJECT_VERSION_ROWS],
});
