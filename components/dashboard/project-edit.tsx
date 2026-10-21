"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProject } from "@/app/dashboard/project-actions";
import type { ProjectFrame, ProjectPart } from "@/components/project-page/view";
import type { EditBlocks, EditDevice, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { fieldProblems, fieldsAfterSave, fieldsOf, projectViewOf, type PanelSection, type ProjectFields } from "@/lib/project-content/fields";
import { homeCardOf, lineupWith, type ProjectPlace, type ProjectRecord } from "@/lib/project-content/record";
import { EditableBlock, EditShell, type BlockShape } from "./edit-shell";
import { EditedProjectPage, ProjectCardPage, type ProjectPageId } from "./project-edit-pages";
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
//
// The pages themselves, drawn without the site's navbar and footer (issue
// #495), are in project-edit-pages.tsx.

const PROJECT_BLOCKS: EditBlocks<ProjectPart, PanelSection> = {
  hero: { name: "Top of the page", section: "top", chip: "Edit top of the page" },
  name: { name: "Name story", section: "name", chip: "Edit name story" },
  design: { name: "Design story", section: "design", chip: "Edit design story" },
  versions: { name: "Versions", section: "versions", chip: "Edit versions" },
  launches: { name: "Launch history", section: "launches", chip: "Edit launch history" },
  plan: { name: "Plan", section: "plan", chip: "Edit plan" },
  reasons: { name: "Why", section: "reasons", chip: "Edit Why" },
  gallery: { name: "Gallery", section: "gallery", chip: "Edit gallery" },
};

// The hero and the numbered sections fill the page's width, so their outlines
// and chips sit inside them; the two stories sit inside the page's column.
const PART_SHAPE: Readonly<Record<ProjectPart, BlockShape>> = {
  hero: "bleed",
  name: "around",
  design: "around",
  versions: "bleed",
  launches: "bleed",
  plan: "bleed",
  reasons: "bleed",
  gallery: "bleed",
};

// On phones the hero leaves only 24px over its first line, so it keeps room
// there for its chip row.
const outlined: ProjectFrame = (part, node) => (
  <EditableBlock id={part} shape={PART_SHAPE[part]} className={part === "hero" ? "max-md:pt-6" : ""}>
    {node}
  </EditableBlock>
);

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
}: {
  item: ContentItem<ProjectRecord>;
  place: ProjectPlace;
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
        <EditedProjectPage view={view} position={place.position} frame={outlined} />
      ) : (
        <ProjectCardPage page={page} lineup={lineupWith(place, view)} position={place.position} onEditCard={() => openSection("card")} />
      )}
    </EditShell>
  );
}
