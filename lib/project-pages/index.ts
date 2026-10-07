import { pageSlugs, projects, type PageSlug, type Project } from "@/lib/projects";
import { cavour } from "./cavour";
import { efesto } from "./efesto";
import type { GallerySection, LaunchLog, Plan, PlanStep, ProjectPageRecord, Reasons, Version, Versions } from "./types";
import { ves } from "./ves";

export type * from "./types";
export { specRows } from "./types";

const records = { cavour, ves, efesto } satisfies Record<PageSlug, ProjectPageRecord>;

export function pageRecord(slug: PageSlug): ProjectPageRecord {
  return records[slug];
}

/** The project's /projects entry: its name, index, texture. */
export function projectOf(slug: PageSlug): Project {
  const project = projects.find((p) => p.slug === slug);
  if (!project) throw new Error(`No /projects entry for ${slug}`);
  return project;
}

/** The project after this one; the last loops back to the first (Cavour → VES → Efesto → Cavour). */
export function nextOf(slug: PageSlug): Project {
  const at = pageSlugs.indexOf(slug);
  return projectOf(pageSlugs[(at + 1) % pageSlugs.length]);
}

export function teaserOf(slug: PageSlug): string {
  return records[slug].teaser;
}

/** A section after the name and design, with the number it shows. */
export type NumberedSection = { num: string } & (
  | { kind: "versions"; versions: Versions }
  | { kind: "launches"; launches: LaunchLog }
  | { kind: "plan"; plan: Plan }
  | { kind: "reasons"; reasons: Reasons }
  | { kind: "gallery"; gallery: GallerySection }
);

const pad = (i: number) => String(i).padStart(2, "0");

/**
 * The sections after the story, in page order, numbered on from 02 The
 * design. A section the record leaves out takes no number, so the numbers
 * always run 01, 02, 03 ... over what the page shows.
 */
export function sectionsOf(record: ProjectPageRecord): NumberedSection[] {
  const present = [
    record.versions && ({ kind: "versions", versions: record.versions } as const),
    record.launches && ({ kind: "launches", launches: record.launches } as const),
    record.plan && ({ kind: "plan", plan: record.plan } as const),
    record.reasons && ({ kind: "reasons", reasons: record.reasons } as const),
    record.gallery && ({ kind: "gallery", gallery: record.gallery } as const),
  ].filter((s) => s !== undefined);
  return present.map((s, i) => ({ ...s, num: pad(i + 3) }));
}

/** The versions in table order. */
export function versionList(v: Versions): readonly Version[] {
  return [...v.before, v.highlighted, ...v.after];
}

export type PlanStatus = "done" | "now" | "next" | "later";

/** The plan's steps in order, each with its status. */
export function planSteps(plan: Plan): readonly (PlanStep & { status: PlanStatus })[] {
  return [
    ...plan.done.map((s) => ({ ...s, status: "done" as const })),
    { ...plan.now, status: "now" as const },
    ...plan.next.map((s) => ({ ...s, status: "next" as const })),
    ...plan.later.map((s) => ({ ...s, status: "later" as const })),
  ];
}

/** The design list's numbers: drawn top to bottom, numbered bottom to top. */
export const partNumber = (index: number, count: number) => pad(count - index);

export { pad as twoDigits };
