import type { Copy, ProjectPage } from "@/lib/projects";
import { editorVersion, publicVersion, statusOf, type ContentItem, type ContentStatus } from "@/lib/content/versioned";
import { homeCardOf, newestFirst, pageOf, type ProjectRecord } from "./record";

// The dashboard Projects list (board 91, issue #506): one row per stored
// project, drafts included, newest first by the same rule as the home
// Projects row and /projects (`newestFirst`). Each row reads the editor's
// version, the one Edit page opens on, and says whether a published version
// is on the site. The list sets no order: the stored site order stays as it
// is and only breaks a tie in start year, as on the public pages.

/** What the KIND column says for each kind of record. */
export const PROJECT_KIND_LABELS: Readonly<Record<ProjectRecord["kind"], string>> = {
  vehicle: "Rocket",
  engine: "Engine",
};

export type ProjectRow = {
  readonly id: number;
  /** Where Edit page opens it: /dashboard/projects/<slug>. */
  readonly slug: string;
  readonly name: string;
  /** The project's own brand texture, as its card and page draw it. */
  readonly texture: string;
  /** The card line under the name. */
  readonly desc: Copy;
  readonly kind: string;
  readonly years: string;
  /** The card's status pill, as Home reads it ("IN DESIGN", "FLOWN ×3"). */
  readonly status: string;
  /** Published, Draft or Draft changes. */
  readonly content: ContentStatus;
  /** Its page on the site; null while no version of it is published. */
  readonly onSite: ProjectPage | null;
};

/**
 * The stored projects as the list shows them: newest first by the start
 * year each card names, a tie going to the later place in the site order,
 * and a project naming no year last.
 */
export function projectRows(items: readonly ContentItem<ProjectRecord>[]): ProjectRow[] {
  const inSiteOrder = [...items].sort((a, b) => a.siteOrder - b.siteOrder);
  const cards = inSiteOrder.map((item, position) => {
    const record = editorVersion(item.version);
    return { ...homeCardOf(record, position), item, record };
  });
  return newestFirst(cards).map(({ item, record, status }) => {
    const published = publicVersion(item.version);
    return {
      id: item.id,
      slug: record.slug,
      name: record.name,
      texture: record.texture,
      desc: record.card.desc,
      kind: PROJECT_KIND_LABELS[record.kind],
      years: record.listing.years,
      status,
      content: statusOf(item.version),
      onSite: published === null ? null : pageOf(published.slug),
    };
  });
}
