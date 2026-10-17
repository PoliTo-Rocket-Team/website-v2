import { ADVISORS } from "@/lib/about/alumni-record";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import type { ContentStore } from "@/lib/content/editor";
import { nextSiteOrder } from "@/lib/content/order";
import { textLength } from "@/lib/content/text";
import {
  afterStep,
  editorVersion,
  publicVersion,
  statusOf,
  type ContentItem,
  type ContentStatus,
  type PublishStep,
  type Versioned,
} from "@/lib/content/versioned";
import { checkAdvisor, type NewAdvisor } from "@/lib/dashboard/alumni";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { isLinkedinHandle, TEAM_PAGE_TEXT_MAX } from "./team-layer";
import { linkedinHandle } from "./team-page-edit";
import type { Advisor, PersonPhoto, TeamPage } from "./types";

// The Team page's advisors (issue #286, boards 80c and 80d): faculty and
// specialists outside the student team, added by hand and never built from
// roles. Each advisor is one item in the shared content store (lib/content/),
// with a published version the public page shows and an optional draft, as
// Partners and FAQ keep theirs. The Team page editor's Save draft and Publish
// send the whole list: add, edit, reorder and Principal / Specialist changes
// stay drafts until Publish. End advising is the one change made at once: the
// advisor leaves the Team page and an Alumni entry in its Advisors group
// takes their role and years. Nothing here writes a role, division,
// department, scope or member, and Reset to team never reaches the advisors.

export type AdvisorStanding = Advisor["standing"];

/** The page lists principal advisors first, then specialists (board 80d). */
export const ADVISOR_STANDINGS = ["principal", "specialist"] as const satisfies readonly AdvisorStanding[];

/** One advisor's version as the store keeps it. */
export type AdvisorVersion = {
  readonly name: string;
  readonly role: string;
  readonly standing: AdvisorStanding;
  readonly photo?: PersonPhoto;
  /** The LinkedIn handle, the part after linkedin.com/in/. */
  readonly linkedin?: string;
  readonly email?: string;
  /**
   * Their place among the advisors of their standing, from 1. It is part of
   * the version, not the item's site order, so a reorder waits for Publish as
   * any other edit does.
   */
  readonly place: number;
};

export type AdvisorItem = ContentItem<AdvisorVersion>;

/** The longest email the panel takes. */
export const ADVISOR_EMAIL_MAX = 254;

// Read back from storage ------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.trim() !== "" && textLength(value) <= max;
const isPhoto = (value: unknown): value is PersonPhoto =>
  typeof value === "string" && textLength(value) <= 2048 && (value.startsWith("/team/") || value.startsWith("https://"));
const isEmail = (value: unknown): value is string => typeof value === "string" && value.length <= ADVISOR_EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isStanding = (value: unknown): value is AdvisorStanding => (ADVISOR_STANDINGS as readonly unknown[]).includes(value);

const VERSION_KEYS = new Set(["name", "role", "standing", "photo", "linkedin", "email", "place"]);

/** A version this code could have written; anything else is skipped on read. */
export function isAdvisorVersion(value: unknown): value is AdvisorVersion {
  if (!isRecord(value) || !Object.keys(value).every((key) => VERSION_KEYS.has(key))) return false;
  return (
    isText(value.name, TEAM_PAGE_TEXT_MAX) &&
    isText(value.role, TEAM_PAGE_TEXT_MAX) &&
    isStanding(value.standing) &&
    Number.isSafeInteger(value.place) &&
    (value.place as number) > 0 &&
    (value.photo === undefined || isPhoto(value.photo)) &&
    (value.linkedin === undefined || isLinkedinHandle(value.linkedin)) &&
    (value.email === undefined || isEmail(value.email))
  );
}

// The seed: today's advisors --------------------------------------------------

/**
 * The advisors the hand-typed record lists (lib/about/team.ts), carried into
 * the store as they are: ids and site order from 1 in the record's order,
 * each published with no draft. Migration 0035 imports exactly these
 * (`advisorImportSql`), and the dummy data starts from them.
 */
export function advisorSeed(people: readonly Advisor[]): AdvisorItem[] {
  const placed = new Map<AdvisorStanding, number>();
  return people.map((advisor, i) => {
    const place = (placed.get(advisor.standing) ?? 0) + 1;
    placed.set(advisor.standing, place);
    return { id: i + 1, siteOrder: i + 1, version: { state: "published", published: { ...advisor, place }, draft: null } };
  });
}

// What the page shows -----------------------------------------------------------

/** Principal advisors first, then specialists, each by place; the id settles a tie. */
function byPage<V extends AdvisorVersion>(a: { id: number; version: V }, b: { id: number; version: V }): number {
  const standing = ADVISOR_STANDINGS.indexOf(a.version.standing) - ADVISOR_STANDINGS.indexOf(b.version.standing);
  return standing || a.version.place - b.version.place || a.id - b.id;
}

/** An advisor as the page draws them: the version without its place. */
export function advisorOf({ place: _, ...advisor }: AdvisorVersion): Advisor {
  return advisor;
}

/** The advisors the public page shows: each published version, in page order. A draft never reaches it. */
export function publicAdvisors(items: readonly AdvisorItem[]): Advisor[] {
  return items
    .flatMap((item) => {
      const version = publicVersion(item.version);
      return version === null ? [] : [{ id: item.id, version }];
    })
    .sort(byPage)
    .map(({ version }) => advisorOf(version));
}

/** The page with `people` as its advisors; the section's title and intro stay the record's. */
export function withAdvisors(page: TeamPage, people: readonly Advisor[]): TeamPage {
  return { ...page, advisors: { ...page.advisors, people } };
}

/**
 * The state the edit bar shows for the whole Team page (board 80): Draft
 * until the visual layer was first published, Published when the layer and
 * every advisor are, Draft changes otherwise.
 */
export function teamPageStatus(layer: ContentStatus | null, advisors: readonly AdvisorItem[]): ContentStatus {
  if (layer === null || layer === "draft") return "draft";
  return layer === "published" && advisors.every((a) => statusOf(a.version) === "published") ? "published" : "draft-changes";
}

// The panel's fields (board 80d) ----------------------------------------------

/** One advisor as the panel edits them: plain text, with no photo as null. */
export type AdvisorFields = {
  readonly name: string;
  readonly role: string;
  readonly standing: AdvisorStanding;
  readonly photo: PersonPhoto | null;
  readonly linkedin: string;
  readonly email: string;
};

/** One row of the panel's list: a stored advisor (`id`), or one Add advisor made (`id` null). */
export type AdvisorRow = { readonly id: number | null; readonly fields: AdvisorFields };

export const NEW_ADVISOR: AdvisorFields = { name: "", role: "", standing: "specialist", photo: null, linkedin: "", email: "" };

export function fieldsOf(advisor: Omit<AdvisorVersion, "place">): AdvisorFields {
  return {
    name: advisor.name,
    role: advisor.role,
    standing: advisor.standing,
    photo: advisor.photo ?? null,
    linkedin: advisor.linkedin ?? "",
    email: advisor.email ?? "",
  };
}

/** The panel's rows: what the editor works on (the draft, else the published version), in page order. */
export function advisorRowsOf(items: readonly AdvisorItem[]): AdvisorRow[] {
  return items
    .map((item) => ({ id: item.id, version: editorVersion(item.version) }))
    .sort(byPage)
    .map(({ id, version }) => ({ id, fields: fieldsOf(version) }));
}

/** The rows grouped as the page lists them, principal advisors first, each group in the order it had. */
export function inPageOrder<R extends { readonly fields: { readonly standing: AdvisorStanding } }>(rows: readonly R[]): R[] {
  return ADVISOR_STANDINGS.flatMap((standing) => rows.filter((r) => r.fields.standing === standing));
}

export type AdvisorFieldErrors = { readonly name?: string; readonly role?: string; readonly linkedin?: string; readonly email?: string };

const TOO_LONG = `Up to ${TEAM_PAGE_TEXT_MAX} characters.`;

/** What the panel refuses before it keeps an advisor. */
export function advisorFieldErrors(fields: AdvisorFields): AdvisorFieldErrors {
  const name = fields.name.trim();
  const role = fields.role.trim();
  const linkedin = linkedinHandle(fields.linkedin);
  const email = fields.email.trim();
  return {
    ...(name === "" ? { name: "Enter their full name." } : textLength(name) > TEAM_PAGE_TEXT_MAX && { name: TOO_LONG }),
    ...(role === "" ? { role: "Enter their role on the page." } : textLength(role) > TEAM_PAGE_TEXT_MAX && { role: TOO_LONG }),
    ...(linkedin !== "" && !isLinkedinHandle(linkedin) && { linkedin: "Enter the part after linkedin.com/in/." }),
    ...(email !== "" && !isEmail(email) && { email: "Enter an email address." }),
  };
}

/** The advisor the fields describe, trimmed, with each empty fact left out; null while the fields are refused. */
export function advisorOfFields(fields: AdvisorFields): Omit<AdvisorVersion, "place"> | null {
  if (Object.keys(advisorFieldErrors(fields)).length > 0) return null;
  const linkedin = linkedinHandle(fields.linkedin);
  const email = fields.email.trim();
  return {
    name: fields.name.trim().replace(/\s+/g, " "),
    role: fields.role.trim().replace(/\s+/g, " "),
    standing: fields.standing,
    ...(fields.photo !== null && { photo: fields.photo }),
    ...(linkedin !== "" && { linkedin }),
    ...(email !== "" && { email }),
  };
}

/** The advisors the rows show on the page, in their order; rows still refused are left out. */
export function advisorsOfRows(rows: readonly AdvisorRow[]): Advisor[] {
  return inPageOrder(rows).flatMap((row) => {
    const advisor = advisorOfFields(row.fields);
    return advisor === null ? [] : [advisor];
  });
}

const isFields = (value: unknown): value is AdvisorFields =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.role === "string" &&
  isStanding(value.standing) &&
  (value.photo === null || isPhoto(value.photo)) &&
  typeof value.linkedin === "string" &&
  typeof value.email === "string";

const isRow = (value: unknown): value is AdvisorRow =>
  isRecord(value) && (value.id === null || (Number.isSafeInteger(value.id) && (value.id as number) > 0)) && isFields(value.fields);

// The store and the editor ------------------------------------------------------

/** An ended advisor as the Alumni page's Advisors group keeps them: name, role, years, and the photo the Team page showed. */
export type AlumniAdvisor = NewAdvisor & { readonly photo: PersonPhoto | null };

/** One write a Save draft or Publish makes: a new advisor at a site order, or a stored one's new versions. */
export type AdvisorWrite =
  | { readonly kind: "create"; readonly version: Versioned<AdvisorVersion>; readonly siteOrder: number }
  | { readonly kind: "update"; readonly id: number; readonly version: Versioned<AdvisorVersion> };

/**
 * Where the advisors are kept. Beside the content store's writes, a Save
 * draft or Publish lands every write of the list in one step, and End
 * advising takes the advisor off the list and adds their Alumni entry in one
 * step, so the two pages never disagree about them.
 */
export interface AdvisorStore extends ContentStore<AdvisorVersion> {
  /** Every write lands, or none does: a refusal or a failure leaves the advisors as they were. */
  saveAll(writes: readonly AdvisorWrite[]): Promise<WriteResult<null>>;
  endAdvising(id: number, alumni: AlumniAdvisor): Promise<WriteResult<null>>;
}

export interface AdvisorEditor {
  /** Every advisor, null for a viewer without site-content access. */
  list(): Promise<readonly AdvisorItem[] | null>;
  /** Save draft or Publish the panel's rows, as the editor sent them, in page order; answers the advisors as stored. */
  save(step: PublishStep, rows: unknown): Promise<WriteResult<AdvisorItem[]>>;
  /** End advising (board 80d): off the Team page now, into the Alumni page's Advisors group for the years sent. */
  end(id: number, years: unknown): Promise<WriteResult<null>>;
}

export const ADVISORS_CHANGED = "The advisors changed since you opened them. Reload the page and try again.";

const sameVersion = (a: AdvisorVersion, b: AdvisorVersion) =>
  a.name === b.name &&
  a.role === b.role &&
  a.standing === b.standing &&
  a.photo === b.photo &&
  a.linkedin === b.linkedin &&
  a.email === b.email &&
  a.place === b.place;

/** Each row's advisor with their place in their standing, in the rows' order; refused at the first row the panel would refuse. */
function placedOf(rows: readonly AdvisorRow[]): WriteResult<{ id: number | null; version: AdvisorVersion }[]> {
  const placed = new Map<AdvisorStanding, number>();
  const out: { id: number | null; version: AdvisorVersion }[] = [];
  for (const row of inPageOrder(rows)) {
    const advisor = advisorOfFields(row.fields);
    if (advisor === null) {
      const errors = advisorFieldErrors(row.fields);
      const name = row.fields.name.trim() || "A new advisor";
      return refused(`${name}: ${Object.values(errors)[0]}`);
    }
    const place = (placed.get(advisor.standing) ?? 0) + 1;
    placed.set(advisor.standing, place);
    out.push({ id: row.id, version: { ...advisor, place } });
  }
  return written(out);
}

/**
 * The writes a Save draft or Publish of the panel's rows makes over the
 * stored advisors `items`: none for an advisor already as the rows have them.
 * Refused when the rows are not ones the editor sends, do not name every
 * stored advisor once (advisors leave only by End advising), or hold a row
 * the panel would refuse. Nothing is written here.
 */
export function advisorWritesOf(items: readonly AdvisorItem[], step: PublishStep, rows: unknown): WriteResult<AdvisorWrite[]> {
  if (!Array.isArray(rows) || rows.length > 200 || !rows.every(isRow)) return refused(ADVISORS_CHANGED);
  const ids = rows.flatMap((r) => (r.id === null ? [] : [r.id]));
  const stored = new Map(items.map((item) => [item.id, item]));
  if (ids.length !== items.length || new Set(ids).size !== ids.length || !ids.every((id) => stored.has(id))) return refused(ADVISORS_CHANGED);
  const placed = placedOf(rows);
  if (!placed.ok) return placed;

  let siteOrder = nextSiteOrder(items);
  return written(
    placed.value.flatMap(({ id, version }): AdvisorWrite[] => {
      const current = id === null ? undefined : stored.get(id);
      if (current === undefined) return [{ kind: "create", version: afterStep(null, version, step), siteOrder: siteOrder++ }];
      const v = current.version;
      const unchanged =
        step === "publish" ? v.state === "published" && v.draft === null && sameVersion(v.published, version) : sameVersion(editorVersion(v), version);
      return unchanged ? [] : [{ kind: "update", id: current.id, version: afterStep(v, version, step) }];
    }),
  );
}

/** The advisors once every write has landed, as a store kept in memory holds them: each new advisor takes the next id. */
export function advisorsAfter(items: readonly AdvisorItem[], writes: readonly AdvisorWrite[]): AdvisorItem[] {
  let lastId = items.reduce((last, item) => Math.max(last, item.id), 0);
  const updates = new Map(writes.flatMap((w) => (w.kind === "update" ? [[w.id, w.version] as const] : [])));
  const created = writes.flatMap((w) => (w.kind === "create" ? [{ id: ++lastId, siteOrder: w.siteOrder, version: w.version }] : []));
  return [...items.map((item) => ({ ...item, version: updates.get(item.id) ?? item.version })), ...created];
}

export function advisorEditor(viewer: ViewerStanding, store: AdvisorStore, thisYear: () => Promise<number>): AdvisorEditor {
  const allowed = maySiteContent(viewer);
  const listed = async () => [...(await store.list())];

  return {
    list: async () => (allowed ? listed() : null),

    async save(step, rows) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const writes = advisorWritesOf(await listed(), step, rows);
      if (!writes.ok) return writes;
      const saved = await store.saveAll(writes.value);
      return saved.ok ? written(await listed()) : saved;
    },

    async end(id, years) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const item = (await store.list()).find((a) => a.id === id);
      if (item === undefined) return refused("This advisor is no longer on the Team page. Reload the page.");
      const advisor = editorVersion(item.version);
      const { from, to } = isRecord(years) ? years : {};
      const checked = checkAdvisor({ group: ADVISORS, name: advisor.name, role: advisor.role, from, to }, await thisYear());
      if (!checked.ok) return checked;
      return store.endAdvising(id, { ...checked.value, photo: advisor.photo ?? null });
    },
  };
}
