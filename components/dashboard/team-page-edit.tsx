"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Check, Eye, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { resetTeamPageLayer, saveTeamPageLayer } from "@/app/dashboard/actions";
import { PAGE_INTRO } from "@/components/about/page-header";
import { TeamPageView, type TeamPageFrames } from "@/components/about/team-page";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/about/academic-year-copy";
import { resetLayer, TEAM_PAGE_INTRO_MAX, type ArcSpot, type GroupPhoto, type TeamPageLayer } from "@/lib/about/team-layer";
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
import { TeamPersonPanel } from "./team-person-panel";

// The Team page editor (boards 80, 80b and 80h, issue #284): the real Team
// page under the shared edit shell, with the "Visual changes only" tag and
// Reset to team on the bar. Hovering the team leader or a leader on the arc
// outlines them with where they come from and an Edit person chip, which
// opens the Edit person panel; the intro text and the group photo are edited
// in place. The core members list and "In numbers" have no affordance. The
// editor holds the working layer and lays it on the roles build as it
// changes; Save draft and Publish send it whole to the layer actions, which
// check it again and write nothing but the layer.

/** What an Edit chip opens: the intro or the group photo in place, or the Edit person panel for a spot. */
type Section = "intro" | "group-photo" | PersonSpot;

const isArcSpot = (at: string): at is ArcSpot => at.startsWith("arc:");

const PLACE = "Org chart";

export function TeamPageEdit({ opening, academicYear }: { opening: TeamPageOpening; academicYear: number }) {
  const { build, base } = opening;
  const [layer, setLayer] = useState<TeamPageLayer>(opening.layer);
  // Nothing saved yet reads as a draft, as board 80 shows the bar.
  const [status, setStatus] = useState<ContentStatus>(opening.status ?? "draft");
  const [panel, setPanel] = useState<{ readonly spot: PersonSpot; readonly fields: PersonFields } | null>(null);
  const [inPlace, setInPlace] = useState<"intro" | "group-photo" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // The page shows the panel's edit as the editor types; Cancel drops it.
  const preview = panel === null ? layer : withSpotEdit(layer, panel.spot, editOfFields(build, panel.spot, panel.fields));
  const { page, shown } = useMemo(() => editedTeamPage(build, base, preview), [build, base, preview]);
  const errors = panel === null ? {} : personFieldErrors(panel.fields);
  const edits = editCount(preview);
  const personPhotos = useMemo(() => personPhotoChoices(build, base), [build, base]);
  const groupPhotos = useMemo(() => groupPhotoChoices(build, base), [build, base]);

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
    for (const l of shown?.leaders ?? []) if (isArcSpot(l.at)) entries.push([l.at, person(l.at, l.shown.role)]);
    return Object.fromEntries(entries) as EditBlocks<string, Section>;
  }, [shown, preview]);

  const openSection = useCallback(
    (section: Section) => {
      if (section === "intro" || section === "group-photo") {
        setPanel(null);
        setInPlace(section);
        return;
      }
      const fields = personFieldsOf(build, layer, section);
      if (fields === null) return;
      setInPlace(null);
      setPanel({ spot: section, fields });
    },
    [build, layer],
  );

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
      if (at === undefined || (at !== "leader" && !isArcSpot(at))) return node;
      return (
        <EditableBlock id={at} narrow>
          {node}
        </EditableBlock>
      );
    },
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
    if (panel === null) return layer;
    if (hasErrors(errors)) {
      toast.error("Fix the highlighted fields first.");
      return null;
    }
    return preview;
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
        selected={panel?.spot}
        onEdit={openSection}
        panel={
          panel !== null && (
            <PersonPanel
              panel={panel}
              opening={opening}
              layer={layer}
              errors={errors}
              photoChoices={personPhotos}
              onChange={(fields) => setPanel({ spot: panel.spot, fields })}
              onSave={() => {
                const next = keptLayer();
                if (next === null) return;
                setLayer(next);
                setPanel(null);
              }}
              onCancel={() => setPanel(null)}
              onBack={() => {
                setLayer((l) => backToTeamRecord(l, panel.spot));
                setPanel(null);
              }}
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
