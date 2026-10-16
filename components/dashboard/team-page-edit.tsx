"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Check, Eye, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { resetTeamPageLayer, saveTeamPageLayer } from "@/app/dashboard/actions";
import { PAGE_INTRO } from "@/components/about/page-header";
import { TeamPageView, type TeamPageFrames } from "@/components/about/team-page";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/about/academic-year-copy";
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
import {
  backToTeamRecord,
  editCount,
  editedTeamPage,
  editOfFields,
  groupPhotoChoices,
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
import { statusOf, type ContentStatus, type PublishStep } from "@/lib/content/versioned";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { BarButton, EditableBlock, EditShell } from "./edit-shell";
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
// "In numbers" have no affordance. The editor holds the working layer and lays
// it on the roles build as it changes; Save draft and Publish send it whole
// to the layer actions, which check it again and write nothing but the layer.

/** What an Edit chip opens: the intro or the group photo in place, or a panel: a person's spot, a leader the editor added, a head block, a department the editor added. */
type Section = "intro" | "group-photo" | PersonSpot | `leader:${number}` | HeadSpot | `department:${number}`;

/** The panel open beside the page, with its fields as the editor fills them. */
type Panel =
  | { readonly kind: "person"; readonly spot: PersonSpot; readonly fields: PersonFields }
  /** `id` null: a leader the "+" is adding. */
  | { readonly kind: "leader"; readonly id: number | null; readonly fields: LeaderFields }
  /** `at` null: a department "+ Add department" is adding. */
  | { readonly kind: "head"; readonly at: HeadRef | null; readonly fields: HeadFields };

const isArcSpot = (at: string): at is ArcSpot => at.startsWith("arc:");
const isAddedRef = (at: string): at is AddedRef => at.startsWith("added:");
const addedId = (at: AddedRef) => Number(at.slice("added:".length));

const PLACE = "Org chart";

/** The layer with the open panel's edit laid on: the page shows it as the editor types, and Cancel drops it. */
function previewOf(build: TeamBuild, layer: TeamPageLayer, panel: Panel | null): TeamPageLayer {
  if (panel === null) return layer;
  if (panel.kind === "person") return withSpotEdit(layer, panel.spot, editOfFields(build, panel.spot, panel.fields));
  if (panel.kind === "leader") return layerWithLeader(build, layer, panel.id, panel.fields);
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
  return hasHeadErrors(headFieldErrors(panel.at, panel.fields)) ? "Fix the highlighted fields first." : null;
}

/** The block the open panel edits, which the page keeps outlined; a thing being added takes the next added id. */
function selectedOf(layer: TeamPageLayer, panel: Panel | null): string | undefined {
  if (panel === null) return undefined;
  if (panel.kind === "person") return panel.spot;
  if (panel.kind === "leader") return `added:${panel.id ?? nextAddedId(layer)}`;
  return panel.at ?? `added:${nextAddedId(layer)}`;
}

export function TeamPageEdit({ opening, academicYear }: { opening: TeamPageOpening; academicYear: number }) {
  const { build, base } = opening;
  const [layer, setLayer] = useState<TeamPageLayer>(opening.layer);
  // Nothing saved yet reads as a draft, as board 80 shows the bar.
  const [status, setStatus] = useState<ContentStatus>(opening.status ?? "draft");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [inPlace, setInPlace] = useState<"intro" | "group-photo" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const preview = previewOf(build, layer, panel);
  const { page, shown } = useMemo(() => editedTeamPage(build, base, preview), [build, base, preview]);
  const edits = editCount(preview);
  const personPhotos = useMemo(() => personPhotoChoices(build, base), [build, base]);
  const groupPhotos = useMemo(() => groupPhotoChoices(build, base), [build, base]);
  const people = useMemo(() => teamByName(build), [build]);
  /** Every head block in the order the departments' slides draw them. */
  const heads = useMemo(() => (shown?.departments ?? []).flatMap((d) => d.heads.map((h) => h.at)), [shown]);

  const blocks = useMemo(() => {
    const person = (spot: PersonSpot, role: string) => ({
      name: `${role} · ${isEdited(preview, spot) ? "Edited" : "From roles"}`,
      section: spot,
      chip: "Edit person",
    });
    const entries: [string, EditBlocks<string, Section>[string]][] = [
      ["intro", { name: "Intro text", section: "intro" }],
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
    [build, layer, openHead],
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
        const at = heads[index];
        if (at === undefined) return node;
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

  /** The panel's edit kept in the working layer, and the panel closed. */
  const keep = () => {
    const next = keptLayer();
    if (next === null) return;
    setLayer(next);
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
    setLayer(next);
    setPanel(null);
    startTransition(async () => {
      const result = await saveTeamPageLayer(step, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus(statusOf(result.value));
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
      setStatus(statusOf(result.value));
      setResetOpen(false);
      toast.success("The page is back to the team. Publish to put it on the site.");
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
        <TeamPageView page={page} academicYear={academicYear} frames={frames} />
      </EditShell>

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

/** The group photo chosen in place (issue #284): the site's own photos and the words that describe it. */
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
  const [alt, setAlt] = useState(photo.alt);
  const src = photo.src;
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
              onClick={() => onChange({ src: choice.src, alt: choice.src === original.src ? original.alt : alt })}
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
          hint="for screen readers"
          value={alt}
          limit={300}
          onChange={(value) => {
            setAlt(value);
            if (value.trim() !== "") onChange({ src, alt: value });
          }}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={src === original.src && alt.trim() === original.alt}
          onClick={() => {
            setAlt(original.alt);
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
