"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProject } from "@/app/dashboard/project-actions";
import { ProjectPageView, type ProjectFrame, type ProjectPart } from "@/components/project-page/view";
import type { EditBlocks, EditDevice } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { fieldProblems, fieldsAfterSave, fieldsOf, projectViewOf, type PanelSection, type ProjectFields } from "@/lib/project-content/fields";
import { listingOf, pageRecordOf, type ProjectPlace, type ProjectRecord } from "@/lib/project-content/record";
import { EditableBlock, EditShell } from "./edit-shell";
import { ProjectEditPanel, type FieldErrors } from "./project-edit-panel";

// A project on its real page under the edit shell (boards 75b and 75c,
// issue #298). The page is drawn from the panel's fields, so it changes as
// the editor types; Save draft and Publish on the bar send the fields to the
// projects editor, which checks them again. Save draft leaves the published
// page live. The blocks this slice outlines are the story sections; the
// versions, launch history, plan and gallery come with the next slice, and
// the page switch (Home, Projects list) after it.

type Outlined = Extract<ProjectPart, "hero" | "name" | "design" | "reasons" | "next">;

const PROJECT_BLOCKS: EditBlocks<Outlined, PanelSection> = {
  hero: { name: "Top of the page", section: "top", chip: "Edit top of the page" },
  name: { name: "Name story", section: "name", chip: "Edit name story" },
  design: { name: "Design story", section: "design", chip: "Edit design story" },
  reasons: { name: "Why", section: "reasons", chip: "Edit Why" },
  next: { name: "Next-project card", section: "teaser", chip: "Edit card line" },
};

const isOutlined = (part: ProjectPart): part is Outlined => part in PROJECT_BLOCKS;

const outlined: ProjectFrame = (part, node) => (isOutlined(part) ? <EditableBlock id={part}>{node}</EditableBlock> : node);

/** Each field's error, once a save was refused; fixing a field drops its error. */
function errorsOf(fields: ProjectFields): FieldErrors {
  return Object.fromEntries(fieldProblems(fields).map((p) => [p.field, p.error]));
}

export function ProjectEdit({ item: opening, place }: { item: ContentItem<ProjectRecord>; place: ProjectPlace }) {
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
      <ProjectPageView
        project={listingOf(view, place.position)}
        record={pageRecordOf(view)}
        next={{ project: listingOf(place.next.record, place.next.position), teaser: place.next.record.teaser }}
        frame={outlined}
      />
    </EditShell>
  );
}
