"use client";

import { useCallback, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Check, Eye, LoaderCircle, LogOut, Plus, RotateCcw, TriangleAlert, Upload, X } from "lucide-react";
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
  personFieldErrors,
  personFieldsOf,
  personPhotoChoices,
  spotRecord,
  withFigures,
  withGroupPhoto,
  withIntro,
  withPerson,
  withSpotEdit,
  type PersonFieldErrors,
  type PersonFields,
  type PersonSpot,
  type PhotoChoice,
} from "@/lib/about/team-page-edit";
import type { HeaderStat, HeaderStats, PersonPhoto } from "@/lib/about/types";
import type { TeamPageOpening } from "@/lib/about/team-page-editor";
import type { EditBlocks, EditDevice } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentStatus, type PublishStep } from "@/lib/content/versioned";
import { FIRST_ALUMNI_YEAR } from "@/lib/dashboard/alumni";
import { YearSelect } from "./alumni-panels";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { BarButton, EditableBlock, EditShell } from "./edit-shell";
import { shrunkPhoto } from "./outreach-post-photos";
import { PHOTO_ACCEPT } from "./photo-crop-dialog";
import { useBackLink } from "./visited-pages";
import { TeamAdvisorsPanel, type KeyedAdvisorRow } from "./team-advisors-panel";
import { TeamHeadPanel } from "./team-head-panel";
import { TeamLeaderPanel } from "./team-leader-panel";
import { EditedTeamPage } from "./team-page-edit-view";
import { TeamPersonPanel } from "./team-person-panel";

// The Team page editor (boards 80 to 80h, issues #284 and #285): the real
// Team page under the shared edit shell, with the "Visual changes only" tag
// and Reset to team on the bar. Hovering a person on the org chart or a head
// block outlines it with where it comes from and an Edit chip, which opens
// its panel; the intro text with its four figures, and the group photo, which
// may be uploaded (issue #510), are edited in place. The bar's arrow goes back
// to the dashboard page the editor was opened from (issue #510). Board
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

/** What an Edit chip opens: the intro and its figures or the group photo in place, or a panel: a person's spot, a leader the editor added, a head block, a department the editor added. */
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

/** The editor's own address: its back arrow never returns to it. */
const TEAM_PAGE_EDITOR = "/dashboard/team-page";

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
}: {
  opening: TeamPageOpening;
  advisors: readonly AdvisorItem[];
  academicYear: number;
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
  const [device, setDevice] = useState<EditDevice>("desktop");
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const back = useBackLink(TEAM_PAGE_EDITOR);

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
      ["intro", { name: "Intro and figures", section: "intro" }],
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
          initial={{ text: layer.intro ?? base.header.intro, figures: figuresOf(base, layer) }}
          original={{ text: base.header.intro, figures: base.header.stats }}
          phone={device === "phone"}
          onText={(text) => setLayer((l) => withIntro(base, l, text))}
          onFigures={(figures) => setLayer((l) => withFigures(base, l, figures))}
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
        <EditableBlock id={at} shape="narrow">
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
          // The departments' swipe row clips what hangs below it, so a head
          // keeps room under them for the outline's foot.
          <EditableBlock id={at} className="mb-3 md:mb-[22px]">
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
            site={groupPhotos}
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
    const refused = introBlockError(base, next);
    if (refused !== undefined) {
      setInPlace("intro");
      toast.error(refused);
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
      // The reset keeps the intro text, its figures and the group photo as the editor has them.
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
        section={back}
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
