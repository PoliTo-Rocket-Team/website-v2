// What a test developer changed on the Team pages (issue #143). Writes in
// test developer mode never reach a database: they land in one cookie, read
// back on the next request and laid over the arrays in ./team.ts. This
// module only parses and serializes them; lib/dashboard/open.ts reads and
// writes the cookie.

import { LEAVE_REASONS, type Departure, type DivisionRole } from "@/lib/dashboard/team";
import type { DummyNotice } from "./notices";

/**
 * A person's saved drawer and Promote changes: their page title, and their
 * role in each division a change set it in. A role is kept per division, so
 * a change in one never reaches their other divisions (issue #229).
 */
export type MemberChange = {
  readonly pageTitle: string | null;
  /** Division id to the role set in it. */
  readonly roles: Readonly<Record<number, DivisionRole>>;
};

export type TeamEdits = {
  /** Alumni whose "On the site" switch was flipped, by id. */
  readonly shownOnSite: Readonly<Record<number, boolean>>;
  /** Saved drawer and Promote changes, by person id. */
  readonly members: Readonly<Record<number, MemberChange>>;
  /** People moved to alumni, with their years on the team and why they left. */
  readonly movedToAlumni: Readonly<Record<number, Departure>>;
  /** Dashboard notices dismissed under "Needs your attention" (./notices.ts), by id. */
  readonly dismissedNotices: readonly number[];
  /** Dashboard notices the test developer's writes added (./notices.ts), oldest first. */
  readonly notices: readonly DummyNotice[];
};

export const NO_EDITS: TeamEdits = { shownOnSite: {}, members: {}, movedToAlumni: {}, dismissedNotices: [], notices: [] };

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

/** A cookie holds about 4 KB; a notice row is the largest entry, so fewer are kept. */
const MAX_NOTICES = 8;

function readNotice(value: unknown): DummyNotice | null {
  if (!isRecord(value)) return null;
  const { id, recipientId, kind, subject, createdAt, data } = value;
  if (!Number.isInteger(id) || !Number.isInteger(recipientId)) return null;
  if (typeof kind !== "string" || typeof subject !== "string" || typeof createdAt !== "string") return null;
  // What `data` holds is checked when the notice is read (lib/dashboard/notices.ts).
  return { id: id as number, recipientId: recipientId as number, kind, subject, createdAt, data };
}

function readMemberChange(value: unknown): MemberChange | null {
  if (!isRecord(value)) return null;
  const { roles, pageTitle } = value;
  if (pageTitle !== null && typeof pageTitle !== "string") return null;
  return {
    pageTitle: cleanTitle(pageTitle),
    roles: entriesOf(roles, (r) => (r === "lead" || r === "member" ? r : null)),
  };
}

function readDeparture(value: unknown): Departure | null {
  if (!isRecord(value)) return null;
  const { from, to, reason } = value;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (reason !== null && !(LEAVE_REASONS as readonly unknown[]).includes(reason)) return null;
  return { from: from as number, to: to as number, reason: reason as Departure["reason"] };
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
    members: entriesOf(raw.members, readMemberChange),
    movedToAlumni: entriesOf(raw.movedToAlumni, readDeparture),
    dismissedNotices: Array.isArray(raw.dismissedNotices)
      ? raw.dismissedNotices.filter((id): id is number => Number.isInteger(id) && id > 0).slice(-MAX_ENTRIES)
      : [],
    notices: Array.isArray(raw.notices)
      ? raw.notices.flatMap((n) => readNotice(n) ?? []).slice(-MAX_NOTICES)
      : [],
  };
}

export function serializeEdits(edits: TeamEdits): string {
  return JSON.stringify(edits);
}
