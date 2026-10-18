"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProject } from "@/app/dashboard/project-actions";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { ProjectsSection } from "@/components/landing/projects-section";
import { ProjectPageView, type ProjectFrame, type ProjectPart } from "@/components/project-page/view";
import { ProjectsListPage } from "@/components/projects/list-page";
import type { EditBlocks, EditDevice, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import type { FooterProject } from "@/lib/landing-links";
import { fieldProblems, fieldsAfterSave, fieldsOf, projectViewOf, type PanelSection, type ProjectFields } from "@/lib/project-content/fields";
import { homeCardOf, lineupWith, listingOf, listingsNewestFirst, pageRecordOf, type ProjectPlace, type ProjectRecord } from "@/lib/project-content/record";
import { CardInPlace, EditableBlock, EditShell } from "./edit-shell";
import { ProjectEditPanel, type FieldErrors } from "./project-edit-panel";

// A project on its real page under the edit shell (boards 75b and 75c,
// issue #298). The page is drawn from the panel's fields, so it changes as
// the editor types; Save draft and Publish on the bar send the fields to the
// projects editor, which checks them again. Save draft leaves the published
// page live. Every part of the page is a block with its Edit chip (issues
// #298 and #299).
//
// The page switch (board 75d, issue #300): the project's own page, then Home
// and the Projects list, each drawn from the fields being edited with the
// project's card in its place among the published ones, outlined with an
// Edit card chip that opens the panel's Card section; the other cards are
// dimmed.

const PROJECT_BLOCKS: EditBlocks<ProjectPart, PanelSection> = {
  hero: { name: "Top of the page", section: "top", chip: "Edit top of the page" },
  name: { name: "Name story", section: "name", chip: "Edit name story" },
  design: { name: "Design story", section: "design", chip: "Edit design story" },
  versions: { name: "Versions", section: "versions", chip: "Edit versions" },
  launches: { name: "Launch history", section: "launches", chip: "Edit launch history" },
  plan: { name: "Plan", section: "plan", chip: "Edit plan" },
  reasons: { name: "Why", section: "reasons", chip: "Edit Why" },
  gallery: { name: "Gallery", section: "gallery", chip: "Edit gallery" },
  next: { name: "Next-project card", section: "teaser", chip: "Edit card line" },
};

const outlined: ProjectFrame = (part, node) => <EditableBlock id={part}>{node}</EditableBlock>;

type ProjectPageId = "page" | "home" | "list";

const PAGE_TARGETS: readonly PageTarget<ProjectPageId>[] = [
  { id: "page", label: "Project page" },
  { id: "home", label: "Home" },
  { id: "list", label: "Projects list" },
];

/** Each field's error, once a save was refused; fixing a field drops its error. */
function errorsOf(fields: ProjectFields): FieldErrors {
  return Object.fromEntries(fieldProblems(fields).map((p) => [p.field, p.error]));
}

export function ProjectEdit({
  item: opening,
  place,
  footerProjects,
}: {
  item: ContentItem<ProjectRecord>;
  place: ProjectPlace;
  /** The published projects the page's footer lists (issue #378). */
  footerProjects: readonly FooterProject[];
}) {
  const [item, setItem] = useState(opening);
  const opened = editorVersion(item.version);
  const [fields, setFields] = useState<ProjectFields>(() => fieldsOf(opened));
  // A save hands the panel the stored fields; it starts afresh on them.
  const [revision, setRevision] = useState(0);
  const [refusedOnce, setRefusedOnce] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState<PanelSection[]>([]);
  const [scrollTo, setScrollTo] = useState<{ section: PanelSection } | null>(null);
  const [device, setDevice] = useState<EditDevice>("desktop");
  const [page, setPage] = useState<ProjectPageId>("page");
  const [pending, startTransition] = useTransition();

  const view = projectViewOf(fields, opened);

  const openSection = useCallback((section: PanelSection) => {
    setPanelOpen(true);
    setExpanded([section]);
    setScrollTo({ section });
  }, []);

  const save = (step: PublishStep) => {
    const [first] = fieldProblems(fields);
    if (first !== undefined) {
      setRefusedOnce(true);
      openSection(first.section);
      toast.error(first.error);
      return;
    }
    startTransition(async () => {
      const result = await saveProject(item.id, step, fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItem(result.value);
      setFields(fieldsAfterSave(editorVersion(result.value.version), fields));
      setRevision((r) => r + 1);
      setRefusedOnce(false);
      toast.success(step === "publish" ? `${view.name} is published.` : "Draft saved. The published page stays live.");
    });
  };

  return (
    <EditShell
      section={{ label: "Projects", href: "/dashboard/projects" }}
      heading={`Editing ${view.name}`}
      status={statusOf(item.version)}
      saved={panelOpen ? "Changes show on the page as you type" : undefined}
      onSaveDraft={pending ? null : () => save("save-draft")}
      onPublish={pending ? null : () => save("publish")}
      pages={{ targets: PAGE_TARGETS, current: page, onSelect: setPage }}
      blocks={PROJECT_BLOCKS}
      onEdit={openSection}
      onDeviceChange={setDevice}
      panel={
        panelOpen && (
          <ProjectEditPanel
            key={revision}
            name={view.name}
            kind={view.kind}
            previousName={place.previous.name}
            card={homeCardOf(view, place.position)}
            fields={fields}
            onChange={setFields}
            device={device}
            errors={refusedOnce ? errorsOf(fields) : {}}
            expanded={expanded}
            onExpandedChange={setExpanded}
            scrollTo={scrollTo}
            onClose={() => setPanelOpen(false)}
          />
        )
      }
    >
      {page === "page" ? (
        <ProjectPageView
          project={listingOf(view, place.position)}
          record={pageRecordOf(view)}
          next={{ project: listingOf(place.next.record, place.next.position), teaser: place.next.record.teaser }}
          footerProjects={footerProjects}
          frame={outlined}
        />
      ) : (
        <CardPage
          page={page}
          lineup={lineupWith(place, view)}
          position={place.position}
          footerProjects={footerProjects}
          onEditCard={() => openSection("card")}
        />
      )}
    </EditShell>
  );
}

/**
 * Home or the Projects list, drawn from `lineup`, every project in site order
 * with the one being edited at `position`: its card outlined with an Edit
 * card chip, the other cards dimmed. Home shows its Projects section, as the
 * Outreach editor's Home shows its Track record.
 */
function CardPage({
  page,
  lineup,
  position,
  footerProjects,
  onEditCard,
}: {
  page: Exclude<ProjectPageId, "page">;
  lineup: readonly ProjectRecord[];
  position: number;
  footerProjects: readonly FooterProject[];
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
        footerProjects={footerProjects}
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
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky className="pt-16 md:pt-[72px]">
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
