import type { GallerySection, GalleryBlock, Hero, KeyFacts, PartList, Photo, Plan, Prose, Reasons, Title, TopVisual, Versions } from "@/lib/project-pages/types";
import type { OwnModel, OwnRocket, OwnRocketModel } from "@/lib/rocket-model";
import type { EngineBlock, EngineRecord, FlightCount, HomeCard, ProjectBlock, ProjectRecord, StoredLaunch, VehicleRecord } from "./record";

// The project record as it was stored before page blocks (epic #522): fixed
// sections (a name story, a design story, then versions, a launch history, a
// plan, reasons and a gallery, each optional but the stories), a brand
// texture, and the model on the card and in the page's panel. Frozen: the
// import and its revisions (./import.ts, ./revision.ts) wrote records of this
// shape, and migration drizzle/0050_project_page_blocks.sql turns every
// stored one into the record of ./record.ts. `blocksRecordOf` is that
// migration in code: the import is read through it, and
// ./blocks-migration.test.ts runs the migration's SQL on the same records and
// checks both give the same result.

type WithoutCover<L> = L extends unknown ? Omit<L, "cover"> : never;

type LegacyLaunch = WithoutCover<StoredLaunch> & {
  /** One or two photos beside the launch card. */
  photos?: readonly [Photo] | readonly [Photo, Photo];
};

type LegacyHero = Omit<Hero, "visual"> & {
  /** The panel on the texture; with no `rocket` the texture alone; absent, no panel. */
  visual?: { caption: string; rocket?: { own?: OwnRocket } };
  facts: KeyFacts;
};

type LegacyBase = {
  slug: string;
  name: string;
  texture: string;
  description: string;
  hero: LegacyHero;
  nameStory: { title: Title; body: Prose };
  design: { title: Title; body: Prose; parts: PartList };
  versions?: Versions;
  plan?: Plan;
  reasons?: Reasons;
  gallery?: GallerySection;
};

export type LegacyVehicleRecord = LegacyBase & {
  kind: "vehicle";
  card: Omit<HomeCard, "status"> & { status: string | FlightCount; rocket?: OwnRocketModel };
  listing: VehicleRecord["listing"];
  launches?: { title: string; entries: readonly [LegacyLaunch, ...LegacyLaunch[]] };
};

export type LegacyEngineRecord = LegacyBase & {
  kind: "engine";
  card: HomeCard & { rocket?: OwnModel };
  listing: EngineRecord["listing"];
};

export type LegacyProjectRecord = LegacyVehicleRecord | LegacyEngineRecord;

/** The title a Gallery block takes when the migration creates one for launch photos alone. */
export const LAUNCH_PHOTOS_GALLERY_TITLE = "Launch photos.";

/**
 * The top visual a stored panel becomes. A panel with a rocket slot is the
 * model visual, its caption kept; a project with no panel has no visual. A
 * panel with no rocket slot (the texture alone) has no visual kind of its own
 * and is stored by no project, so it reads as none.
 */
function visualOf(hero: LegacyHero): TopVisual {
  const { visual } = hero;
  if (visual?.rocket === undefined) return { kind: "none" };
  return { kind: "model", caption: visual.caption, ...(visual.rocket.own && { own: visual.rocket.own }) };
}

/**
 * The record `legacy` becomes: its sections as page blocks in today's page
 * order (the name and the design story as two half-width text blocks, then
 * versions, the launch history, the plan as a timeline, the reasons as
 * numbered points, the gallery), each shown and named by the section it was.
 * Each launch keeps its first photo as its cover; every second photo is
 * appended to the gallery at the end of the page, which is created there when
 * the project had none (grill #524, R1.2). The texture is kept as its
 * background and the panel's model as its visual (R1.1).
 */
export function blocksRecordOf(legacy: LegacyProjectRecord): ProjectRecord {
  const { texture, nameStory, design, versions, plan, reasons, gallery, hero, ...top } = legacy;
  const meta = <K extends ProjectBlock["kind"]>(id: string, kind: K) => ({ id, kind, hidden: false });
  const launches = legacy.kind === "vehicle" ? legacy.launches : undefined;
  const seconds = (launches?.entries ?? []).flatMap((launch) => (launch.photos?.[1] ? [launch.photos[1]] : []));

  const galleryBlock = ((): GalleryBlock | undefined => {
    if (gallery !== undefined) return { ...meta("gallery", "gallery"), ...gallery, items: [...gallery.items, ...seconds] as GalleryBlock["items"] };
    const [first, ...rest] = seconds;
    return first === undefined ? undefined : { ...meta("gallery", "gallery"), title: LAUNCH_PHOTOS_GALLERY_TITLE, items: [first, ...rest] };
  })();

  const shared: EngineBlock[] = [
    { ...meta("name", "text"), width: "half", heading: { label: "THE NAME", title: nameStory.title }, body: nameStory.body },
    { ...meta("design", "text"), width: "half", heading: { label: "THE DESIGN", title: design.title }, body: design.body, parts: design.parts },
    ...(versions ? [{ ...meta("versions", "versions"), ...versions }] : []),
  ];
  const after: EngineBlock[] = [
    ...(plan ? [{ ...meta("plan", "timeline"), ...plan }] : []),
    ...(reasons ? [{ ...meta("reasons", "points"), ...reasons }] : []),
    ...(galleryBlock ? [galleryBlock] : []),
  ];
  const background = { kind: "texture", src: texture } as const;
  const visual = visualOf(hero);

  if (top.kind === "engine") {
    const { rocket: _model, ...card } = top.card;
    return { ...top, card, background, hero: { ...hero, visual }, blocks: [...shared, ...after] };
  }
  const { rocket: _model, ...card } = top.card;
  const { launches: _launches, ...vehicle } = top as typeof top & { launches?: unknown };
  const history: ProjectBlock[] = launches
    ? [
        {
          ...meta("launches", "launches"),
          title: launches.title,
          entries: launches.entries.map(({ photos, ...launch }) => ({ ...launch, ...(photos && { cover: photos[0] }) })) as unknown as readonly [
            StoredLaunch,
            ...StoredLaunch[],
          ],
        },
      ]
    : [];
  return { ...vehicle, card, background, hero: { ...hero, visual: visual as TopVisual<OwnRocketModel> }, blocks: [...shared, ...history, ...after] };
}
