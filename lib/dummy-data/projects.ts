import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { ContentStore } from "@/lib/content/editor";
import { memoryContentStore } from "@/lib/content/memory";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import { isProjectRecord } from "@/lib/project-content/check";
import { importedProjects } from "@/lib/project-content/import";
import { PROJECT_SECTIONS, type ProjectRecord, type ProjectSection } from "@/lib/project-content/record";
import {
  contentEditsFrom,
  contentEditsOf,
  NO_CONTENT_EDITS,
  PREVIEW_FULL,
  type ContentEdits,
  type ContentEditsStore,
} from "./content-edits";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// The projects on previews and in test-developer sessions (issue #295), which
// never touch a database. They start from the projects the import carries
// into the database (lib/project-content/import.ts), with VES holding draft
// changes, as board 75b draws it. The public pages read the published
// versions of this seed and never a test developer's changes.
//
// A whole project record (about 7 KB) is bigger than the cookie that keeps a
// test developer's changes (DUMMY_STATE_COOKIE_BYTES), so the cookie keeps,
// per project and version, only the sections that differ from the seed's
// published record (grill #279, R1.3), deflated. An edit that still does not
// fit is refused with a message, never lost. The cookie itself is the open
// editor's to name and set, as the other content types' are
// (lib/dashboard/open.ts).

/** The project the dummy dashboard shows with draft changes (VES, board 75b). */
const DRAFTED_ID = 2;

/** The dashboard's starting projects: the import, with VES's teaser changed in a draft. */
export function dummyProjectSeed(): ContentItem<ProjectRecord>[] {
  return importedProjects().map((item) => {
    if (item.id !== DRAFTED_ID || item.version.state !== "published") return item;
    const published = item.version.published;
    const draft: ProjectRecord = { ...published, teaser: "Two marks, one Mach 1.8 target. Mark II won Design & Build at IREC 2025." };
    return { ...item, version: { state: "published", published, draft } };
  });
}

/**
 * One version as the cookie keeps it: each section that differs from the
 * seed's published record of the same project, and null for an optional
 * section the version leaves out. A project the seed does not hold keeps
 * every section.
 */
export type ProjectPatch = { readonly [K in ProjectSection]?: unknown };

export type DummyProjectEdits = ContentEdits<ProjectPatch>;
export type DummyProjectEditsStore = ContentEditsStore<ProjectPatch>;

const SECTIONS: ReadonlySet<string> = new Set(PROJECT_SECTIONS);

function isPatch(value: unknown): value is ProjectPatch {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).every((key) => SECTIONS.has(key));
}

/** The sections of `record` that differ from `base`'s. */
export function patchOf(base: ProjectRecord | null, record: ProjectRecord): ProjectPatch {
  const from = (base ?? {}) as Record<string, unknown>;
  const to = record as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const section of PROJECT_SECTIONS) {
    if (JSON.stringify(from[section]) === JSON.stringify(to[section])) continue;
    patch[section] = to[section] === undefined ? null : to[section];
  }
  return patch;
}

/** `base` with `patch` laid over it; null when the result is not a whole record. */
export function withPatch(base: ProjectRecord | null, patch: ProjectPatch): ProjectRecord | null {
  const record: Record<string, unknown> = { ...base };
  for (const [section, value] of Object.entries(patch)) {
    if (value === null) delete record[section];
    else record[section] = value;
  }
  return isProjectRecord(record) ? record : null;
}

function mapVersion<A, B>(version: Versioned<A>, map: (content: A) => B): Versioned<B> {
  if (version.state === "draft") return { state: "draft", draft: map(version.draft) };
  return { state: "published", published: map(version.published), draft: version.draft === null ? null : map(version.draft) };
}

/** A patched version read back, or null when any of its versions is not a whole record. */
function patchedVersion(base: ProjectRecord | null, version: Versioned<ProjectPatch>): Versioned<ProjectRecord> | null {
  if (version.state === "draft") {
    const draft = withPatch(base, version.draft);
    return draft === null ? null : { state: "draft", draft };
  }
  const published = withPatch(base, version.published);
  const draft = version.draft === null ? null : withPatch(base, version.draft);
  if (published === null || (version.draft !== null && draft === null)) return null;
  return { state: "published", published, draft };
}

/** What each patch is laid over: the seed's published record of the same project. */
function basesOf(seed: readonly ContentItem<ProjectRecord>[]): (id: number) => ProjectRecord | null {
  const bases = new Map(seed.map((item) => [item.id, item.version.state === "published" ? item.version.published : item.version.draft]));
  return (id) => bases.get(id) ?? null;
}

/** The seed with the test developer's edits laid over it; an edit that no longer reads as a record is dropped. */
export function withProjectEdits(seed: readonly ContentItem<ProjectRecord>[], edits: DummyProjectEdits): ContentItem<ProjectRecord>[] {
  const baseOf = basesOf(seed);
  const order = new Map(edits.order);
  const removed = new Set(edits.removed);
  const saved = new Map(
    edits.saved.flatMap((item) => {
      const version = patchedVersion(baseOf(item.id), item.version);
      return version === null ? [] : [[item.id, { id: item.id, siteOrder: item.siteOrder, version }] as const];
    }),
  );
  const fromSeed = seed.filter((item) => !removed.has(item.id)).map((item) => saved.get(item.id) ?? item);
  const created = [...saved.values()].filter((item) => !seed.some((s) => s.id === item.id));
  return [...fromSeed, ...created].map((item) => ({ ...item, siteOrder: order.get(item.id) ?? item.siteOrder }));
}

/** The edits that turn `seed` into `items`, each saved version kept as its changed sections. */
export function projectEditsOf(seed: readonly ContentItem<ProjectRecord>[], items: readonly ContentItem<ProjectRecord>[]): DummyProjectEdits {
  const baseOf = basesOf(seed);
  const edits = contentEditsOf(seed, items);
  return {
    ...edits,
    saved: edits.saved.map((item) => ({ ...item, version: mapVersion(item.version, (record) => patchOf(baseOf(item.id), record)) })),
  };
}

/**
 * The cookie's value: the edits as JSON, deflated and base64url-encoded. A
 * launch history alone is more than the cookie holds as URL-encoded JSON
 * (the other content types' form), and about a third of that deflated, so a
 * test developer can add a launch on a preview.
 */
export function serializeProjectEdits(edits: DummyProjectEdits): string {
  return deflateRawSync(JSON.stringify(edits)).toString("base64url");
}

/** Room for every project's every section, and no more: a cookie that inflates past it was not written here. */
const MAX_INFLATED_BYTES = 256 * 1024;

/** The edits in the cookie; none when it is absent or not one this code wrote. */
export function parseProjectEdits(value: string | undefined): DummyProjectEdits {
  if (!value) return NO_CONTENT_EDITS;
  try {
    const json = inflateRawSync(Buffer.from(value, "base64url"), { maxOutputLength: MAX_INFLATED_BYTES }).toString("utf8");
    return contentEditsFrom(JSON.parse(json), isPatch);
  } catch {
    return NO_CONTENT_EDITS;
  }
}

export const NO_PROJECT_EDITS: DummyProjectEdits = NO_CONTENT_EDITS;

/**
 * The test developer's projects: the seed with their edits, in a store that
 * keeps each write in their cookie, and refuses one the cookie cannot hold
 * with a message that says so.
 */
export function dummyProjectStore(edits: DummyProjectEditsStore): ContentStore<ProjectRecord> {
  const seed = dummyProjectSeed();
  return memoryContentStore(withProjectEdits(seed, edits.current), async (items) => {
    const next = projectEditsOf(seed, items);
    if (serializeProjectEdits(next).length > DUMMY_STATE_COOKIE_BYTES) return PREVIEW_FULL;
    await edits.save(next);
    return null;
  });
}
