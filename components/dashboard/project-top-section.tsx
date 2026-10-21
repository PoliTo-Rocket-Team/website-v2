"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import type { BackgroundFields, VisualFields } from "@/lib/project-content/fields";
import { BACKGROUND_PRESETS, backgroundSrc, type BackgroundPreset } from "@/lib/project-content/record";
import { MODEL_NAMES, modelsFor, type RocketModel } from "@/lib/rocket-model";
import { CONTENT_FOCUS, TextField } from "./content-parts";
import { Field, inputClass } from "./field";
import { PhotosSection, type PhotoUploads } from "./outreach-post-photos";
import type { FieldErrors } from "./project-panel-parts";

// The visual, caption and background of the Top of the page card (board 93d,
// epic #522). The visual is a 3D model from the models built in code (or the
// outline placeholder), one photo, or none. The background is one of the 18
// presets; the home card draws its tall file and the page and the Projects
// list its wide one (`backgroundSrc`). A project that kept its brand texture
// from before presets shows no preset picked until an editor picks one. The
// Upload tile closes the grid and stays inactive until uploads land (#529).

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

/** The visual a new pick starts from: a model keeps the last one picked, a photo starts empty. */
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
        : `${MODEL_NAMES[visual.model]}. A new project shows the outline rocket until its model is built.`;
    case "photo":
      return "One photo fills the panel on the page.";
    case "none":
      return "No visual: the key facts sit under the title.";
  }
}

export function TopVisualEditor({
  kind,
  visual,
  caption,
  errors,
  uploads,
  onVisualChange,
  onCaptionChange,
}: {
  kind: "vehicle" | "engine";
  visual: VisualFields;
  caption: string;
  errors: FieldErrors;
  uploads: PhotoUploads;
  onVisualChange: (change: (visual: VisualFields) => VisualFields) => void;
  onCaptionChange: (caption: string) => void;
}) {
  const id = useId();
  // The model 3D model goes back to after a photo or none: the last one picked.
  const [lastModel, setLastModel] = useState<RocketModel>(visual.kind === "model" ? visual.model : "placeholder");
  const pickModel = (model: RocketModel) => {
    setLastModel(model);
    onVisualChange(() => ({ kind: "model", model }));
  };
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
              onClick={() => visual.kind !== v.value && onVisualChange(() => switchedTo(v.value, lastModel))}
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

      {visual.kind === "model" && (
        <Field label="Model">
          {(fieldId) => (
            <select
              id={fieldId}
              value={visual.model}
              onChange={(e) => pickModel(e.target.value as RocketModel)}
              className={`${inputClass()} px-2.5`}
            >
              {modelsFor(kind).map((model) => (
                <option key={model} value={model}>
                  {MODEL_NAMES[model]}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

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

export function BackgroundPicker({ background, onChange }: { background: BackgroundFields; onChange: (background: BackgroundFields) => void }) {
  const id = useId();
  const uploadId = useId();
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
            aria-describedby={uploadId}
            className="flex aspect-[16/15] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white-10 text-[12px] text-prt-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Upload
          </button>
          <span id={uploadId} className="mt-1 block truncate text-[12px] leading-snug text-prt-muted">
            Your own · coming later
          </span>
        </div>
      </div>
      {picked === null && <p className="mt-2 text-[12px] text-prt-muted">The project keeps its current background until you pick one.</p>}
    </div>
  );
}
