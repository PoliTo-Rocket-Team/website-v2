import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { editorVersion, publicVersion, type ContentItem } from "@/lib/content/versioned";
import type { Spec } from "@/lib/projects";
import type { EngineRecord, ProjectRecord, VehicleRecord } from "./record";

// New project on the dashboard Projects page (issue #301): a name, an address
// and a kind make a stored project whose only version is a draft, so nothing
// of it reaches Home, /projects or its address until it is published. The
// draft starts whole, with a line of starting copy in every section, so the
// editor opens on a page it can save at once and then rewrites. Its card and
// its page draw the shared placeholder rocket (lib/rocket-model.ts): the card
// names no model of its own, and the page's visual panel has a rocket slot
// with none (Owner decision, grill #279, R1.1).

export const PROJECT_KINDS = ["vehicle", "engine"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

/** What New project asks for. */
export type NewProject = { readonly name: string; readonly slug: string; readonly kind: ProjectKind };

/** An address word: lower-case letters and digits, words joined by one hyphen, as the record check reads it. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const NAME_MAX = 40;
export const SLUG_MAX = 40;

/** The address a name suggests: "VES Mark III" is "ves-mark-iii". */
export function slugFrom(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

/** Every address a stored project holds, in its published version or its draft. */
export function takenSlugs(items: readonly ContentItem<ProjectRecord>[]): ReadonlySet<string> {
  return new Set(
    items.flatMap((item) => {
      const published = publicVersion(item.version);
      return published === null ? [editorVersion(item.version).slug] : [editorVersion(item.version).slug, published.slug];
    }),
  );
}

/** One field New project cannot take as it is. */
export type NewProjectProblem = { readonly field: keyof NewProject; readonly error: string };

/** What stops New project, in form order; none when it can be created. */
export function newProjectProblems(input: NewProject, taken: ReadonlySet<string>): NewProjectProblem[] {
  const problems: NewProjectProblem[] = [];
  const name = input.name.trim();
  if (name === "") problems.push({ field: "name", error: "Fill in the name." });
  else if (name.length > NAME_MAX) problems.push({ field: "name", error: `Keep the name to ${NAME_MAX} characters.` });
  if (input.slug === "") problems.push({ field: "slug", error: "Fill in the address." });
  else if (input.slug.length > SLUG_MAX || !SLUG.test(input.slug))
    problems.push({ field: "slug", error: `Use lower-case letters, digits and single hyphens, up to ${SLUG_MAX} characters.` });
  else if (taken.has(input.slug)) problems.push({ field: "slug", error: "Another project has this address." });
  if (!PROJECT_KINDS.includes(input.kind)) problems.push({ field: "kind", error: "Choose a rocket or an engine." });
  return problems;
}

/** What the browser sent, as New project's fields; null when it is not in this shape. */
export function readNewProject(input: unknown): NewProject | null {
  if (typeof input !== "object" || input === null) return null;
  const { name, slug, kind } = input as Record<string, unknown>;
  if (typeof name !== "string" || typeof slug !== "string" || typeof kind !== "string") return null;
  if (!(PROJECT_KINDS as readonly string[]).includes(kind)) return null;
  return { name, slug: slug.trim(), kind: kind as ProjectKind };
}

/** The brand textures (board 21); a new project takes one by its address, so the same address always gets the same one. */
const TEXTURES = ["/textures/project-cavour.webp", "/textures/project-ves.webp", "/textures/project-efesto.webp"] as const;

function textureOf(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TEXTURES[hash % TEXTURES.length];
}

const spec = (label: string, value: string): Spec => ({ label: { text: label }, value: { text: value } });

/** The draft New project stores: whole, with starting copy, and the placeholder rocket on its card and page. */
export function newProjectRecord(input: NewProject, year: number): ProjectRecord {
  const name = input.name.trim();
  const kindLabel = input.kind === "vehicle" ? "Rocket" : "Engine";
  const intro = `${name} is a new ${kindLabel.toLowerCase()} by the PoliTo Rocket Team.`;
  const since = String(year);
  const base = {
    slug: input.slug,
    name,
    texture: textureOf(input.slug),
    description: intro,
    hero: {
      intro: { text: intro },
      status: "IN DESIGN",
      dates: `${since} – NOW`,
      // A rocket slot with no model of its own draws the placeholder.
      visual: { caption: `${name.toUpperCase()} · IN DESIGN`, rocket: {} },
      facts: [{ value: "In design", label: { text: "STATUS" } }] as const,
    },
    nameStory: {
      title: `Why ${name}.`,
      body: { text: [`Where the name ${name} comes from.`] as [string], phone: `Where the name ${name} comes from.` },
    },
    design: {
      title: "How it is built.",
      body: { text: ["What it is made of, and why."] as [string], phone: "What it is made of, and why." },
      parts: {
        label: "Parts",
        caption: "BOTTOM TO TOP",
        items: [{ name, desc: `${kindLabel} · in design`, phone: "In design" }] as const,
      },
    },
    teaser: intro,
  };
  const card = {
    year: { text: `${since}–` },
    status: "IN DESIGN",
    statusTone: "light" as const,
    desc: { text: intro },
    specs: [spec("KIND", kindLabel), spec("SINCE", since), spec("STATUS", "In design")] as const,
  };
  const listing = {
    years: `${since} – NOW`,
    description: { text: intro },
    specs: [
      spec("KIND", kindLabel),
      spec("SINCE", since),
      spec("STATUS", "In design"),
      spec("TEAM", "PRT"),
      spec("CITY", "Torino"),
      spec("SCHOOL", "PoliTo"),
    ] as const,
  };
  if (input.kind === "vehicle") {
    const vehicle: VehicleRecord = { ...base, kind: "vehicle", card, listing: { ...listing, versions: [], logSummary: "IN DESIGN" } };
    return vehicle;
  }
  const engine: EngineRecord = { ...base, kind: "engine", card, listing: { ...listing, workLines: [], milestone: "IN DESIGN" } };
  return engine;
}

/** The draft New project stores, or why not: the fields checked against the addresses already taken. */
export function checkNewProject(input: NewProject, taken: ReadonlySet<string>, year: number): WriteResult<ProjectRecord> {
  const [first] = newProjectProblems(input, taken);
  return first === undefined ? written(newProjectRecord(input, year)) : refused(first.error);
}
