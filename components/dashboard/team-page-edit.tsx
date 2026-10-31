"use client";

import { useCallback, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Check, Eye, ListOrdered, LoaderCircle, LogOut, Plus, RotateCcw, TriangleAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { endAdvising, resetTeamPageLayer, saveTeamPage, uploadTeamPagePhoto } from "@/app/dashboard/actions";
import { INTRO_WIDTH, PAGE_INTRO } from "@/components/about/page-header";
import type { TeamPageFrames } from "@/components/about/team-page";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/about/academic-year-copy";
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
import { TEAM_PAGE_INTRO_MAX, type GroupPhoto } from "@/lib/about/team-layer";
import { nextSeatId, teamRecordLayout, type LayoutGroup, type TeamLayout } from "@/lib/about/team-layout";
import { groupsKeepable, trimmedGroups } from "@/lib/about/team-page-groups";
import {
  arcHasRoom,
  hasHeadErrors,
  headBackToRecord,
  headFieldErrors,
  headFieldsOf,
  headRecord,
  hideHead,
  isAddedBlock,
  isAddedLeader,
  isHeadEdited,
  layoutWithHead,
  layoutWithLeader,
  leaderFieldErrors,
  leaderFieldsOf,
  leaderGaps,
  newDepartmentFields,
  newLeaderFields,
  pickedHead,
  pickedLeader,
  teamByName,
  withHeadPerson,
  withLeaderPerson,
  withNewLead,
  withoutArcSeat,
  type HeadFields,
  type HeadRef,
  type LeaderFields,
} from "@/lib/about/team-page-add";
import type { TeamPerson } from "@/lib/about/team-person";
import { carouselSpotsOf, type TeamRoles } from "@/lib/about/team-roles";
import {
  backToTeamRecord,
  changesSeat,
  describedGroupPhoto,
  editCount,
  editedTeamPage,
  figureErrors,
  figuresOf,
  groupPhotoChoices,
  groupPhotoDescriptions,
  groupPhotoOf,
  groupPhotoRow,
  hasErrors,
  introBlockError,
  introError,
  isEdited,
  isLeaderSeat,
  personFieldErrors,
  personFieldsOf,
  personPhotoChoices,
  spotRecord,
  withFigures,
  withGroupPhoto,
  withIntro,
  withPerson,
  withPersonFields,
  type PersonFieldErrors,
  type PersonFields,
  type PhotoChoice,
} from "@/lib/about/team-page-edit";
import type { HeaderStat, HeaderStats, PersonPhoto } from "@/lib/about/types";
import type { TeamPageOpening } from "@/lib/about/team-page-editor";
import type { TeamPageContent } from "@/lib/about/team-page-stored";
import type { EditBlocks, EditDevice } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentStatus, type PublishStep } from "@/lib/content/versioned";
import { FIRST_ALUMNI_YEAR } from "@/lib/dashboard/alumni";
import { YearSelect } from "./alumni-panels";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { BarButton, EditableBlock, EditShell } from "./edit-shell";
import { shrunkPhoto } from "./outreach-post-photos";
import { PHOTO_ACCEPT } from "./photo-crop-dialog";
import { TeamAdvisorsPanel, type KeyedAdvisorRow } from "./team-advisors-panel";
import { TeamGroupsPanel } from "./team-groups-panel";
import { TeamHeadPanel } from "./team-head-panel";
import { TeamLeaderPanel } from "./team-leader-panel";
import { EditedTeamPage } from "./team-page-edit-view";
import { TeamPersonPanel } from "./team-person-panel";

// The Team page editor (boards 80 to 80h, issues #284 and #285): the real
// Team page under the shared edit shell, with the "Visual changes only" tag
// and Reset to team on the bar. Each person on the org chart and each head
// block shows at all times an outline with where it comes from and an Edit
// chip, which opens its panel; the intro text with its four figures, and the group photo, which
// may be uploaded (issue #510), are edited in place. The bar's arrow goes back
// to the dashboard home (Owner decision). Board
// 80e's add affordances sit on the page while no panel is open: a "+" at each
// place on the arc (gone at eight leaders), "+ Add department" and "Edit
// groups" (the Department groups panel, issue #856) beside each slide's
// heading, and "+ Add division lead" on every head block, under a
// note that added items show only on the Team page. The core members list and
// "In numbers" have no affordance. The Advisors section is one block (board
// 80c) whose "Edit advisors" opens the Advisors panel (board 80d, issue
// #286). The editor holds the working content, the layout of page seats and
// the intro text, figures and group photo (issue #851), and the working
// advisor list, and draws the page from them as the public page draws it as
// they change; Save draft and Publish send them whole to the save, which
// checks them again and writes nothing but the stored version and the
// advisors. End advising is the one change made at once, after the editor
// confirms the years.

/** What an Edit chip opens: the intro and its figures or the group photo in place, or a panel: a page seat on the org chart, or a department block. */
type Section = "intro" | "group-photo" | "advisors" | `seat:${number}` | `block:${number}`;

/** The panel open beside the page, with its fields as the editor fills them. */
type Panel =
  /** The team leader's page seat or one on the arc the team record fills. */
  | { readonly kind: "person"; readonly seat: number; readonly fields: PersonFields }
  /** A leader the editor added; `id` null: one the "+" is adding. */
  | { readonly kind: "leader"; readonly id: number | null; readonly fields: LeaderFields }
  /** `at` null: a department "+ Add department" is adding. */
  | { readonly kind: "head"; readonly at: HeadRef | null; readonly fields: HeadFields }
  /** The Advisors panel, with its copy of the list: Done keeps it, closing drops it. */
  | { readonly kind: "advisors"; readonly rows: readonly KeyedAdvisorRow[] }
  /** The Department groups panel (issue #856), with its copy of the groups: Done keeps it, closing drops it. */
  | { readonly kind: "groups"; readonly groups: readonly LayoutGroup[] };

const seatKey = (id: number) => `seat:${id}` as const;
const blockKey = (id: number) => `block:${id}` as const;

const PLACE = "Org chart";

/** The bar's arrow and the breadcrumb's first step. */
const BACK = { label: "Dashboard", href: "/dashboard" } as const;

/**
 * The layout with the open panel's edit laid on: the page shows it as the
 * editor types, and Cancel drops it. A leader or head with nobody picked
 * adds nothing yet (issue #618).
 */
function previewOf(roles: TeamRoles, layout: TeamLayout, panel: Panel | null): TeamLayout {
  if (panel === null) return layout;
  if (panel.kind === "person") return withPersonFields(roles, layout, panel.seat, panel.fields);
  if (panel.kind === "leader") {
    const picked = pickedLeader(panel.fields);
    return picked === null ? layout : layoutWithLeader(roles, layout, panel.id, picked);
  }
  if (panel.kind === "advisors") return layout;
  if (panel.kind === "groups") return { ...layout, groups: trimmedGroups(panel.groups) };
  const picked = pickedHead(panel.fields);
  return picked === null ? layout : layoutWithHead(roles, layout, panel.at, picked);
}

/** Whether the head panel edits a department the editor adds or added. */
const addingBlock = (layout: TeamLayout, at: HeadRef | null) => at === null || isAddedBlock(layout, at);

/** What the open panel refuses before it keeps its edit, as one message; null when nothing is refused. */
function panelRefusal(layout: TeamLayout, panel: Panel | null): string | null {
  if (panel === null) return null;
  if (panel.kind === "person") return hasErrors(personFieldErrors(panel.fields)) ? "Fix the highlighted fields first." : null;
  if (panel.kind === "leader") {
    const errors = leaderFieldErrors(layout, panel.id, panel.fields);
    return errors.arc ?? (Object.keys(errors).length > 0 ? "Fix the highlighted fields first." : null);
  }
  if (panel.kind === "advisors") {
    return panel.rows.some((r) => Object.keys(advisorFieldErrors(r.fields)).length > 0) ? "Fix the highlighted advisors first." : null;
  }
  if (panel.kind === "groups") return groupsKeepable(panel.groups) ? null : "Name every group first.";
  return hasHeadErrors(headFieldErrors(addingBlock(layout, panel.at), panel.fields)) ? "Fix the highlighted fields first." : null;
}

/** The block the open panel edits, which the page keeps outlined; a thing being added takes the next seat id. */
function selectedOf(layout: TeamLayout, panel: Panel | null): string | undefined {
  if (panel === null) return undefined;
  if (panel.kind === "person") return seatKey(panel.seat);
  if (panel.kind === "leader") return seatKey(panel.id ?? nextSeatId(layout));
  if (panel.kind === "advisors") return "advisors";
  if (panel.kind === "groups") return undefined;
  return blockKey(panel.at ?? nextSeatId(layout));
}

/** The rows the panel opens on, each keyed for the panel. */
const keyed = (rows: readonly AdvisorRow[]): KeyedAdvisorRow[] => rows.map((row, i) => ({ ...row, key: i + 1 }));

/** The panel's rows as the working list keeps them. */
const unkeyed = (rows: readonly KeyedAdvisorRow[]): AdvisorRow[] => inPageOrder(rows).map(({ id, fields }) => ({ id, fields }));

export function TeamPageEdit({
  opening,
  advisors,
  academicYear,
}: {
  opening: TeamPageOpening;
  advisors: readonly AdvisorItem[];
  academicYear: number;
}) {
  const { roles, base } = opening;
  const [content, setContent] = useState<TeamPageContent>(opening.content);
  // The layout as last stored: Reset to team keeps its group list and each department's group (issue #856).
  const [storedLayout, setStoredLayout] = useState<TeamLayout>(opening.content.layout);
  const { layout, text } = content;
  const setLayout = (change: (layout: TeamLayout) => TeamLayout) => setContent((c) => ({ ...c, layout: change(c.layout) }));
  const setText = (change: (text: TeamPageContent["text"]) => TeamPageContent["text"]) => setContent((c) => ({ ...c, text: change(c.text) }));
  // Null until the layer is first saved: the bar then reads Draft, as board 80 shows it.
  const [layerStatus, setLayerStatus] = useState<ContentStatus | null>(opening.status);
  // The advisors as stored, for the bar's state, and the list the editor works on.
  const [advisorItems, setAdvisorItems] = useState<readonly AdvisorItem[]>(advisors);
  const [advisorRows, setAdvisorRows] = useState<readonly AdvisorRow[]>(() => advisorRowsOf(advisors));
  const [ending, setEnding] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [inPlace, setInPlace] = useState<"intro" | "group-photo" | null>(null);
  const [device, setDevice] = useState<EditDevice>("desktop");
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const status = teamPageStatus(layerStatus, advisorItems);
  const preview = previewOf(roles, layout, panel);
  const shownAdvisors = panel?.kind === "advisors" ? panel.rows : advisorRows;
  const edited = useMemo(() => editedTeamPage(roles, base, { layout: preview, text }), [roles, base, preview, text]);
  const { resolved } = edited;
  const page = useMemo(() => withAdvisors(edited.page, advisorsOfRows(shownAdvisors)), [edited, shownAdvisors]);
  /** The layout Reset to team writes: the team's roles as they are now, in the stored groups. */
  const record = useMemo(() => teamRecordLayout(roles, storedLayout), [roles, storedLayout]);
  const edits = editCount(roles, preview, record);
  const personPhotos = useMemo(() => personPhotoChoices(roles.people, base), [roles, base]);
  const groupPhotos = useMemo(() => groupPhotoChoices(roles.people, base), [roles, base]);
  const people = useMemo(() => teamByName(roles), [roles]);
  /** Every drawn head block in the order the departments' slides draw them. */
  const heads = useMemo(() => resolved.departments.filter((d) => d.heads.length > 0).map((d) => d.at), [resolved]);
  /** Each carousel member's head block, in slide order; null for a division drawn at a head's level (issue #325). */
  const carouselSpots = useMemo(() => {
    const blockOfHead = new Map(preview.departments.map((b) => [b.head.id, b.id]));
    return carouselSpotsOf(resolved.groups).map((at) => (at === null ? null : (blockOfHead.get(at) ?? null)));
  }, [resolved, preview]);

  const blocks = useMemo(() => {
    const person = (id: number, role: string) => ({
      name: `${role} · ${isEdited(preview, id) ? "Edited" : "From roles"}`,
      section: seatKey(id),
      chip: "Edit person",
    });
    const entries: [string, EditBlocks<string, Section>[string]][] = [
      ["intro", { name: "Intro and figures", section: "intro" }],
      ["advisors", { name: "Advisors · Added by hand", section: "advisors", chip: "Edit advisors" }],
      ["group-photo", { name: "Group photo", section: "group-photo", chip: "Replace photo" }],
    ];
    if (resolved.leader !== null && preview.leader !== null) entries.push([seatKey(preview.leader.id), person(preview.leader.id, resolved.leader.role)]);
    for (const l of resolved.leaders) {
      if (!isAddedLeader(preview, l.at)) entries.push([seatKey(l.at), person(l.at, l.shown.role)]);
      else entries.push([seatKey(l.at), { name: `${l.shown.role} · Added`, section: seatKey(l.at), chip: "Edit person" }]);
    }
    for (const at of heads) {
      const from = isAddedBlock(preview, at) ? "Added" : isHeadEdited(roles, preview, at) ? "Edited" : "From roles";
      entries.push([blockKey(at), { name: `Head · ${from}`, section: blockKey(at) }]);
    }
    return Object.fromEntries(entries) as EditBlocks<string, Section>;
  }, [resolved, preview, heads, roles]);

  const openHead = useCallback(
    (at: HeadRef, addLead = false) => {
      const fields = headFieldsOf(roles, layout, at);
      if (fields === null) return;
      setInPlace(null);
      setPanel({ kind: "head", at, fields: addLead ? withNewLead(fields) : fields });
    },
    [roles, layout],
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
      if (section.startsWith("block:")) return openHead(Number(section.slice("block:".length)));
      const id = Number(section.slice("seat:".length));
      if (isAddedLeader(layout, id)) {
        const fields = leaderFieldsOf(roles, layout, id);
        if (fields === null) return;
        setInPlace(null);
        setPanel({ kind: "leader", id, fields });
        return;
      }
      const fields = personFieldsOf(roles, layout, id);
      if (fields === null) return;
      setInPlace(null);
      setPanel({ kind: "person", seat: id, fields });
    },
    [roles, layout, openHead, advisorRows],
  );

  const addLeader = (gap: number) => {
    setInPlace(null);
    setPanel({ kind: "leader", id: null, fields: newLeaderFields(gap) });
  };

  const addDepartment = () => {
    setInPlace(null);
    setPanel({ kind: "head", at: null, fields: newDepartmentFields() });
  };

  const editGroups = () => {
    setInPlace(null);
    setPanel({ kind: "groups", groups: layout.groups });
  };

  const adding = panel === null;

  const frames: TeamPageFrames = {
    intro: (node) =>
      inPlace === "intro" ? (
        <IntroBox
          initial={{ text: text.intro ?? base.header.intro, figures: figuresOf(base, text) }}
          original={{ text: base.header.intro, figures: base.header.stats }}
          phone={device === "phone"}
          onText={(typed) => setText((t) => withIntro(base, t, typed))}
          onFigures={(figures) => setText((t) => withFigures(base, t, figures))}
          onDone={() => setInPlace(null)}
        />
      ) : (
        <EditableBlock id="intro">{node}</EditableBlock>
      ),
    leader: (slot, node) => {
      const id = slot === "leader" ? (resolved.leader === null ? undefined : preview.leader?.id) : resolved.leaders[slot]?.at;
      if (id === undefined) return node;
      return (
        <EditableBlock id={seatKey(id)} shape="narrow">
          {node}
        </EditableBlock>
      );
    },
    addLeader: adding && arcHasRoom(layout) ? addLeader : null,
    departments: {
      member: (index, node) => {
        const at = carouselSpots[index];
        if (at === undefined || at === null) return node;
        return (
          // The departments' swipe row clips what hangs below it (issue
          // #619), so a head keeps room under them for all of it: the
          // outline's foot, the "+ Add division lead" pill centred on it and
          // the pill's 4px focus ring (2px outline at 2px offset): 12px +
          // 12px + 4px below md and 22px + 12px + 4px from md. What hangs
          // above a head sits over its group's heading, inside the row.
          <EditableBlock id={blockKey(at)} className="mb-7 md:mb-[38px]">
            {node}
            {adding && <AddLeadButton onClick={() => openHead(at, true)} />}
          </EditableBlock>
        );
      },
      heading: (node) => (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:justify-center">
          {node}
          {adding && (
            <>
              <AddDepartmentButton onClick={addDepartment} />
              <EditGroupsButton onClick={editGroups} />
            </>
          )}
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
            photo={groupPhotoOf(base, text)}
            site={groupPhotos}
            original={base.coreMembers.groupPhoto}
            onChange={(photo) => setText((t) => withGroupPhoto(base, t, photo))}
            onDone={() => setInPlace(null)}
          />
        )}
      </>
    ),
  };

  /** The working layout with the panel's edit kept; null while the panel's fields are refused. */
  const keptLayout = (): TeamLayout | null => {
    const refusal = panelRefusal(layout, panel);
    if (refusal !== null) {
      toast.error(refusal);
      return null;
    }
    return preview;
  };

  /** The working advisor list with the Advisors panel's changes kept. */
  const keptAdvisors = (): readonly AdvisorRow[] => (panel?.kind === "advisors" ? unkeyed(panel.rows) : advisorRows);

  /** The panel's edit kept in the working layout or advisor list, and the panel closed. */
  const keep = () => {
    const next = keptLayout();
    if (next === null) return;
    setLayout(() => next);
    setAdvisorRows(keptAdvisors());
    setPanel(null);
  };

  /** A change the panel's footer makes to the working layout at once, closing the panel. */
  const closeWith = (change: (layout: TeamLayout) => TeamLayout) => {
    setLayout(change);
    setPanel(null);
  };

  const save = (step: PublishStep) => {
    const nextLayout = keptLayout();
    if (nextLayout === null) return;
    const refused = introBlockError(base, text);
    if (refused !== undefined) {
      setInPlace("intro");
      toast.error(refused);
      return;
    }
    const next: TeamPageContent = { layout: nextLayout, text };
    const rows = keptAdvisors();
    setContent(next);
    setAdvisorRows(rows);
    setPanel(null);
    startTransition(async () => {
      // One write: the content and the advisors land together, or neither does.
      const result = await saveTeamPage(step, next, rows);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLayerStatus(statusOf(result.value.content));
      // The content as saved: a photo picked from a member is its copy now (issue #831), and a page seat whose seat is gone has left.
      const saved = editorVersion(result.value.content);
      setContent(saved);
      setStoredLayout(saved.layout);
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
      // The layout as the team's roles build it now; the reset keeps the intro text, its figures and the group photo as the editor has them.
      const rebuilt = editorVersion(result.value).layout;
      setLayout(() => rebuilt);
      setStoredLayout(rebuilt);
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
        section={BACK}
        heading="Editing the Team page"
        onDeviceChange={setDevice}
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
        selected={selectedOf(layout, panel)}
        onEdit={openSection}
        panel={
          panel === null ? null : panel.kind === "person" ? (
            <PersonPanel
              panel={panel}
              roles={roles}
              layout={layout}
              errors={personFieldErrors(panel.fields)}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ ...panel, fields })}
              onSave={keep}
              onCancel={() => setPanel(null)}
              onBack={() => closeWith((l) => backToTeamRecord(l, panel.seat))}
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
              gaps={leaderGaps(roles, layout, panel.id)}
              people={people}
              errors={leaderFieldErrors(layout, panel.id, panel.fields)}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ ...panel, fields })}
              onPerson={(id) => setPanel({ ...panel, fields: withLeaderPerson(roles, panel.fields, id) })}
              onSubmit={keep}
              onCancel={() => setPanel(null)}
              onRemove={panel.id === null ? null : () => closeWith((l) => withoutArcSeat(l, panel.id!))}
            />
          ) : panel.kind === "groups" ? (
            <TeamGroupsPanel
              layout={{ ...layout, groups: panel.groups }}
              onChange={(groups) => setPanel({ kind: "groups", groups })}
              onDone={keep}
              onCancel={() => setPanel(null)}
            />
          ) : (
            <HeadPanel
              key={panel.at ?? "new"}
              panel={panel}
              roles={roles}
              layout={layout}
              people={people}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ ...panel, fields })}
              onDone={keep}
              onCancel={() => setPanel(null)}
              onHide={(at) => closeWith((l) => hideHead(l, at))}
              onBack={(at) => closeWith((l) => headBackToRecord(roles, l, at))}
            />
          )
        }
      >
        <EditedTeamPage page={page} academicYear={academicYear} frames={frames} />
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
          <ResetLine kept>Keeps the advisors, the intro text and figures, and the group photo</ResetLine>
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

const ADD_PILL = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/70 bg-ground font-semibold text-accent transition-colors duration-300 ease-out hover:border-accent ${CONTENT_FOCUS}`;

/** "+ Add department" beside a slide's heading (board 80e). */
function AddDepartmentButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${ADD_PILL} h-8 px-3.5 text-[13px] hover:bg-accent/10`}>
      <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      Add department
    </button>
  );
}

/** "Edit groups" beside "+ Add department" (issue #856): opens the Department groups panel, in the same pill. */
function EditGroupsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${ADD_PILL} h-8 px-3.5 text-[13px] hover:bg-accent/10`}>
      <ListOrdered aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      Edit groups
    </button>
  );
}

/**
 * "+ Add division lead" on every head block (board 80e), shown at all times on
 * Desktop, Phone and touch (Owner decision on #498, issue #507): it sits on the
 * block's outline, at its foot. Hover and focus only brighten it.
 *
 * The outline is drawn after the block's content at `z-10` (EditableBlock in
 * edit-shell.tsx), so the pill stacks above it at `z-20` and its solid
 * `bg-ground` hides the dashed line under the label (issue #697). For the
 * same reason its hover tint is a layer between that fill and the label,
 * never a see-through fill in place of it.
 */
function AddLeadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ADD_PILL} absolute -bottom-3 left-1 z-20 h-6 translate-y-1/2 px-2.5 text-[12px] before:absolute before:inset-0 before:-z-10 before:rounded-full before:transition-colors before:duration-300 before:ease-out hover:before:bg-accent/10 md:-bottom-[22px] md:left-0`}
    >
      <Plus aria-hidden className="h-3 w-3" strokeWidth={2} />
      Add division lead
    </button>
  );
}

/** The Edit a head block panel for the open head block, with its errors, Team record and footer actions. */
function HeadPanel({
  panel,
  roles,
  layout,
  people,
  photoChoices,
  onChange,
  onDone,
  onCancel,
  onHide,
  onBack,
}: {
  panel: { readonly at: HeadRef | null; readonly fields: HeadFields };
  roles: TeamRoles;
  layout: TeamLayout;
  people: readonly TeamPerson[];
  photoChoices: readonly PhotoChoice[];
  onChange: (fields: HeadFields) => void;
  onDone: () => void;
  onCancel: () => void;
  onHide: (at: HeadRef) => void;
  onBack: (at: HeadRef) => void;
}) {
  const { at, fields } = panel;
  const added = addingBlock(layout, at);
  const fromRecord = at !== null && !added ? at : null;
  const picked = pickedHead(fields);
  const edited =
    fromRecord !== null &&
    (isHeadEdited(roles, layout, fromRecord) || (picked !== null && isHeadEdited(roles, layoutWithHead(roles, layout, fromRecord, picked), fromRecord)));
  return (
    <TeamHeadPanel
      kind={at === null ? "new" : fromRecord === null ? "added" : "roles"}
      fields={fields}
      groups={layout.groups}
      record={fromRecord === null ? null : headRecord(roles, layout, fromRecord)}
      people={people}
      errors={headFieldErrors(added, fields)}
      photoChoices={photoChoices}
      onChange={onChange}
      onPerson={(id) => onChange(withHeadPerson(roles, fields, id))}
      onAddLead={() => onChange(withNewLead(fields))}
      onDone={onDone}
      onCancel={onCancel}
      onHide={at === null ? null : () => onHide(at)}
      onBack={fromRecord !== null && edited ? () => onBack(fromRecord) : null}
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
  roles,
  layout,
  errors,
  photoChoices,
  onChange,
  onSave,
  onCancel,
  onBack,
}: {
  panel: { readonly seat: number; readonly fields: PersonFields };
  roles: TeamRoles;
  layout: TeamLayout;
  errors: PersonFieldErrors;
  photoChoices: readonly PhotoChoice[];
  onChange: (fields: PersonFields) => void;
  onSave: () => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  const record = spotRecord(roles, layout, panel.seat);
  if (record === null) return null;
  const back = backToTeamRecord(layout, panel.seat);
  const edited = isEdited(layout, panel.seat) || changesSeat(roles, back, panel.seat, panel.fields);
  return (
    <TeamPersonPanel
      key={panel.seat}
      leader={isLeaderSeat(layout, panel.seat)}
      place={PLACE}
      record={record}
      people={roles.people}
      fields={panel.fields}
      onChange={onChange}
      onPerson={(id) => onChange(withPerson(roles, panel.fields, id))}
      errors={errors}
      photoChoices={photoChoices}
      onSave={onSave}
      onCancel={onCancel}
      onBack={edited ? onBack : null}
    />
  );
}

const IN_PLACE_BUTTON = `inline-flex h-8 items-center justify-center rounded-full px-3.5 text-[13px] font-semibold ${CONTENT_FOCUS}`;

/** The intro block as typed in place: the intro text and its four figures. */
type IntroBlock = { readonly text: string; readonly figures: HeaderStats };

const sameFigures = (a: HeaderStats, b: HeaderStats) =>
  a.every((f, i) => f.value.trim() === b[i].value && f.label.text.trim() === b[i].label.text && (f.label.phone?.trim() || undefined) === b[i].label.phone);

/**
 * The intro and its four figures typed in place (issues #284 and #510): a
 * text box in the intro's own type, then a value and a label for each figure,
 * under the accent edge the outline wears. There are always four figures. In
 * Phone the labels edit the phone's text, and an empty one shows the desktop
 * label, as the project panel's phone fields do.
 */
function IntroBox({
  initial,
  original,
  phone,
  onText,
  onFigures,
  onDone,
}: {
  initial: IntroBlock;
  original: IntroBlock;
  phone: boolean;
  onText: (text: string) => void;
  onFigures: (figures: HeaderStats) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState(initial.text);
  const [figures, setFigures] = useState(initial.figures);
  const error = introError(text);
  const errors = figureErrors(figures);
  const type = (value: string) => {
    setText(value);
    onText(value);
  };
  const change = (next: HeaderStats) => {
    setFigures(next);
    onFigures(next);
  };
  const changeFigure = (at: number, figure: HeaderStat) => {
    const [a, b, c, d] = figures.map((f, i) => (i === at ? figure : f));
    change([a, b, c, d]);
  };
  const isOriginal = text.trim() === original.text && sameFigures(figures, original.figures);
  return (
    <div>
      <div className={INTRO_WIDTH}>
        <textarea
          aria-label="Intro text"
          autoFocus
          rows={4}
          value={text}
          aria-invalid={error !== undefined}
          onChange={(e) => type(e.target.value)}
          className={`${PAGE_INTRO} block w-full resize-none rounded-xl border-[1.5px] bg-accent/5 px-3 py-2 focus:outline-none ${error === undefined ? "border-accent" : "border-danger"}`}
        />
        <p className="mt-2 text-[12px] text-prt-muted">
          {CURRENT_ACADEMIC_YEAR} shows the current academic year.{" "}
          <span className={`font-mono ${error === undefined ? "" : "text-danger"}`}>
            {[...text.trim()].length} / {TEAM_PAGE_INTRO_MAX}
          </span>
        </p>
      </div>
      <div role="group" aria-label="Figures" className="mt-5 rounded-xl border border-hairline bg-panel p-4 md:mt-7 md:p-5">
        {phone && (
          <p className="mb-4 rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
            Phone view: labels edit the phone&apos;s text. Leave one empty to show the desktop label.
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4">
          {figures.map((figure, i) => (
            <div key={i} className="min-w-0 space-y-2.5">
              <p className="font-mono text-[10px] tracking-[0.2em] text-dim">FIGURE {i + 1}</p>
              <TextField label="Value" value={figure.value} error={errors[i].value} onChange={(value) => changeFigure(i, { ...figure, value })} />
              {phone ? (
                <TextField
                  label="Label"
                  hint="phone"
                  value={figure.label.phone ?? ""}
                  placeholder={figure.label.text}
                  error={errors[i].phone}
                  onChange={(p) => changeFigure(i, { ...figure, label: { ...figure.label, phone: p } })}
                />
              ) : (
                <TextField
                  label="Label"
                  value={figure.label.text}
                  error={errors[i].label}
                  onChange={(t) => changeFigure(i, { ...figure, label: { ...figure.label, text: t } })}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={isOriginal}
          onClick={() => {
            type(original.text);
            change(original.figures);
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

/** A group photo tile's size in the box's row. */
const PHOTO_TILE = "relative h-[72px] w-[120px] shrink-0 overflow-hidden rounded-[6px]";

/**
 * The group photo chosen in place (issue #284): the site's own photos, a new
 * one uploaded from the last tile (issue #510), and the words that describe
 * it. An upload is stored at once through the Team page's upload, shown first
 * in the row and picked; uploading again replaces it, and Save draft or
 * Publish keeps it. Each photo keeps the description typed for it (issue
 * #430), so picking another photo shows that photo's own, and the description
 * is optional. The page box crops every photo to its own shape.
 */
function GroupPhotoBox({
  photo,
  site,
  original,
  onChange,
  onDone,
}: {
  photo: GroupPhoto;
  site: readonly PhotoChoice[];
  original: GroupPhoto;
  onChange: (photo: GroupPhoto) => void;
  onDone: () => void;
}) {
  const [descriptions, setDescriptions] = useState(() => groupPhotoDescriptions(photo, original));
  const [uploads, setUploads] = useState<readonly PersonPhoto[]>([]);
  const src = photo.src;
  const alt = descriptions[src] ?? photo.alt;
  const choices = groupPhotoRow(site, uploads, photo);
  const uploaded = (next: PersonPhoto) => {
    setUploads((list) => [next, ...list.filter((s) => s !== next)]);
    onChange(describedGroupPhoto(next, descriptions));
  };
  return (
    <div className="mt-6 rounded-xl border border-hairline bg-panel p-4 md:mt-8 md:p-5">
      <p className="text-[13px] font-semibold text-prt-text">Group photo</p>
      <div role="group" aria-label="Group photos" className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
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
              className={`${PHOTO_TILE} ${on ? "ring-2 ring-accent" : "opacity-70 transition-opacity duration-300 ease-out hover:opacity-100"} ${CONTENT_FOCUS}`}
            >
              {/* An upload is a store URL, served as stored as person photos are. */}
              <Image src={choice.src} alt="" fill sizes="120px" unoptimized={!choice.src.startsWith("/")} className="object-cover" />
            </button>
          );
        })}
        <GroupPhotoUpload onUploaded={uploaded} />
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

/**
 * The group photo row's last tile (issue #510): picks a photo file, sends it
 * shrunk as the Outreach panel does, and stores it through the Team page's
 * upload, behind the site-content gate. No square crop: the page's wide box
 * crops it.
 */
function GroupPhotoUpload({ onUploaded }: { onUploaded: (src: PersonPhoto) => void }) {
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("photo", await shrunkPhoto(file));
      const result = await uploadTeamPagePhoto(form);
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return;
      }
      onUploaded(result.value);
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className={`${PHOTO_TILE} flex flex-col items-center justify-center gap-1.5 border border-dashed border-white-10 text-[12px] font-semibold text-accent transition-colors duration-300 ease-out hover:border-accent disabled:cursor-wait disabled:opacity-60 ${CONTENT_FOCUS}`}
      >
        {uploading ? (
          <LoaderCircle aria-hidden className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.75} />
        ) : (
          <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        {uploading ? "Uploading…" : "Upload a photo"}
      </button>
    </>
  );
}
