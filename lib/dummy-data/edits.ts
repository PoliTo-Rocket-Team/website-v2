// What a test developer changed on the Team pages (issue #143). Writes in
// test developer mode never reach a database: they land in one cookie, read
// back on the next request and laid over the arrays in ./team.ts. This
// module only parses and serializes them; lib/dashboard/open.ts reads and
// writes the cookie.

import { parseAlumnusKey, type EntryChange, type RoleFix } from "@/lib/about/alumni-record";
import { MAX_ALUMNI_NAME, MAX_ALUMNI_ROLE, type NewAdvisor } from "@/lib/dashboard/alumni";
import { parseMemberDetails, type MemberDetails } from "@/lib/dashboard/details";
import { LEAVE_REASONS, type Departure, type DivisionRole } from "@/lib/dashboard/team";
import type { DummyNotice } from "./notices";
import type { DummyWaiting } from "./team";

/**
 * A person's saved changes on the Members page: their page title, their role
 * in each division a change set it in, their title in a division (Edit
 * details), the divisions they joined (Add member) and left (Remove from
 * <division>). Each is kept per division, so a change in one never reaches
 * their other divisions (issue #229).
 */
export type MemberChange = {
  readonly pageTitle: string | null;
  /** Division id to the role set in it. */
  readonly roles: Readonly<Record<number, DivisionRole>>;
  /** Division id to the title Edit details set there. */
  readonly titles?: Readonly<Record<number, string | null>>;
  /** Division id to the day Add member put them in it. */
  readonly joined?: Readonly<Record<number, string>>;
  /** Divisions Remove from <division> took them out of. */
  readonly left?: readonly number[];
};

/**
 * A division as the test developer left it (issue #232): created, renamed,
 * recoded, closed, or moved to another department when its own closed
 * (#251). It replaces the division ./team.ts starts with, open or closed, or
 * adds a new one.
 */
export type DummyDivisionEdit = {
  /** As stored: "Flight Dynamics Division". */
  readonly name: string;
  readonly code: string | null;
  readonly departmentId: number;
  /** The day it closed ("2026-10-09"); null while it is open. */
  readonly closedOn: string | null;
};

/**
 * A department as the test developer left it (issue #251): created, renamed,
 * recoded or closed. It replaces the department ./team.ts starts with, or
 * adds a new one.
 */
export type DummyDepartmentEdit = {
  readonly name: string;
  readonly code: string | null;
  /** The day it closed; null while it is open. */
  readonly closedOn: string | null;
  /** The head New department picked; null for a department ./team.ts starts with, whose head is in the arrays. */
  readonly headId: number | null;
};

/** Confirm NDA on someone waiting: the day, and the member who confirmed it. */
export type DummyConfirmation = { readonly on: string; readonly by: number };

/**
 * What the test developer changed on the Alumni page (issue #257): how
 * someone shows, by their key ("m12", "e5"), and the advisors they added. A
 * preview keeps no photos.
 */
export type DummyAlumniEdits = {
  readonly entries: Readonly<Record<string, Omit<EntryChange, "photo">>>;
  readonly advisors: readonly NewAdvisor[];
};

export const NO_ALUMNI_EDITS: DummyAlumniEdits = { entries: {}, advisors: [] };

export type TeamEdits = {
  /** The Alumni page's fixes and added advisors. */
  readonly alumni: DummyAlumniEdits;
  /** Saved drawer and Promote changes, by person id. */
  readonly members: Readonly<Record<number, MemberChange>>;
  /** People moved to alumni, with their years on the team and why they left. */
  readonly movedToAlumni: Readonly<Record<number, Departure>>;
  /** Dashboard notices dismissed under "Needs your attention" (./notices.ts), by id. */
  readonly dismissedNotices: readonly number[];
  /** Dashboard notices the test developer's writes added (./notices.ts), oldest first. */
  readonly notices: readonly DummyNotice[];
  /** People Add member added by email (issue #231), beside the ones ./team.ts starts with. */
  readonly added: readonly DummyWaiting[];
  /** Confirm NDA, by the add's join id. */
  readonly confirmed: Readonly<Record<number, DummyConfirmation>>;
  /** Cancel add, by the add's join id. */
  readonly cancelled: readonly number[];
  /** Details saved from Edit details: "p12" for person 12, "w3" for the add with join id 3. */
  readonly details: Readonly<Record<string, MemberDetails>>;
  /** Divisions created, edited, closed or moved (issues #232, #251), by id. */
  readonly divisions: Readonly<Record<number, DummyDivisionEdit>>;
  /** Departments created, edited or closed (issue #251), by id. */
  readonly departments: Readonly<Record<number, DummyDepartmentEdit>>;
  /**
   * People a closed department's "Become an advisor" made advisors (Owner
   * decision, 2026-10-16): each holds one Advisor role in no department and
   * no division, as the database starts it.
   */
  readonly advisorRoles: readonly number[];
};

export const NO_EDITS: TeamEdits = {
  alumni: NO_ALUMNI_EDITS,
  members: {},
  movedToAlumni: {},
  dismissedNotices: [],
  notices: [],
  added: [],
  confirmed: {},
  cancelled: [],
  details: {},
  divisions: {},
  departments: {},
  advisorRoles: [],
};

/** The key `details` keeps a person's or a waiting add's details under. */
export function detailsKey(target: { kind: "person"; id: number } | { kind: "waiting"; joinId: number }): string {
  return target.kind === "person" ? `p${target.id}` : `w${target.joinId}`;
}

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
/** Adds and saved details are the largest entries after notices, so fewer are kept. */
const MAX_ADDED = 6;
const MAX_DETAILS = 6;

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

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Division id to a title; a title may be none (null). */
function readTitles(value: unknown): Record<number, string | null> {
  if (!isRecord(value)) return {};
  const out: Record<number, string | null> = {};
  for (const [key, raw] of Object.entries(value).slice(-MAX_ENTRIES)) {
    const id = Number(key);
    if (Number.isInteger(id) && id > 0 && (raw === null || typeof raw === "string")) out[id] = cleanTitle(raw);
  }
  return out;
}

function readMemberChange(value: unknown): MemberChange | null {
  if (!isRecord(value)) return null;
  const { roles, pageTitle, titles, joined, left } = value;
  if (pageTitle !== null && typeof pageTitle !== "string") return null;
  return {
    pageTitle: cleanTitle(pageTitle),
    roles: entriesOf(roles, (r) => (r === "lead" || r === "member" ? r : null)),
    titles: readTitles(titles),
    joined: entriesOf(joined, (d) => (isDay(d) ? d : null)),
    left: Array.isArray(left) ? left.filter((id): id is number => Number.isInteger(id) && id > 0) : [],
  };
}

function readDeparture(value: unknown): Departure | null {
  if (!isRecord(value)) return null;
  const { from, to, reason } = value;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (reason !== null && !(LEAVE_REASONS as readonly unknown[]).includes(reason)) return null;
  return { from: from as number, to: to as number, reason: reason as Departure["reason"] };
}

function readAdded(value: unknown): DummyWaiting | null {
  if (!isRecord(value)) return null;
  const { joinId, email, firstName, lastName, divisionId, title } = value;
  if (!Number.isInteger(joinId) || !Number.isInteger(divisionId) || typeof email !== "string") return null;
  if (typeof firstName !== "string" || typeof lastName !== "string") return null;
  if (title !== null && typeof title !== "string") return null;
  return { joinId: joinId as number, email, firstName, lastName, divisionId: divisionId as number, title: cleanTitle(title) };
}

function readConfirmation(value: unknown): DummyConfirmation | null {
  if (!isRecord(value) || !isDay(value.on) || !Number.isInteger(value.by)) return null;
  return { on: value.on, by: value.by as number };
}

function readDivision(value: unknown): DummyDivisionEdit | null {
  if (!isRecord(value)) return null;
  const { name, code, departmentId, closedOn } = value;
  if (typeof name !== "string" || name.trim() === "" || !Number.isInteger(departmentId)) return null;
  if (code !== null && typeof code !== "string") return null;
  if (closedOn !== null && !isDay(closedOn)) return null;
  return { name: name.slice(0, 80), code: code === null ? null : code.slice(0, 3), departmentId: departmentId as number, closedOn };
}

function readDepartment(value: unknown): DummyDepartmentEdit | null {
  if (!isRecord(value)) return null;
  const { name, code, closedOn, headId } = value;
  if (typeof name !== "string" || name.trim() === "") return null;
  if (code !== null && typeof code !== "string") return null;
  if (closedOn !== null && !isDay(closedOn)) return null;
  if (headId !== null && !(Number.isInteger(headId) && (headId as number) > 0)) return null;
  return { name: name.slice(0, 80), code: code === null ? null : code.slice(0, 3), closedOn, headId: headId as number | null };
}

function readDetails(value: unknown): Record<string, MemberDetails> {
  if (!isRecord(value)) return {};
  const out: Record<string, MemberDetails> = {};
  for (const [key, raw] of Object.entries(value).slice(-MAX_DETAILS)) {
    const parsed = parseMemberDetails(raw);
    if (/^[pw][1-9]\d*$/.test(key) && parsed.ok) out[key] = parsed.value;
  }
  return out;
}

/** The Alumni page's entries are the largest after notices: fewer are kept. */
const MAX_ALUMNI_ENTRIES = 8;
const MAX_ADVISORS = 3;

function readFix(value: unknown): RoleFix | null {
  if (!isRecord(value) || !Number.isInteger(value.year) || typeof value.group !== "string" || typeof value.role !== "string") return null;
  return { year: value.year as number, group: value.group.slice(0, MAX_ALUMNI_ROLE), role: value.role.slice(0, MAX_ALUMNI_ROLE) };
}

function readEntryChange(value: unknown): Omit<EntryChange, "photo"> | null {
  if (!isRecord(value)) return null;
  const { shown, removed, name, founder, fixes } = value;
  const change: { -readonly [K in keyof Omit<EntryChange, "photo">]: EntryChange[K] } = {};
  if (typeof shown === "boolean") change.shown = shown;
  if (typeof removed === "boolean") change.removed = removed;
  if (name === null || typeof name === "string") change.name = name === null ? null : name.slice(0, MAX_ALUMNI_NAME);
  if (founder === null || founder === "founder" || founder === "co-founder") change.founder = founder;
  if (Array.isArray(fixes)) change.fixes = fixes.flatMap((f) => readFix(f) ?? []).slice(0, 12);
  return change;
}

function readAdvisor(value: unknown): NewAdvisor | null {
  if (!isRecord(value)) return null;
  const { name, role, from, to } = value;
  if (typeof name !== "string" || typeof role !== "string" || !Number.isInteger(from) || !Number.isInteger(to)) return null;
  return { name: name.slice(0, MAX_ALUMNI_NAME), role: role.slice(0, MAX_ALUMNI_ROLE), from: from as number, to: to as number };
}

function readAlumniEdits(value: unknown): DummyAlumniEdits {
  if (!isRecord(value)) return NO_ALUMNI_EDITS;
  const entries: Record<string, Omit<EntryChange, "photo">> = {};
  if (isRecord(value.entries)) {
    for (const [key, raw] of Object.entries(value.entries).slice(-MAX_ALUMNI_ENTRIES)) {
      const change = readEntryChange(raw);
      if (parseAlumnusKey(key) !== null && change !== null) entries[key] = change;
    }
  }
  const advisors = Array.isArray(value.advisors) ? value.advisors.flatMap((a) => readAdvisor(a) ?? []).slice(-MAX_ADVISORS) : [];
  return { entries, advisors };
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
    alumni: readAlumniEdits(raw.alumni),
    members: entriesOf(raw.members, readMemberChange),
    movedToAlumni: entriesOf(raw.movedToAlumni, readDeparture),
    dismissedNotices: Array.isArray(raw.dismissedNotices)
      ? raw.dismissedNotices.filter((id): id is number => Number.isInteger(id) && id > 0).slice(-MAX_ENTRIES)
      : [],
    notices: Array.isArray(raw.notices)
      ? raw.notices.flatMap((n) => readNotice(n) ?? []).slice(-MAX_NOTICES)
      : [],
    added: Array.isArray(raw.added) ? raw.added.flatMap((a) => readAdded(a) ?? []).slice(-MAX_ADDED) : [],
    confirmed: entriesOf(raw.confirmed, readConfirmation),
    cancelled: Array.isArray(raw.cancelled)
      ? raw.cancelled.filter((id): id is number => Number.isInteger(id) && id > 0).slice(-MAX_ENTRIES)
      : [],
    details: readDetails(raw.details),
    divisions: entriesOf(raw.divisions, readDivision),
    departments: entriesOf(raw.departments, readDepartment),
    advisorRoles: Array.isArray(raw.advisorRoles)
      ? raw.advisorRoles.filter((id): id is number => Number.isInteger(id) && id > 0).slice(-MAX_ENTRIES)
      : [],
  };
}

export function serializeEdits(edits: TeamEdits): string {
  return JSON.stringify(edits);
}
