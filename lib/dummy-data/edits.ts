// What a test developer changed on the Team pages (issue #143). Writes in
// test developer mode never reach a database: they land in one cookie, read
// back on the next request and laid over the arrays in ./team.ts. This
// module only parses and serializes them; lib/dashboard/open.ts reads and
// writes the cookie.

import type { MemberEdit } from "@/lib/dashboard/team";

export type TeamEdits = {
  /** Alumni whose "On the site" switch was flipped, by id. */
  readonly shownOnSite: Readonly<Record<number, boolean>>;
  /** Saved drawer changes, by person id. */
  readonly members: Readonly<Record<number, MemberEdit>>;
  /** People moved to alumni, with the year they left. */
  readonly movedToAlumni: Readonly<Record<number, number>>;
};

export const NO_EDITS: TeamEdits = { shownOnSite: {}, members: {}, movedToAlumni: {} };

/** Where the dummy dashboard reads and keeps these edits. */
export type TeamEditsStore = {
  readonly current: TeamEdits;
  save(next: TeamEdits): Promise<void>;
};

/** No edits, and nowhere to keep any. */
export const NO_TEAM_EDITS: TeamEditsStore = { current: NO_EDITS, save: async () => {} };

/** A cookie holds about 4 KB; past this many entries a map keeps its newest. */
const MAX_ENTRIES = 60;
const MAX_TITLE = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entriesOf<T>(value: unknown, read: (v: unknown) => T | null): Record<number, T> {
  if (!isRecord(value)) return {};
  const out: Record<number, T> = {};
  for (const [key, raw] of Object.entries(value).slice(-MAX_ENTRIES)) {
    const id = Number(key);
    const parsed = read(raw);
    if (Number.isInteger(id) && id > 0 && parsed !== null) out[id] = parsed;
  }
  return out;
}

function readMemberEdit(value: unknown): MemberEdit | null {
  if (!isRecord(value)) return null;
  const { role, pageTitle } = value;
  if (role !== null && role !== "division-lead" && role !== "member") return null;
  if (pageTitle !== null && typeof pageTitle !== "string") return null;
  return { role, pageTitle: cleanTitle(pageTitle) };
}

/** A title as typed, trimmed and capped; empty is none. */
export function cleanTitle(title: string | null): string | null {
  const trimmed = title?.trim().slice(0, MAX_TITLE) ?? "";
  return trimmed === "" ? null : trimmed;
}

/** The edits a cookie holds; anything malformed reads as no edits. */
export function parseEdits(cookie: string | null | undefined): TeamEdits {
  if (!cookie) return NO_EDITS;
  let raw: unknown;
  try {
    raw = JSON.parse(cookie);
  } catch {
    return NO_EDITS;
  }
  if (!isRecord(raw)) return NO_EDITS;
  return {
    shownOnSite: entriesOf(raw.shownOnSite, (v) => (typeof v === "boolean" ? v : null)),
    members: entriesOf(raw.members, readMemberEdit),
    movedToAlumni: entriesOf(raw.movedToAlumni, (v) => (Number.isInteger(v) ? (v as number) : null)),
  };
}

export function serializeEdits(edits: TeamEdits): string {
  return JSON.stringify(edits);
}
