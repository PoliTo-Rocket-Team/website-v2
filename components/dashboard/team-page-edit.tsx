"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Check, Eye, LogOut, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { endAdvising, resetTeamPageLayer, saveTeamPage } from "@/app/dashboard/actions";
import { PAGE_INTRO } from "@/components/about/page-header";
import { TeamPageView, type TeamPageFrames } from "@/components/about/team-page";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/about/academic-year-copy";
import type { FooterProject } from "@/lib/landing-links";
import {
  advisorFieldErrors,
  advisorRowsOf,
  advisorsOfRows,
  inPageOrder,
  teamPageStatus,
  withAdvisors,
  type AdvisorItem,
  type AdvisorRow,
} from "@/lib/about/advisors";
import {
  nextAddedId,
  resetLayer,
  TEAM_PAGE_INTRO_MAX,
  type AddedRef,
  type ArcSpot,
  type GroupPhoto,
  type HeadSpot,
  type TeamBuild,
  type TeamPageLayer,
} from "@/lib/about/team-layer";
import {
  arcHasRoom,
  hasHeadErrors,
  headBackToRecord,
  headFieldErrors,
  headFieldsOf,
  headRecord,
  hideHead,
  isHeadEdited,
  layerWithHead,
  layerWithLeader,
  leaderFieldErrors,
  leaderFieldsOf,
  leaderGaps,
  newDepartmentFields,
  newLeaderFields,
  teamByName,
  withHeadPerson,
  withLeaderPerson,
  withNewLead,
  withoutAddedLeader,
  type HeadFields,
  type HeadRef,
  type LeaderFields,
} from "@/lib/about/team-page-add";
import type { TeamPerson } from "@/lib/about/team-person";
import { carouselSpotsOf } from "@/lib/about/team-roles";
import {
  backToTeamRecord,
  describedGroupPhoto,
  editCount,
  editedTeamPage,
  editOfFields,
  groupPhotoChoices,
  groupPhotoDescriptions,
  groupPhotoOf,
  hasErrors,
  introError,
  isEdited,
  personFieldErrors,
  personFieldsOf,
  personPhotoChoices,
  spotRecord,
  withGroupPhoto,
  withIntro,
  withPerson,
  withSpotEdit,
  type PersonFieldErrors,
  type PersonFields,
  type PersonSpot,
  type PhotoChoice,
} from "@/lib/about/team-page-edit";
import type { Photo } from "@/lib/about/types";
import type { TeamPageOpening } from "@/lib/about/team-page-editor";
import type { EditBlocks } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentStatus, type PublishStep } from "@/lib/content/versioned";
import { FIRST_ALUMNI_YEAR } from "@/lib/dashboard/alumni";
import { YearSelect } from "./alumni-panels";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { BarButton, EditableBlock, EditShell } from "./edit-shell";
import { TeamAdvisorsPanel, type KeyedAdvisorRow } from "./team-advisors-panel";
import { TeamHeadPanel } from "./team-head-panel";
import { TeamLeaderPanel } from "./team-leader-panel";
import { TeamPersonPanel } from "./team-person-panel";

// The Team page editor (boards 80 to 80h, issues #284 and #285): the real
// Team page under the shared edit shell, with the "Visual changes only" tag
// and Reset to team on the bar. Hovering a person on the org chart or a head
// block outlines it with where it comes from and an Edit chip, which opens
// its panel; the intro text and the group photo are edited in place. Board
// 80e's add affordances sit on the page while no panel is open: a "+" at each
// place on the arc (gone at eight leaders), "+ Add department" beside each
// slide's heading, and "+ Add division lead" on a hovered head block, under a
// note that added items show only on the Team page. The core members list and
// "In numbers" have no affordance. The Advisors section is one block (board
// 80c) whose "Edit advisors" opens the Advisors panel (board 80d, issue
// #286). The editor holds the working layer and the working advisor list and
// lays both on the page as they change; Save draft and Publish send them
// whole to the layer and advisor actions, which check them again and write
// nothing but the layer and the advisors. End advising is the one change
// made at once, after the editor confirms the years.

/** What an Edit chip opens: the intro or the group photo in place, or a panel: a person's spot, a leader the editor added, a head block, a department the editor added. */
type Section = "intro" | "group-photo" | "advisors" | PersonSpot | `leader:${number}` | HeadSpot | `department:${number}`;

/** The panel open beside the page, with its fields as the editor fills them. */
type Panel =
  | { readonly kind: "person"; readonly spot: PersonSpot; readonly fields: PersonFields }
  /** `id` null: a leader the "+" is adding. */
  | { readonly kind: "leader"; readonly id: number | null; readonly fields: LeaderFields }
  /** `at` null: a department "+ Add department" is adding. */
  | { readonly kind: "head"; readonly at: HeadRef | null; readonly fields: HeadFields }
  /** The Advisors panel, with its copy of the list: Done keeps it, closing drops it. */
  | { readonly kind: "advisors"; readonly rows: readonly KeyedAdvisorRow[] };

const isArcSpot = (at: string): at is ArcSpot => at.startsWith("arc:");
const isAddedRef = (at: string): at is AddedRef => at.startsWith("added:");
const addedId = (at: AddedRef) => Number(at.slice("added:".length));

const PLACE = "Org chart";

/** The layer with the open panel's edit laid on: the page shows it as the editor types, and Cancel drops it. */
function previewOf(build: TeamBuild, layer: TeamPageLayer, panel: Panel | null): TeamPageLayer {
  if (panel === null) return layer;
  if (panel.kind === "person") return withSpotEdit(layer, panel.spot, editOfFields(build, panel.spot, panel.fields));
  if (panel.kind === "leader") return layerWithLeader(build, layer, panel.id, panel.fields);
  if (panel.kind === "advisors") return layer;
  return layerWithHead(build, layer, panel.at, panel.fields);
}

/** What the open panel refuses before it keeps its edit, as one message; null when nothing is refused. */
function panelRefusal(build: TeamBuild, layer: TeamPageLayer, panel: Panel | null): string | null {
  if (panel === null) return null;
  if (panel.kind === "person") return hasErrors(personFieldErrors(panel.fields)) ? "Fix the highlighted fields first." : null;
  if (panel.kind === "leader") {
    const errors = leaderFieldErrors(build, layer, panel.id, panel.fields);
    return errors.arc ?? (Object.keys(errors).length > 0 ? "Fix the highlighted fields first." : null);
  }
  if (panel.kind === "advisors") {
    return panel.rows.some((r) => Object.keys(advisorFieldErrors(r.fields)).length > 0) ? "Fix the highlighted advisors first." : null;
  }
  return hasHeadErrors(headFieldErrors(panel.at, panel.fields)) ? "Fix the highlighted fields first." : null;
}

/** The block the open panel edits, which the page keeps outlined; a thing being added takes the next added id. */
function selectedOf(layer: TeamPageLayer, panel: Panel | null): string | undefined {
  if (panel === null) return undefined;
  if (panel.kind === "person") return panel.spot;
  if (panel.kind === "leader") return `added:${panel.id ?? nextAddedId(layer)}`;
  if (panel.kind === "advisors") return "advisors";
  return panel.at ?? `added:${nextAddedId(layer)}`;
}

/** The rows the panel opens on, each keyed for the panel. */
const keyed = (rows: readonly AdvisorRow[]): KeyedAdvisorRow[] => rows.map((row, i) => ({ ...row, key: i + 1 }));

/** The panel's rows as the working list keeps them. */
const unkeyed = (rows: readonly KeyedAdvisorRow[]): AdvisorRow[] => inPageOrder(rows).map(({ id, fields }) => ({ id, fields }));

export function TeamPageEdit({
  opening,
  advisors,
  academicYear,
  footerProjects,
}: {
  opening: TeamPageOpening;
  advisors: readonly AdvisorItem[];
  academicYear: number;
  /** The published projects the page's footer lists (issue #378). */
  footerProjects: readonly FooterProject[];
}) {
  const { build, base } = opening;
  const [layer, setLayer] = useState<TeamPageLayer>(opening.layer);
  // Null until the layer is first saved: the bar then reads Draft, as board 80 shows it.
  const [layerStatus, setLayerStatus] = useState<ContentStatus | null>(opening.status);
  // The advisors as stored, for the bar's state, and the list the editor works on.
  const [advisorItems, setAdvisorItems] = useState<readonly AdvisorItem[]>(advisors);
  const [advisorRows, setAdvisorRows] = useState<readonly AdvisorRow[]>(() => advisorRowsOf(advisors));
  const [ending, setEnding] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [inPlace, setInPlace] = useState<"intro" | "group-photo" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const status = teamPageStatus(layerStatus, advisorItems);
  const preview = previewOf(build, layer, panel);
  const shownAdvisors = panel?.kind === "advisors" ? panel.rows : advisorRows;
  const edited = useMemo(() => editedTeamPage(build, base, preview), [build, base, preview]);
  const { shown } = edited;
  const page = useMemo(() => withAdvisors(edited.page, advisorsOfRows(shownAdvisors)), [edited, shownAdvisors]);
  const edits = editCount(preview);
  const personPhotos = useMemo(() => personPhotoChoices(build, base), [build, base]);
  const groupPhotos = useMemo(() => groupPhotoChoices(build, base), [build, base]);
  const people = useMemo(() => teamByName(build), [build]);
  /** Every head block in the order the departments' slides draw them. */
  const heads = useMemo(() => (shown?.departments ?? []).flatMap((d) => d.heads.map((h) => h.at)), [shown]);
  /** Each carousel member's head block, in slide order; null for a division drawn at a head's level (issue #325). */
  const carouselSpots = useMemo(() => carouselSpotsOf(shown?.departments ?? []), [shown]);

  const blocks = useMemo(() => {
    const person = (spot: PersonSpot, role: string) => ({
      name: `${role} · ${isEdited(preview, spot) ? "Edited" : "From roles"}`,
      section: spot,
      chip: "Edit person",
    });
    const entries: [string, EditBlocks<string, Section>[string]][] = [
      ["intro", { name: "Intro text", section: "intro" }],
      ["advisors", { name: "Advisors · Added by hand", section: "advisors", chip: "Edit advisors" }],
      ["group-photo", { name: "Group photo", section: "group-photo", chip: "Replace photo" }],
    ];
    if (shown !== null && shown.leader !== null) entries.push(["leader", person("leader", shown.leader.role)]);
    for (const l of shown?.leaders ?? []) {
      if (isArcSpot(l.at)) entries.push([l.at, person(l.at, l.shown.role)]);
      else entries.push([l.at, { name: `${l.shown.role} · Added`, section: `leader:${addedId(l.at)}`, chip: "Edit person" }]);
    }
    for (const at of heads) {
      const added = isAddedRef(at);
      const from = added ? "Added" : isHeadEdited(build, preview, at) ? "Edited" : "From roles";
      entries.push([at, { name: `Head · ${from}`, section: added ? `department:${addedId(at)}` : at }]);
    }
    return Object.fromEntries(entries) as EditBlocks<string, Section>;
  }, [shown, preview, heads, build]);

  const openHead = useCallback(
    (at: HeadRef, addLead = false) => {
      const fields = headFieldsOf(build, layer, at);
      if (fields === null) return;
      setInPlace(null);
      setPanel({ kind: "head", at, fields: addLead ? withNewLead(build, fields) : fields });
    },
    [build, layer],
  );

  const openSection = useCallback(
    (section: Section) => {
      if (section === "intro" || section === "group-photo") {
        setPanel(null);
        setInPlace(section);
        return;
      }
      if (section === "advisors") {
        setInPlace(null);
        setPanel({ kind: "advisors", rows: keyed(advisorRows) });
        return;
      }
      if (section.startsWith("leader:")) {
        const id = Number(section.slice("leader:".length));
        const fields = leaderFieldsOf(build, layer, id);
        if (fields === null) return;
        setInPlace(null);
        setPanel({ kind: "leader", id, fields });
        return;
      }
      if (section.startsWith("department:")) return openHead(`added:${Number(section.slice("department:".length))}`);
      if (section.startsWith("head:")) return openHead(section as HeadSpot);
      const spot = section as PersonSpot;
      const fields = personFieldsOf(build, layer, spot);
      if (fields === null) return;
      setInPlace(null);
      setPanel({ kind: "person", spot, fields });
    },
    [build, layer, openHead, advisorRows],
  );

  const addLeader = (gap: number) => {
    const fields = newLeaderFields(build, layer, gap);
    if (fields === null) return;
    setInPlace(null);
    setPanel({ kind: "leader", id: null, fields });
  };

  const addDepartment = () => {
    const fields = newDepartmentFields(build);
    if (fields === null) return;
    setInPlace(null);
    setPanel({ kind: "head", at: null, fields });
  };

  const adding = panel === null && shown !== null;

  const frames: TeamPageFrames = {
    intro: (node) =>
      inPlace === "intro" ? (
        <IntroBox
          initial={layer.intro ?? base.header.intro}
          original={base.header.intro}
          onChange={(text) => setLayer((l) => withIntro(base, l, text))}
          onDone={() => setInPlace(null)}
        />
      ) : (
        <EditableBlock id="intro">{node}</EditableBlock>
      ),
    leader: (slot, node) => {
      if (shown === null) return node;
      const at = slot === "leader" ? "leader" : shown.leaders[slot]?.at;
      if (at === undefined) return node;
      return (
        <EditableBlock id={at} narrow>
          {node}
        </EditableBlock>
      );
    },
    addLeader: adding && arcHasRoom(build, layer) ? addLeader : null,
    departments: {
      member: (index, node) => {
        const at = carouselSpots[index];
        if (at === undefined || at === null) return node;
        return (
          <EditableBlock id={at}>
            {node}
            {adding && <AddLeadButton onClick={() => openHead(at, true)} />}
          </EditableBlock>
        );
      },
      heading: (node) => (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:justify-center">
          {node}
          {adding && <AddDepartmentButton onClick={addDepartment} />}
        </div>
      ),
    },
    advisors: (node) => <EditableBlock id="advisors">{node}</EditableBlock>,
    note: adding ? <AddedItemsNote /> : null,
    groupPhoto: (node) => (
      <>
        <EditableBlock id="group-photo">{node}</EditableBlock>
        {inPlace === "group-photo" && (
          <GroupPhotoBox
            photo={groupPhotoOf(base, layer)}
            choices={groupPhotos}
            original={base.coreMembers.groupPhoto}
            onChange={(photo) => setLayer((l) => withGroupPhoto(base, l, photo))}
            onDone={() => setInPlace(null)}
          />
        )}
      </>
    ),
  };

  /** The working layer with the panel's edit kept; null while the panel's fields are refused. */
  const keptLayer = (): TeamPageLayer | null => {
    const refusal = panelRefusal(build, layer, panel);
    if (refusal !== null) {
      toast.error(refusal);
      return null;
    }
    return preview;
  };

  /** The working advisor list with the Advisors panel's changes kept. */
  const keptAdvisors = (): readonly AdvisorRow[] => (panel?.kind === "advisors" ? unkeyed(panel.rows) : advisorRows);

  /** The panel's edit kept in the working layer or advisor list, and the panel closed. */
  const keep = () => {
    const next = keptLayer();
    if (next === null) return;
    setLayer(next);
    setAdvisorRows(keptAdvisors());
    setPanel(null);
  };

  /** A change the panel's footer makes to the working layer at once, closing the panel. */
  const closeWith = (change: (layer: TeamPageLayer) => TeamPageLayer) => {
    setLayer(change);
    setPanel(null);
  };

  const save = (step: PublishStep) => {
    const next = keptLayer();
    if (next === null) return;
    const refused = introError(next.intro ?? "");
    if (refused !== undefined) {
      setInPlace("intro");
      toast.error(`Intro text: ${refused}`);
      return;
    }
    const rows = keptAdvisors();
    setLayer(next);
    setAdvisorRows(rows);
    setPanel(null);
    startTransition(async () => {
      // One write: the layer and the advisors land together, or neither does.
      const result = await saveTeamPage(step, next, rows);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLayerStatus(statusOf(result.value.layer));
      setAdvisorItems(result.value.advisors);
      setAdvisorRows(advisorRowsOf(result.value.advisors));
      toast.success(step === "publish" ? "The Team page is published." : "Draft saved. The live Team page stays as it is.");
    });
  };

  const reset = () => {
    startTransition(async () => {
      const result = await resetTeamPageLayer();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // The reset keeps the intro text and the group photo as the editor has them.
      setLayer((l) => resetLayer(l));
      setPanel(null);
      setLayerStatus(statusOf(result.value));
      setResetOpen(false);
      toast.success("The page is back to the team. Publish to put it on the site.");
    });
  };

  /** End advising, confirmed: off the working list once the Team page and the Alumni page have it. */
  const endAdvisor = (id: number, years: { from: number; to: number }) => {
    startTransition(async () => {
      const result = await endAdvising(id, years);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const name = advisorRows.find((r) => r.id === id)?.fields.name ?? "The advisor";
      setAdvisorItems((items) => items.filter((a) => a.id !== id));
      setAdvisorRows((rows) => rows.filter((r) => r.id !== id));
      setPanel((open) => (open?.kind === "advisors" ? { ...open, rows: open.rows.filter((r) => r.id !== id) } : open));
      setEnding(null);
      toast.success(`${name} is now in the Advisors group on the Alumni page.`);
    });
  };

  return (
    <>
      <EditShell
        section={{ label: "About", href: "/about/the-team" }}
        heading="Editing the Team page"
        status={status}
        saved={panel !== null ? "Changes show on the page as you type" : undefined}
        tag={<VisualOnlyTag />}
        actions={
          <BarButton onClick={pending || edits === 0 ? null : () => setResetOpen(true)} icon={<RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}>
            Reset to team
          </BarButton>
        }
        onSaveDraft={pending ? null : () => save("save-draft")}
        onPublish={pending ? null : () => save("publish")}
        blocks={blocks}
        selected={selectedOf(layer, panel)}
        onEdit={openSection}
        panel={
          panel === null ? null : panel.kind === "person" ? (
            <PersonPanel
              panel={panel}
              opening={opening}
              layer={layer}
              errors={personFieldErrors(panel.fields)}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ ...panel, fields })}
              onSave={keep}
              onCancel={() => setPanel(null)}
              onBack={() => closeWith((l) => backToTeamRecord(l, panel.spot))}
            />
          ) : panel.kind === "advisors" ? (
            <TeamAdvisorsPanel
              rows={panel.rows}
              photoChoices={personPhotos}
              onChange={(rows) => setPanel({ kind: "advisors", rows })}
              onDone={keep}
              onCancel={() => setPanel(null)}
              onEnd={setEnding}
            />
          ) : panel.kind === "leader" ? (
            <TeamLeaderPanel
              key={panel.id ?? "new"}
              adding={panel.id === null}
              fields={panel.fields}
              gaps={leaderGaps(build, layer, panel.id)}
              people={people}
              errors={leaderFieldErrors(build, layer, panel.id, panel.fields)}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ ...panel, fields })}
              onPerson={(id) => setPanel({ ...panel, fields: withLeaderPerson(build, panel.fields, id) })}
              onSubmit={keep}
              onCancel={() => setPanel(null)}
              onRemove={panel.id === null ? null : () => closeWith((l) => withoutAddedLeader(l, panel.id!))}
            />
          ) : (
            <HeadPanel
              key={panel.at ?? "new"}
              panel={panel}
              build={build}
              layer={layer}
              people={people}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ ...panel, fields })}
              onDone={keep}
              onCancel={() => setPanel(null)}
              onHide={(at) => closeWith((l) => hideHead(l, at))}
              onBack={(at) => closeWith((l) => headBackToRecord(build, l, at))}
            />
          )
        }
      >
        <TeamPageView page={page} academicYear={academicYear} footerProjects={footerProjects} frames={frames} />
      </EditShell>

      <EndAdvisingDialog
        advisor={ending === null ? null : (advisorItems.find((a) => a.id === ending) ?? null)}
        thisYear={academicYear}
        pending={pending}
        onCancel={() => setEnding(null)}
        onConfirm={(years) => ending !== null && endAdvisor(ending, years)}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        icon={<RotateCcw className="h-5 w-5" strokeWidth={1.75} />}
        title="Reset the Team page to the team?"
        description="Leaders, departments, divisions and leads are rebuilt from the current team, as they are in the dashboard."
        cancelLabel="Keep my edits"
        confirmLabel="Reset to team"
        pending={pending}
        onConfirm={reset}
      >
        <ul className="mt-5 space-y-2.5 rounded-xl border border-hairline bg-ground/40 px-4 py-3.5 text-[13px] leading-snug text-text-2">
          <ResetLine kept={false}>
            Removes {edits === 1 ? "the one edit" : `all ${edits} edits`}: changed names, roles, photos, added leaders and hidden people
          </ResetLine>
          <ResetLine kept>Keeps the advisors, the intro text and the group photo</ResetLine>
          <ResetLine kept>Nothing changes on the live site until you publish</ResetLine>
        </ul>
      </ConfirmDialog>
    </>
  );
}

/** The bar's tag (board 80): every edit here changes only what the page shows. */
function VisualOnlyTag() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-warning/40 bg-warning-soft px-2.5 text-[12px] text-warning">
      <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      Visual changes only
    </span>
  );
}

/** Board 80e's note over the page while the add affordances show: what is added is the Team page's alone. */
function AddedItemsNote() {
  return (
    <div
      role="note"
      className="fixed right-6 top-[88px] z-30 hidden max-w-[468px] overflow-hidden rounded-xl border border-warning/40 bg-panel shadow-lg md:block"
    >
      <div className="flex gap-3 bg-warning-soft px-4 py-3">
        <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
        <p className="text-[12px] leading-relaxed text-text-2">
          Added leaders, departments and leads appear only on the Team page. They do not create roles, departments or divisions in the team. Use
          Team tree for that.
        </p>
      </div>
    </div>
  );
}

const ADD_PILL = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/70 bg-ground font-semibold text-accent transition-colors duration-300 ease-out hover:border-accent hover:bg-accent/10 ${CONTENT_FOCUS}`;

/** "+ Add department" beside a slide's heading (board 80e). */
function AddDepartmentButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${ADD_PILL} h-8 px-3.5 text-[13px]`}>
      <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      Add department
    </button>
  );
}

/** "+ Add division lead" on a hovered head block (board 80e): it sits on the block's outline, at its foot. */
function AddLeadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ADD_PILL} absolute -bottom-3 left-1 z-10 h-6 translate-y-1/2 px-2.5 text-[12px] opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100 focus-visible:opacity-100 md:-bottom-[22px] md:left-0`}
    >
      <Plus aria-hidden className="h-3 w-3" strokeWidth={2} />
      Add division lead
    </button>
  );
}

/** The Edit a head block panel for the open head block, with its errors, Team record and footer actions. */
function HeadPanel({
  panel,
  build,
  layer,
  people,
  photoChoices,
  onChange,
  onDone,
  onCancel,
  onHide,
  onBack,
}: {
  panel: { readonly at: HeadRef | null; readonly fields: HeadFields };
  build: TeamBuild;
  layer: TeamPageLayer;
  people: readonly TeamPerson[];
  photoChoices: readonly PhotoChoice[];
  onChange: (fields: HeadFields) => void;
  onDone: () => void;
  onCancel: () => void;
  onHide: (at: HeadRef) => void;
  onBack: (at: HeadSpot) => void;
}) {
  const { at, fields } = panel;
  const record = at === null ? null : headRecord(build, at);
  const roles = at !== null && !isAddedRef(at) ? at : null;
  const edited = roles !== null && (isHeadEdited(build, layer, roles) || isHeadEdited(build, layerWithHead(build, layer, roles, fields), roles));
  return (
    <TeamHeadPanel
      kind={at === null ? "new" : roles === null ? "added" : "roles"}
      fields={fields}
      record={record?.person ?? null}
      people={people}
      errors={headFieldErrors(at, fields)}
      photoChoices={photoChoices}
      onChange={onChange}
      onPerson={(id) => onChange(withHeadPerson(build, fields, id))}
      onAddLead={() => onChange(withNewLead(build, fields))}
      onDone={onDone}
      onCancel={onCancel}
      onHide={at === null ? null : () => onHide(at)}
      onBack={roles !== null && edited ? () => onBack(roles) : null}
    />
  );
}

/**
 * End advising, confirmed with the academic years they advised (board 80d):
 * the advisor leaves the Team page and joins the Alumni page's Advisors group
 * with their role and years, both at once rather than on Publish.
 */
function EndAdvisingDialog({
  advisor,
  thisYear,
  pending,
  onCancel,
  onConfirm,
}: {
  advisor: AdvisorItem | null;
  thisYear: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (years: { from: number; to: number }) => void;
}) {
  const years = Array.from({ length: Math.max(1, thisYear - FIRST_ALUMNI_YEAR + 1) }, (_, i) => thisYear - i);
  const [from, setFrom] = useState(thisYear);
  const [to, setTo] = useState(thisYear);
  const shown = advisor === null ? null : editorVersion(advisor.version);
  return (
    <ConfirmDialog
      open={shown !== null}
      onOpenChange={(open) => {
        if (open) return;
        onCancel();
        setFrom(thisYear);
        setTo(thisYear);
      }}
      icon={<LogOut className="h-5 w-5" strokeWidth={1.75} />}
      title={`End advising for ${shown?.name ?? ""}?`}
      description={`They leave the Team page and show in the Advisors group on the Alumni page as ${shown?.role ?? ""}, under each year they advised. Both pages change now, not on Publish.`}
      cancelLabel="Keep them"
      confirmLabel="End advising"
      pending={pending}
      onConfirm={() => onConfirm({ from, to })}
    >
      <div role="group" aria-labelledby="end-advising-years" className="mt-5">
        <p id="end-advising-years" className="mb-2 text-[13px] leading-snug text-prt-text">
          Academic years they advised
        </p>
        <div className="flex items-center gap-3">
          <YearSelect
            label="From"
            value={from}
            years={years}
            onChange={(next) => {
              setFrom(next);
              setTo((current) => Math.max(current, next));
            }}
          />
          <span className="text-[13px] text-prt-muted">to</span>
          <YearSelect label="To" value={to} years={years.filter((y) => y >= from)} onChange={setTo} />
        </div>
      </div>
    </ConfirmDialog>
  );
}

function ResetLine({ kept, children }: { kept: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      {kept ? (
        <Check aria-hidden className="mt-px h-4 w-4 shrink-0 text-success" strokeWidth={2} />
      ) : (
        <X aria-hidden className="mt-px h-4 w-4 shrink-0 text-danger" strokeWidth={2} />
      )}
      <span>{children}</span>
    </li>
  );
}

function PersonPanel({
  panel,
  opening,
  layer,
  errors,
  photoChoices,
  onChange,
  onSave,
  onCancel,
  onBack,
}: {
  panel: { readonly spot: PersonSpot; readonly fields: PersonFields };
  opening: TeamPageOpening;
  layer: TeamPageLayer;
  errors: PersonFieldErrors;
  photoChoices: readonly PhotoChoice[];
  onChange: (fields: PersonFields) => void;
  onSave: () => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  const { build } = opening;
  const record = spotRecord(build, panel.spot);
  if (record === null) return null;
  const edited = isEdited(layer, panel.spot) || Object.keys(editOfFields(build, panel.spot, panel.fields)).length > 0;
  return (
    <TeamPersonPanel
      key={panel.spot}
      leader={panel.spot === "leader"}
      place={PLACE}
      record={record}
      people={build.people}
      fields={panel.fields}
      onChange={onChange}
      onPerson={(id) => onChange(withPerson(build, panel.fields, id))}
      errors={errors}
      photoChoices={photoChoices}
      onSave={onSave}
      onCancel={onCancel}
      onBack={edited ? onBack : null}
    />
  );
}

const IN_PLACE_BUTTON = `inline-flex h-8 items-center justify-center rounded-full px-3.5 text-[13px] font-semibold ${CONTENT_FOCUS}`;

/** The intro typed in place (issue #284): a text box in the intro's own type, under the accent edge the outline wears. */
function IntroBox({
  initial,
  original,
  onChange,
  onDone,
}: {
  initial: string;
  original: string;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState(initial);
  const error = introError(text);
  const type = (value: string) => {
    setText(value);
    onChange(value);
  };
  return (
    <div>
      <textarea
        aria-label="Intro text"
        autoFocus
        rows={4}
        value={text}
        aria-invalid={error !== undefined}
        onChange={(e) => type(e.target.value)}
        className={`${PAGE_INTRO} block w-full resize-none rounded-xl border-[1.5px] bg-accent/5 px-3 py-2 focus:outline-none ${error === undefined ? "border-accent" : "border-danger"}`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-prt-muted">
        <span>
          {CURRENT_ACADEMIC_YEAR} shows the current academic year.{" "}
          <span className={`font-mono ${error === undefined ? "" : "text-danger"}`}>
            {[...text.trim()].length} / {TEAM_PAGE_INTRO_MAX}
          </span>
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            disabled={text.trim() === original}
            onClick={() => type(original)}
            className={`${IN_PLACE_BUTTON} border border-white-10 text-prt-text transition-colors duration-300 ease-out enabled:hover:border-border-strong disabled:opacity-50`}
          >
            Use the original
          </button>
          <button type="button" onClick={onDone} className={`${IN_PLACE_BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out hover:opacity-90`}>
            Done
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * The group photo chosen in place (issue #284): the site's own photos and the
 * words that describe it. Each photo keeps the description typed for it
 * (issue #430), so picking another photo shows that photo's own, and the
 * description is optional.
 */
function GroupPhotoBox({
  photo,
  choices,
  original,
  onChange,
  onDone,
}: {
  photo: GroupPhoto;
  choices: readonly PhotoChoice<Photo>[];
  original: GroupPhoto;
  onChange: (photo: GroupPhoto) => void;
  onDone: () => void;
}) {
  const [descriptions, setDescriptions] = useState(() => groupPhotoDescriptions(photo, original));
  const src = photo.src;
  const alt = descriptions[src] ?? photo.alt;
  return (
    <div className="mt-6 rounded-xl border border-hairline bg-panel p-4 md:mt-8 md:p-5">
      <p className="text-[13px] font-semibold text-prt-text">Group photo</p>
      <div role="group" aria-label="Photos on the site" className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {choices.map((choice) => {
          const on = choice.src === src;
          return (
            <button
              key={choice.src}
              type="button"
              aria-pressed={on}
              aria-label={choice.label}
              title={choice.label}
              onClick={() => onChange(describedGroupPhoto(choice.src, descriptions))}
              className={`relative h-[72px] w-[120px] shrink-0 overflow-hidden rounded-[6px] ${on ? "ring-2 ring-accent" : "opacity-70 transition-opacity duration-300 ease-out hover:opacity-100"} ${CONTENT_FOCUS}`}
            >
              <Image src={choice.src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <TextField
          label="Describe the photo"
          hint="optional, for screen readers"
          value={alt}
          limit={300}
          onChange={(value) => {
            setDescriptions((d) => ({ ...d, [src]: value }));
            onChange({ src, alt: value });
          }}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={src === original.src && alt.trim() === original.alt}
          onClick={() => {
            setDescriptions((d) => ({ ...d, [original.src]: original.alt }));
            onChange(original);
          }}
          className={`${IN_PLACE_BUTTON} border border-white-10 text-prt-text transition-colors duration-300 ease-out enabled:hover:border-border-strong disabled:opacity-50`}
        >
          Use the original
        </button>
        <button type="button" onClick={onDone} className={`${IN_PLACE_BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out hover:opacity-90`}>
          Done
        </button>
      </div>
    </div>
  );
}
