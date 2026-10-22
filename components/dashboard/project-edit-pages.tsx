import { PageSky } from "@/components/landing/page-sky";
import { ProjectsSection } from "@/components/landing/projects-section";
import { ProjectPageView, type ProjectFrame } from "@/components/project-page/view";
import { ProjectsListPage } from "@/components/projects/list-page";
import { homeCardOf, listingOf, listingsNewestFirst, pageRecordOf, type ProjectRecord } from "@/lib/project-content/record";
import { CardInPlace } from "./edit-shell";

// The pages the project editor draws under the edit shell (project-edit.tsx):
// the project's own page, and Home and the Projects list with its card in
// place. Each is drawn without the site's navbar and footer (issue #495):
// they are not the editor's to change.

export type ProjectPageId = "page" | "home" | "list";

/** The project's own page, drawn from the fields being edited, its parts outlined through `frame`. */
export function EditedProjectPage({ view, position, frame }: { view: ProjectRecord; position: number; frame: ProjectFrame }) {
  return <ProjectPageView project={listingOf(view, position)} record={pageRecordOf(view)} chrome="none" frame={frame} />;
}

/**
 * Home or the Projects list, drawn from `lineup`, every project in site order
 * with the one being edited at `position`: its card outlined with an Edit
 * card chip, the other cards dimmed. Home shows its Projects section, as the
 * Outreach editor's Home shows its Track record.
 */
export function ProjectCardPage({
  page,
  lineup,
  position,
  onEditCard,
}: {
  page: Exclude<ProjectPageId, "page">;
  lineup: readonly ProjectRecord[];
  position: number;
  onEditCard: () => void;
}) {
  if (page === "list") {
    // Newest first, as the public list orders them (issue #381). Each entry
    // keeps its number, its place in the site order, so the number finds the
    // edited card even while a draft slug repeats another project's.
    const edited = listingOf(lineup[position], position).index;
    return (
      <ProjectsListPage
        projects={listingsNewestFirst(lineup)}
        chrome="none"
        frame={(project, node) => (
          // The /projects card is rounded-3xl (24px), so its outline is 30px.
          <CardInPlace edited={project.index === edited} onEdit={onEditCard} outline="rounded-[30px]">
            {node}
          </CardInPlace>
        )}
      />
    );
  }
  const cards = lineup.map(homeCardOf);
  const edited = cards[position];
  // Home's Projects section alone, on the page sky, with no navbar above it.
  return (
    <div className="relative bg-ground">
      <PageSky>
        <ProjectsSection
          cards={cards}
          frame={(card, node, layout) => (
            <CardInPlace edited={card === edited} onEdit={onEditCard} className={layout}>
              {node}
            </CardInPlace>
          )}
        />
      </PageSky>
    </div>
  );
}
