"use client";

import { useId } from "react";
import Image from "next/image";
import { ChevronDown, ImagePlus } from "lucide-react";
import { FACTS_LIMIT, type BackgroundFields, type FactFields, type ProjectFields, type VisualFields } from "@/lib/project-content/fields";
import { BACKGROUND_PRESETS, backgroundSrc, type BackgroundPreset } from "@/lib/project-content/record";
import { MODEL_NAMES, type RocketModel } from "@/lib/rocket-model";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { SECTION_CARD } from "./edit-panel";
import { PhotosSection, type PhotoUploads } from "./outreach-post-photos";
import { BackToBlocks } from "./project-blocks";
import { CopyField, EditableList, type FieldErrors } from "./project-panel-parts";

// The Top of the page card of the Edit <project> panel (boards 93 and 93d,
// epic #522). Closed, it is a card over Page blocks; opened, it takes the
// cards' place with "Page blocks" to go back, and the page's top is outlined.
// Its visual is the project's own model (the outline rocket until one is
// built), one photo, or none, with an optional caption. Its background is one
// of the 18 presets; the home card draws its tall file and the page and the
// Projects list its wide one (`backgroundSrc`). A project that kept its brand
// texture from before presets shows no preset picked until an editor picks
// one. The Upload tile closes the grid and stays inactive until uploads land
// (#529). Intro, status, dates and key facts follow the background.

/** What each preset is called under its swatch (board 93d). */
const PRESET_NAMES: Readonly<Record<BackgroundPreset, string>> = {
  gradient: "Gradient",
  orange: "Orange",
  black: "Black",
  white: "White",
  "nozzle-orange": "Nozzle",
  "nozzle-grey": "Nozzle grey",
  "fan-orange": "Fan",
  "fan-grey": "Fan grey",
  "horizon-orange": "Horizon",
  "horizon-grey": "Horizon grey",
  "cloud-orange": "Cloud",
  "cloud-grey": "Cloud grey",
  "orange-streaks": "Orange streaks",
  "grey-streaks": "Grey streaks",
  ember: "Ember",
  flare: "Flare",
  "projects-page": "Projects page",
  "cavour-page": "Cavour page",
};

type VisualKind = VisualFields["kind"];

const VISUALS: readonly { value: VisualKind; label: string }[] = [
  { value: "model", label: "3D model" },
  { value: "photo", label: "Photo" },
  { value: "none", label: "None" },
];

/** The visual a new pick starts from: 3D model draws the project's own model, a photo starts empty. */
function switchedTo(kind: VisualKind, model: RocketModel): VisualFields {
  switch (kind) {
    case "model":
      return { kind: "model", model };
    case "photo":
      return { kind: "photo", photo: null };
    case "none":
      return { kind: "none" };
  }
}

function visualNote(visual: VisualFields): string {
  switch (visual.kind) {
    case "model":
      return visual.model === "placeholder"
        ? "The outline rocket, for a project whose model is not built yet."
        : `${MODEL_NAMES[visual.model]}, the project's own model. A new project shows the outline rocket until its model is built.`;
    case "photo":
      return "One photo fills the panel on the page.";
    case "none":
      return "No visual: the key facts sit under the title.";
  }
}

/** The closed Top of the page card over Page blocks (board 93); it opens the card in the cards' place. */
export function TopCard({ fields, onOpen }: { fields: ProjectFields; onOpen: () => void }) {
  const n = fields.hero.facts.length;
  return (
    <div className={SECTION_CARD}>
      <h3>
        <button
          type="button"
          onClick={onOpen}
          className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left ${CONTENT_FOCUS}`}
        >
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold leading-snug">Top of the page</span>
            <span className="mt-0.5 block truncate text-[12px] text-prt-muted">{`Intro, status, dates, ${n} key ${n === 1 ? "fact" : "facts"}`}</span>
          </span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
        </button>
      </h3>
    </div>
  );
}

/** The Top of the page card opened in the cards' place (board 93d). */
export function TopPanel({
  fields,
  model,
  phone,
  errors,
  uploads,
  onChange,
  onBack,
}: {
  fields: ProjectFields;
  /** The model 3D model draws (`projectModelOf`). */
  model: RocketModel;
  phone: boolean;
  errors: FieldErrors;
  uploads: PhotoUploads;
  onChange: (change: (fields: ProjectFields) => ProjectFields) => void;
  onBack: () => void;
}) {
  const { hero } = fields;
  const setHero = (change: Partial<ProjectFields["hero"]>) => onChange((f) => ({ ...f, hero: { ...f.hero, ...change } }));
  return (
    <div className="space-y-4">
      <BackToBlocks onBack={onBack} />
      <section aria-label="Top of the page" className="space-y-4 rounded-xl border border-accent px-4 pb-4 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Top of the page</p>
        <TopVisualEditor
          model={model}
          visual={hero.visual}
          caption={hero.caption}
          errors={errors}
          uploads={uploads}
          onVisualChange={(change) => onChange((f) => ({ ...f, hero: { ...f.hero, visual: change(f.hero.visual) } }))}
          onCaptionChange={(caption) => setHero({ caption })}
        />
        <BackgroundPicker background={fields.background} onChange={(background) => onChange((f) => ({ ...f, background }))} />
        <CopyField label="Intro" rows={3} copy={hero.intro} phone={phone} error={errors["hero.intro"]} onChange={(intro) => setHero({ intro })} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label="Status" value={hero.status} error={errors["hero.status"]} onChange={(status) => setHero({ status })} />
          <TextField label="Dates" value={hero.dates} error={errors["hero.dates"]} onChange={(dates) => setHero({ dates })} />
        </div>
        <EditableList
          label="Key facts"
          hint={`${FACTS_LIMIT.min} to ${FACTS_LIMIT.max}`}
          items={hero.facts}
          limit={FACTS_LIMIT}
          error={errors["hero.facts"]}
          blank={() => ({ value: "", label: { text: "", phone: "" } })}
          rowName={(i) => `key fact ${i + 1}`}
          addLabel="Add key fact"
          onChange={(facts) => setHero({ facts })}
          row={(fact: FactFields, i, update) => (
            <div className="grid grid-cols-2 gap-2.5">
              <TextField label="Value" value={fact.value} error={errors[`hero.facts.${i}.value`]} onChange={(value) => update({ ...fact, value })} />
              <CopyField
                label="Label"
                copy={fact.label}
                phone={phone}
                error={errors[`hero.facts.${i}.label`]}
                onChange={(label) => update({ ...fact, label })}
              />
            </div>
          )}
        />
      </section>
    </div>
  );
}

function TopVisualEditor({
  model,
  visual,
  caption,
  errors,
  uploads,
  onVisualChange,
  onCaptionChange,
}: {
  model: RocketModel;
  visual: VisualFields;
  caption: string;
  errors: FieldErrors;
  uploads: PhotoUploads;
  onVisualChange: (change: (visual: VisualFields) => VisualFields) => void;
  onCaptionChange: (caption: string) => void;
}) {
  const id = useId();
  return (
    <>
      <div>
        <p id={id} className="mb-2 text-[13px] leading-snug text-prt-text">
          Visual
        </p>
        <div role="group" aria-labelledby={id} className="grid grid-cols-3 gap-1 rounded-[10px] border border-white-10 bg-white-5 p-1">
          {VISUALS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={visual.kind === v.value}
              onClick={() => visual.kind !== v.value && onVisualChange(() => switchedTo(v.value, model))}
              className={`h-9 rounded-lg text-[14px] transition-colors duration-300 ease-out ${CONTENT_FOCUS} ${
                visual.kind === v.value ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-text-2">{visualNote(visual)}</p>
      </div>

      {visual.kind === "photo" && (
        <div>
          <p className="mb-2 text-[13px] leading-snug text-prt-text">
            Photo<span className="ml-1.5 text-prt-muted">one, the panel&apos;s full width</span>
          </p>
          <PhotosSection
            photos={visual.photo === null ? [] : [visual.photo]}
            onChange={(change) =>
              onVisualChange((v) => {
                if (v.kind !== "photo") return v;
                const [photo = null] = change(v.photo === null ? [] : [v.photo]);
                return { kind: "photo", photo };
              })
            }
            uploads={uploads}
            cover={false}
            max={1}
            error={errors["hero.visual"]}
          />
        </div>
      )}

      {visual.kind !== "none" && <TextField label="Caption" hint="optional" value={caption} onChange={onCaptionChange} />}
    </>
  );
}

function BackgroundPicker({ background, onChange }: { background: BackgroundFields; onChange: (background: BackgroundFields) => void }) {
  const id = useId();
  const picked = background.kind === "preset" ? background.preset : null;
  return (
    <div>
      <p id={id} className="mb-2 text-[13px] leading-snug text-prt-text">
        Background<span className="ml-1.5 text-prt-muted">cards and behind the visual</span>
      </p>
      <div role="group" aria-labelledby={id} className="grid grid-cols-4 gap-x-1.5 gap-y-2.5">
        {BACKGROUND_PRESETS.map((preset) => {
          const on = preset === picked;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ kind: "preset", preset })}
              className={`group min-w-0 rounded-md text-left ${CONTENT_FOCUS}`}
            >
              <span
                className={`relative block aspect-[16/15] overflow-hidden rounded-md border-2 transition-colors duration-300 ease-out ${
                  on ? "border-accent" : "border-transparent group-hover:border-border-strong"
                }`}
              >
                <Image src={backgroundSrc({ kind: "preset", preset }, "tall")} alt="" fill sizes="100px" className="object-cover" />
              </span>
              <span className={`mt-1 block truncate text-[12px] leading-snug ${on ? "font-semibold text-prt-text" : "text-text-2"}`}>
                {PRESET_NAMES[preset]}
              </span>
            </button>
          );
        })}
        <div className="min-w-0">
          <button
            type="button"
            disabled
            aria-label="Upload your own background"
            className="flex aspect-[16/15] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white-10 text-[12px] text-prt-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Upload
          </button>
          <span aria-hidden className="mt-1 block truncate text-[12px] leading-snug text-prt-muted">
            Your own
          </span>
        </div>
      </div>
    </div>
  );
}
