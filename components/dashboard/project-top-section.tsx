"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadProjectBackground } from "@/app/dashboard/project-actions";
import { FACTS_LIMIT, pickableModelsOf, type BackgroundFields, type FactFields, type ProjectFields, type VisualFields } from "@/lib/project-content/fields";
import { BACKGROUND_MAX_BYTES, BACKGROUND_PRESETS, backgroundSrc, type BackgroundPreset, type ProjectRecord } from "@/lib/project-content/record";
import type { TopPart } from "@/lib/project-pages";
import { MODEL_NAMES, cardPosterOf, type RocketModel } from "@/lib/rocket-model";
import { BackgroundCropDialog, type BackgroundCrops } from "./background-crop-dialog";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { PanelSection } from "./edit-panel";
import { PhotosSection, type PhotoUploads } from "./outreach-post-photos";
import { CopyField, EditableList, type FieldErrors } from "./project-panel-parts";

// The Top of the page row of the Edit <project> panel (boards 93 and 93d,
// epics #522 and #614). It opens where it sits, and while it is the row
// opened last the page's top is outlined. Its visual is a model picked in the
// Rocket field (issue #389), one photo, or none, with an optional caption. Its
// background is one of the 17 presets; the home card draws its tall file and the page and the
// Projects list its wide one (`backgroundSrc`). A project that kept its brand
// texture from before presets shows no preset picked until an editor picks
// one. The Upload tile closes the grid: it uploads the editor's own picture,
// cropped Tall and Wide in the crop dialog of board 93f (issue #529). Intro,
// status, dates and key facts follow the background. The page outlines the
// top in three parts, and each part's chip brings its own fields into view:
// the visual and background, the intro, status and dates, and the key facts.

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
  "dark-stripes": "Dark stripes",
};

type VisualKind = VisualFields["kind"];

const VISUALS: readonly { value: VisualKind; label: string }[] = [
  { value: "model", label: "3D model" },
  { value: "photo", label: "Photo" },
  { value: "none", label: "None" },
];

/** The visual a new pick starts from: 3D model draws the model picked last, a photo starts empty. */
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
        : `${MODEL_NAMES[visual.model]} on the page, its Home card and the Projects list.`;
    case "photo":
      return "One photo fills the panel on the page.";
    case "none":
      return "No visual: the key facts sit under the title.";
  }
}

/** One top part's fields: the row's own spacing, and room over them when a chip scrolls them to the panel's top. */
const PART_FIELDS = "scroll-mt-4 space-y-4";

/** The Top of the page row's one line: what the row holds. */
function topSummary(fields: ProjectFields): string {
  const n = fields.hero.facts.length;
  return `Intro, status, dates, ${n} key ${n === 1 ? "fact" : "facts"}`;
}

/**
 * The Top of the page row (boards 93 and 93d, ruling R2.1 on #720): the
 * visual, the rocket, the background, the intro, status, dates and key facts.
 */
export function TopSection({
  fields,
  kind,
  model,
  phone,
  errors,
  uploads,
  cardRef,
  partRef,
  onChange,
}: {
  fields: ProjectFields;
  /** Which models the Rocket field offers (`pickableModelsOf`). */
  kind: ProjectRecord["kind"];
  /** The model the Rocket field opens on (`projectModelOf`). */
  model: RocketModel;
  phone: boolean;
  errors: FieldErrors;
  uploads: PhotoUploads;
  cardRef: (node: HTMLDivElement | null) => void;
  /** The ref each top part's fields take, so the part's chip on the page brings them into view. */
  partRef: (part: TopPart) => (node: HTMLDivElement | null) => void;
  onChange: (change: (fields: ProjectFields) => ProjectFields) => void;
}) {
  const { hero } = fields;
  const setHero = (change: Partial<ProjectFields["hero"]>) => onChange((f) => ({ ...f, hero: { ...f.hero, ...change } }));
  // The model picked last, so a visual switched to Photo or None and back to 3D model draws it again.
  const [picked, setPicked] = useState(hero.visual.kind === "model" ? hero.visual.model : model);
  const pickModel = (next: RocketModel) => {
    setPicked(next);
    setHero({ visual: { kind: "model", model: next } });
  };
  return (
    <PanelSection value="top" cardRef={cardRef} title="Top of the page" summary={topSummary(fields)}>
      <div ref={partRef("visual")} className={PART_FIELDS}>
        <TopVisualEditor
          model={picked}
          visual={hero.visual}
          caption={hero.caption}
          errors={errors}
          uploads={uploads}
          onVisualChange={(change) => onChange((f) => ({ ...f, hero: { ...f.hero, visual: change(f.hero.visual) } }))}
          onCaptionChange={(caption) => setHero({ caption })}
        />
        {hero.visual.kind === "model" && <RocketPicker models={pickableModelsOf(kind)} picked={hero.visual.model} onPick={pickModel} />}
        <BackgroundPicker background={fields.background} discard={uploads.discard} onChange={(background) => onChange((f) => ({ ...f, background }))} />
      </div>
      <div ref={partRef("title")} className={PART_FIELDS}>
        <CopyField label="Intro" rows={3} copy={hero.intro} phone={phone} error={errors["hero.intro"]} onChange={(intro) => setHero({ intro })} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label="Status" value={hero.status} error={errors["hero.status"]} onChange={(status) => setHero({ status })} />
          <TextField label="Dates" value={hero.dates} error={errors["hero.dates"]} onChange={(dates) => setHero({ dates })} />
        </div>
      </div>
      <div ref={partRef("facts")} className="scroll-mt-4">
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
      </div>
    </PanelSection>
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

/**
 * The Rocket field (issue #389), built like the Background picker: a tile per
 * model the project may draw, each its card poster with its name under it.
 * It shows while the visual is 3D model.
 */
function RocketPicker({ models, picked, onPick }: { models: readonly RocketModel[]; picked: RocketModel; onPick: (model: RocketModel) => void }) {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-2 text-[13px] leading-snug text-prt-text">
        Rocket<span className="ml-1.5 text-prt-muted">page, cards and Projects list</span>
      </p>
      <div role="group" aria-labelledby={id} className="grid grid-cols-4 gap-x-1.5 gap-y-2.5">
        {models.map((model) => {
          const on = model === picked;
          return (
            <button key={model} type="button" aria-pressed={on} onClick={() => onPick(model)} className={`group min-w-0 rounded-md text-left ${CONTENT_FOCUS}`}>
              <span
                className={`relative block aspect-[3/4] overflow-hidden rounded-md border-2 bg-white-5 transition-colors duration-300 ease-out ${
                  on ? "border-accent" : "border-transparent group-hover:border-border-strong"
                }`}
              >
                <Image src={cardPosterOf(model)} alt="" fill sizes="100px" className="object-cover" />
              </span>
              <span className={`mt-1 block truncate text-[12px] leading-snug ${on ? "font-semibold text-prt-text" : "text-text-2"}`}>{MODEL_NAMES[model]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The picture types the Upload tile takes, as board 93f says them. */
const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The Background picker (board 93d): the 17 presets, then the Upload tile.
 * The tile picks a picture and opens the crop dialog (board 93f); "Use this
 * background" uploads its Tall and Wide crops, one at a time, and picks them.
 * Picked, the tile shows the Tall crop; clicking it uploads another picture.
 * A crop this panel uploaded and then replaced goes back to `discard`, which
 * deletes its file unless a stored version of a project shows it.
 */
function BackgroundPicker({
  background,
  discard,
  onChange,
}: {
  background: BackgroundFields;
  discard: (src: string) => Promise<unknown>;
  onChange: (background: BackgroundFields) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const picked = background.kind === "preset" ? background.preset : null;
  const uploaded = background.kind === "upload" ? background : null;

  const pick = (next: BackgroundFields) => {
    if (uploaded !== null && (next.kind !== "upload" || next.tall !== uploaded.tall)) {
      void discard(uploaded.tall);
      void discard(uploaded.wide);
    }
    onChange(next);
  };

  const choose = (file: File) => {
    if (!PICTURE_TYPES.includes(file.type)) return void toast.error("Choose a JPG, PNG or WebP picture.");
    if (file.size > BACKGROUND_MAX_BYTES) return void toast.error("The picture must be at most 10 MB.");
    setCropping(file);
  };

  const sent = (crop: File) => {
    const form = new FormData();
    form.set("background", crop);
    return uploadProjectBackground(form);
  };
  const use = async (crops: BackgroundCrops) => {
    setUploading(true);
    try {
      const tall = await sent(crops.tall);
      if (!tall.ok) return void toast.error(tall.error);
      const wide = await sent(crops.wide);
      if (!wide.ok) {
        void discard(tall.value);
        return void toast.error(wide.error);
      }
      pick({ kind: "upload", tall: tall.value, wide: wide.value });
      setCropping(null);
    } catch {
      toast.error("The background could not be uploaded. Try again.");
    } finally {
      setUploading(false);
    }
  };

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
              onClick={() => pick({ kind: "preset", preset })}
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
        <button
          type="button"
          aria-pressed={uploaded !== null}
          aria-label={uploaded === null ? "Upload your own background" : "Your own background. Upload another"}
          onClick={() => input.current?.click()}
          className={`group min-w-0 rounded-md text-left ${CONTENT_FOCUS}`}
        >
          {uploaded === null ? (
            <span className="flex aspect-[16/15] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white-10 text-[12px] text-text-2 transition-colors duration-300 ease-out group-hover:border-border-strong group-hover:text-prt-text">
              <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Upload
            </span>
          ) : (
            <span className="relative block aspect-[16/15] overflow-hidden rounded-md border-2 border-accent">
              {/* An uploaded crop is served as it is, as uploaded photos are. */}
              <Image src={uploaded.tall} alt="" fill sizes="100px" unoptimized className="object-cover" />
            </span>
          )}
          <span className={`mt-1 block truncate text-[12px] leading-snug ${uploaded !== null ? "font-semibold text-prt-text" : "text-text-2"}`}>Your own</span>
        </button>
        <input
          ref={input}
          type="file"
          accept={PICTURE_TYPES.join(",")}
          hidden
          aria-label="Upload your own background"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) choose(file);
          }}
        />
      </div>
      <BackgroundCropDialog file={cropping} pending={uploading} onCancel={() => setCropping(null)} onUse={use} />
    </div>
  );
}
