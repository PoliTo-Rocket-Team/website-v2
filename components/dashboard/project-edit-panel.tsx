"use client";

import type { EditDevice } from "@/lib/content/edit-shell";
import {
  FACTS_LIMIT,
  REASONS_LIMIT,
  type FactFields,
  type PanelSection as Section,
  type PartFields,
  type ProjectFields,
  type ReasonFields,
  type StoryFields,
} from "@/lib/project-content/fields";
import { partNumber, twoDigits } from "@/lib/project-pages";
import { TextField } from "./content-parts";
import { Toggle } from "./controls";
import { EditPanel, PanelSection, usePanelScroll } from "./edit-panel";
import { CopyField, EditableList, type FieldErrors } from "./project-panel-parts";
import {
  GalleryEditor,
  gallerySummary,
  LaunchesEditor,
  launchesSummary,
  PlanEditor,
  planSummary,
  VersionsEditor,
  versionsSummary,
} from "./project-list-sections";

// The Edit <project> panel (board 75c, issues #298 and #299): beside the
// project page under the edit shell, one card per section: Top of the page,
// Name story, Design story, Versions, Launch history (a rocket's only), Plan,
// Why, Gallery and the Next-project card. The list sections are in
// ./project-list-sections.tsx. Every change goes straight back to the page, which
// redraws as the editor types. In Phone the fields that have a phone version
// edit it; an empty phone field shows the desktop text.

export type { FieldErrors };

type Change = (change: (fields: ProjectFields) => ProjectFields) => void;

export function ProjectEditPanel({
  name,
  kind,
  previousName,
  fields,
  onChange,
  device,
  errors,
  expanded,
  onExpandedChange,
  scrollTo,
  onClose,
}: {
  /** The project's name, as the panel's title says it. */
  name: string;
  kind: "vehicle" | "engine";
  /** The project before this one in the site order, whose page shows the next-project card line. */
  previousName: string;
  fields: ProjectFields;
  onChange: Change;
  device: EditDevice;
  errors: FieldErrors;
  expanded: readonly Section[];
  onExpandedChange: (sections: Section[]) => void;
  /** The section an Edit chip just opened, brought into view; a new object each time. */
  scrollTo: { readonly section: Section } | null;
  onClose: () => void;
}) {
  const card = usePanelScroll(scrollTo);
  const phone = device === "phone";
  const { hero, nameStory, design, reasons, versions, launches, plan, gallery } = fields;
  const setHero = (change: Partial<ProjectFields["hero"]>) => onChange((f) => ({ ...f, hero: { ...f.hero, ...change } }));
  const setName = (change: Partial<StoryFields>) => onChange((f) => ({ ...f, nameStory: { ...f.nameStory, ...change } }));
  const setDesign = (change: Partial<ProjectFields["design"]>) => onChange((f) => ({ ...f, design: { ...f.design, ...change } }));
  const setReasons = (change: Partial<ProjectFields["reasons"]>) => onChange((f) => ({ ...f, reasons: { ...f.reasons, ...change } }));
  const setVersions = (next: ProjectFields["versions"]) => onChange((f) => ({ ...f, versions: next }));
  const setPlan = (next: ProjectFields["plan"]) => onChange((f) => ({ ...f, plan: next }));

  return (
    <EditPanel
      label={`Edit ${name}`}
      eyebrow="Project page"
      title={`Edit ${name}`}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      onClose={onClose}
    >
      {phone && (
        <p className="rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
          Phone view: fields with a phone version edit the phone&apos;s text. Leave one empty to show the desktop text.
        </p>
      )}

      <PanelSection value="top" cardRef={card("top")} title="Top of the page" summary={topSummary(fields)}>
        <CopyField label="Intro" rows={3} copy={hero.intro} phone={phone} error={errors["hero.intro"]} onChange={(intro) => setHero({ intro })} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label="Status" value={hero.status} error={errors["hero.status"]} onChange={(status) => setHero({ status })} />
          <TextField label="Dates" value={hero.dates} error={errors["hero.dates"]} onChange={(dates) => setHero({ dates })} />
        </div>
        {hero.caption !== null && (
          <TextField
            label="Visual caption"
            value={hero.caption}
            error={errors["hero.caption"]}
            onChange={(caption) => setHero({ caption })}
          />
        )}
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
      </PanelSection>

      <PanelSection value="name" cardRef={card("name")} title="Name story" summary={`Why it's called ${name}`}>
        <StoryEditor story={nameStory} at="nameStory" phone={phone} errors={errors} onChange={setName} />
      </PanelSection>

      <PanelSection
        value="design"
        cardRef={card("design")}
        title="Design story"
        summary={`The ${kind === "engine" ? "engine" : "rocket"}, part by part`}
      >
        <StoryEditor story={design} at="design" phone={phone} errors={errors} onChange={setDesign} />
        <EditableList
          label="Parts"
          hint="top to bottom, numbered from the bottom"
          items={design.parts}
          limit={{ min: 1, max: 50 }}
          error={errors["design.parts"]}
          blank={() => ({ name: "", desc: "", phone: "" })}
          rowName={(i) => `part ${i + 1}`}
          rowLabel={(i, n) => partNumber(i, n)}
          addLabel="Add part"
          onChange={(parts) => setDesign({ parts })}
          row={(part: PartFields, i, update) => (
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2.5">
              <TextField label="Name" value={part.name} error={errors[`design.parts.${i}.name`]} onChange={(v) => update({ ...part, name: v })} />
              {phone ? (
                <TextField
                  label="Phone description"
                  value={part.phone}
                  error={errors[`design.parts.${i}.phone`]}
                  onChange={(v) => update({ ...part, phone: v })}
                />
              ) : (
                <TextField label="Description" value={part.desc} error={errors[`design.parts.${i}.desc`]} onChange={(v) => update({ ...part, desc: v })} />
              )}
            </div>
          )}
        />
        <TextField
          label="Note under the parts"
          value={design.partsCaption}
          error={errors["design.partsCaption"]}
          onChange={(partsCaption) => setDesign({ partsCaption })}
        />
      </PanelSection>

      <PanelSection
        value="versions"
        cardRef={card("versions")}
        title="Versions"
        summary={versionsSummary(versions)}
        control={<Toggle label="Show Versions on the page" checked={versions.shown} onCheckedChange={(shown) => setVersions({ ...versions, shown })} />}
      >
        <VersionsEditor versions={versions} phone={phone} errors={errors} onChange={setVersions} />
      </PanelSection>

      {kind === "vehicle" && (
        <PanelSection
          value="launches"
          cardRef={card("launches")}
          title="Launch history"
          summary={launchesSummary(launches)}
          control={
            <Toggle
              label="Show Launch history on the page"
              checked={launches.shown}
              onCheckedChange={(shown) => onChange((f) => ({ ...f, launches: { ...f.launches, shown } }))}
            />
          }
        >
          <LaunchesEditor
            launches={launches}
            versionNames={versions.items.map((v) => v.pill.trim()).filter((pill) => pill !== "")}
            phone={phone}
            errors={errors}
            onChange={(change) => onChange((f) => ({ ...f, launches: change(f.launches) }))}
          />
        </PanelSection>
      )}

      <PanelSection
        value="plan"
        cardRef={card("plan")}
        title="Plan"
        summary={planSummary(plan)}
        control={<Toggle label="Show Plan on the page" checked={plan.shown} onCheckedChange={(shown) => setPlan({ ...plan, shown })} />}
      >
        <PlanEditor plan={plan} phone={phone} errors={errors} onChange={setPlan} />
      </PanelSection>

      <PanelSection
        value="reasons"
        cardRef={card("reasons")}
        title="Why"
        summary={reasons.shown ? `${reasons.items.length} numbered ${reasons.items.length === 1 ? "reason" : "reasons"}` : "Not on the page"}
        control={<Toggle label="Show Why on the page" checked={reasons.shown} onCheckedChange={(shown) => setReasons({ shown })} />}
      >
        {!reasons.shown && <p className="text-[12px] text-prt-muted">Off the page. Switch it on to show it; the text here is kept.</p>}
        <TextField
          label="Eyebrow"
          hint="after the section number"
          placeholder="WHY LIQUID"
          value={reasons.eyebrow}
          error={errors["reasons.eyebrow"]}
          onChange={(eyebrow) => setReasons({ eyebrow })}
        />
        <TextField
          label="Title"
          hint="a new line breaks it"
          rows={2}
          value={reasons.title}
          error={errors["reasons.title"]}
          onChange={(title) => setReasons({ title })}
        />
        <EditableList
          label="Reasons"
          hint={`${REASONS_LIMIT.min} to ${REASONS_LIMIT.max}`}
          items={reasons.items}
          limit={REASONS_LIMIT}
          error={errors["reasons.items"]}
          blank={() => ({ title: "", text: "" })}
          rowName={(i) => `reason ${i + 1}`}
          rowLabel={(i) => twoDigits(i + 1)}
          addLabel="Add reason"
          onChange={(items) => setReasons({ items })}
          row={(reason: ReasonFields, i, update) => (
            <>
              <TextField
                label="Title"
                value={reason.title}
                error={errors[`reasons.items.${i}.title`]}
                onChange={(title) => update({ ...reason, title })}
              />
              <TextField
                label="Text"
                rows={3}
                value={reason.text}
                error={errors[`reasons.items.${i}.text`]}
                onChange={(text) => update({ ...reason, text })}
              />
            </>
          )}
        />
      </PanelSection>

      <PanelSection
        value="gallery"
        cardRef={card("gallery")}
        title="Gallery"
        summary={gallerySummary(gallery)}
        control={
          <Toggle
            label="Show Gallery on the page"
            checked={gallery.shown}
            onCheckedChange={(shown) => onChange((f) => ({ ...f, gallery: { ...f.gallery, shown } }))}
          />
        }
      >
        <GalleryEditor gallery={gallery} errors={errors} onChange={(change) => onChange((f) => ({ ...f, gallery: change(f.gallery) }))} />
      </PanelSection>

      <PanelSection value="teaser" cardRef={card("teaser")} title="Next-project card" summary={`The line on ${previousName}'s page`}>
        <TextField
          label="Card line"
          hint={`on ${previousName}'s page, under NEXT PROJECT`}
          rows={2}
          value={fields.teaser}
          error={errors.teaser}
          onChange={(teaser) => onChange((f) => ({ ...f, teaser }))}
        />
      </PanelSection>
    </EditPanel>
  );
}

function topSummary(fields: ProjectFields): string {
  const n = fields.hero.facts.length;
  return `Intro, status, dates, ${n} key ${n === 1 ? "fact" : "facts"}`;
}

/** A story column's title and text: desktop paragraphs in Desktop, the phone's one paragraph in Phone. */
function StoryEditor({
  story,
  at,
  phone,
  errors,
  onChange,
}: {
  story: StoryFields;
  /** Where the story sits in the fields, for its errors. */
  at: "nameStory" | "design";
  phone: boolean;
  errors: FieldErrors;
  onChange: (change: Partial<StoryFields>) => void;
}) {
  return (
    <>
      <TextField label="Title" hint="a new line breaks it" rows={2} value={story.title} error={errors[`${at}.title`]} onChange={(title) => onChange({ title })} />
      {phone ? (
        <TextField label="Text" hint="phone, one paragraph" rows={4} value={story.phone} error={errors[`${at}.phone`]} onChange={(p) => onChange({ phone: p })} />
      ) : (
        <TextField
          label="Text"
          hint="a blank line between paragraphs"
          rows={6}
          value={story.body}
          error={errors[`${at}.body`]}
          onChange={(body) => onChange({ body })}
        />
      )}
    </>
  );
}

