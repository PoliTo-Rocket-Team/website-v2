import { formatEuro } from "./orders";
import { matchesQuery } from "./team";
import { VIEW_AS_OPERATIONS } from "./view-as";

// The Activity log (board 101, issue #642): every change the dashboard stored
// in `logs`, newest first, one row per change. A change is everything one
// write stored at once: the audit trigger stamps each row of one transaction
// with the same time, writer and acting account, so a write that touches
// several tables still reads as one plain sentence. View as starts and stops
// are their own rows (`VIEW_AS_START`, `VIEW_AS_STOP`, ./view-as.ts), and a
// start with no stop whose session has expired reads as ended by timeout at
// that expiry, derived here when read (Owner decision on #642, 2026-10-24):
// nothing is written for it. Who may read the page is the `activity-log` row
// of ./access.ts alone.

/** The areas a change belongs to, in the order the Area filter lists them; "view-as" holds View as starts, stops and timeouts only. */
export const ACTIVITY_AREAS = [
  "applications",
  "positions",
  "members",
  "team-tree",
  "access",
  "orders",
  "projects",
  "outreach",
  "partners",
  "alumni",
  "faq",
  "team-page",
  "account",
  "view-as",
  "other",
] as const;
export type ActivityArea = (typeof ACTIVITY_AREAS)[number];

/** The area of a change written to the database; View as rows are never one. */
export type WriteArea = Exclude<ActivityArea, "view-as">;

export const ACTIVITY_AREA_LABELS: Readonly<Record<ActivityArea, string>> = {
  applications: "Applications",
  positions: "Positions",
  members: "Members",
  "team-tree": "Team tree",
  access: "Access",
  orders: "Orders",
  projects: "Projects",
  outreach: "Outreach",
  partners: "Partners",
  alumni: "Alumni",
  faq: "FAQ",
  "team-page": "Team page",
  account: "Account",
  "view-as": "View as",
  other: "Other",
};

/** One `logs` row as the reader hands it over. Heavy content (page blocks, post bodies) is left out; `label` carries the record's name or title. */
export type LogRow = {
  readonly id: number;
  readonly schema: string;
  readonly table: string;
  readonly operation: string;
  readonly recordId: string | null;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  /** The record's own name, title or question, from its stored data. */
  readonly label: string | null;
  /** ISO time the write was stored, to the millisecond: what the When column shows. */
  readonly at: string;
  /** `changed_at` as the database prints it, at its full stored precision: one value for every row of one transaction, so the key a change is grouped on. */
  readonly stamp: string;
  /** The account the write is stored under: the person viewed as during View as. */
  readonly by: string | null;
  /** The account behind a View as session; null outside View as. */
  readonly acting: string | null;
};

/** An account as the log names it: its full name, its member id and the title of its role now (null when it holds none). */
export type LoggedAccount = { readonly name: string; readonly memberId: number | null; readonly title: string | null };

/** What the sentences name, read beside the rows. */
export type ActivityNames = {
  readonly accounts: ReadonlyMap<string, LoggedAccount>;
  /** Member id to full name. */
  readonly members: ReadonlyMap<number, string>;
  readonly divisions: ReadonlyMap<number, string>;
  readonly departments: ReadonlyMap<number, string>;
  /** Position id to title. */
  readonly positions: ReadonlyMap<number, string>;
  /** Application id to the applicant's account and the position. */
  readonly applications: ReadonlyMap<number, { readonly accountId: string | null; readonly positionId: number | null }>;
  /** The title each acting account's writes show under (`actingTitleOf`, ./acting-account.ts). */
  readonly actingTitles: ReadonlyMap<string, string>;
};

/**
 * Who made a change: the account itself, or, during View as, the person
 * viewed as under the acting seat's title ("IT Lead as Sofia Neri") with the
 * acting person named under it.
 */
export type ActivityWho =
  | { readonly kind: "self"; readonly id: string; readonly name: string; readonly title: string | null }
  | {
      readonly kind: "as";
      readonly id: string;
      readonly name: string;
      readonly actingTitle: string;
      readonly actingId: string;
      readonly actingName: string;
    };

export const VIEW_AS_EVENTS = ["start", "stop", "timeout"] as const;
export type ViewAsEvent = (typeof VIEW_AS_EVENTS)[number];

const VIEW_AS_WORDS: Readonly<Record<ViewAsEvent, string>> = {
  start: "View as started",
  stop: "View as stopped",
  timeout: "View as ended by timeout",
};

/** A write, with its sentence and area, or a View as event naming the person viewed as. */
export type ActivityChange =
  | { readonly kind: "write"; readonly sentence: string; readonly area: WriteArea }
  | { readonly kind: "view-as"; readonly event: ViewAsEvent; readonly person: ViewedPerson };

/** The person viewed as in a View as event; `id` is null when the stored row names none. */
export type ViewedPerson = { readonly id: string | null; readonly name: string };

export type ActivityEntry = {
  readonly key: string;
  /** ISO time. */
  readonly at: string;
  readonly who: ActivityWho;
  readonly change: ActivityChange;
};

/** What the page reads: the entries newest first, and the time they were read, which the date labels and ranges count from. */
export type ActivityLogPage = { readonly entries: readonly ActivityEntry[]; readonly readAt: string };

/** How far back the page reads: the widest date range it offers. */
export const ACTIVITY_WINDOW_DAYS = 365;

export function areaOf(change: ActivityChange): ActivityArea {
  return change.kind === "write" ? change.area : "view-as";
}

/** The Change column's sentence: "Moved Giulia Rossi to Interview", "View as started: Sofia Neri". */
export function sentenceOf(change: ActivityChange): string {
  return change.kind === "write" ? change.sentence : `${VIEW_AS_WORDS[change.event]}: ${change.person.name}`;
}

/** Made during View as, or a View as start, stop or timeout: what "View as only" keeps. */
export function isViewAs(entry: ActivityEntry): boolean {
  return entry.who.kind === "as" || entry.change.kind === "view-as";
}

// Reading the rows ------------------------------------------------------------------

/** The View as event each stored operation is. */
const VIEW_AS_EVENT_OF: ReadonlyMap<string, "start" | "stop"> = new Map([
  [VIEW_AS_OPERATIONS.start, "start"],
  [VIEW_AS_OPERATIONS.stop, "stop"],
]);

/** The name an account the log names but no longer holds shows as. */
export const UNKNOWN_ACCOUNT = "Deleted account";

/**
 * The entries `rows` make, newest first: each write once, View as starts and
 * stops, and a timeout for each start with no stop whose session expiry
 * (`expiries`, by session id; null when the session row is gone, then the
 * start plus `sessionSeconds`) has passed at `now`.
 */
export function activityOf(
  rows: readonly LogRow[],
  names: ActivityNames,
  expiries: ReadonlyMap<string, string | null>,
  now: Date,
  sessionSeconds: number,
): ActivityEntry[] {
  const viewAs = rows.filter((row) => VIEW_AS_EVENT_OF.has(row.operation));
  const writes = rows.filter((row) => !VIEW_AS_EVENT_OF.has(row.operation) && row.by !== null);
  const entries = [
    ...[...groupsOf(writes).values()].map((group) => writeEntry(group, names)),
    ...viewAs.flatMap((row) => {
      const event = VIEW_AS_EVENT_OF.get(row.operation);
      return event === undefined ? [] : [viewAsEntry(row, event, row.at, names)];
    }),
    ...timeoutsOf(viewAs, expiries, now, sessionSeconds).map(({ row, at }) => viewAsEntry(row, "timeout", at, names)),
  ];
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.key.localeCompare(a.key));
}

/** The starts no stop closed whose session has expired by `now`, each with that expiry. */
function timeoutsOf(
  viewAs: readonly LogRow[],
  expiries: ReadonlyMap<string, string | null>,
  now: Date,
  sessionSeconds: number,
): { row: LogRow; at: string }[] {
  const stopped = new Set(viewAs.filter((r) => r.operation === VIEW_AS_OPERATIONS.stop).map((r) => r.recordId));
  return viewAs.flatMap((row) => {
    if (row.operation !== VIEW_AS_OPERATIONS.start || row.recordId === null || stopped.has(row.recordId)) return [];
    const stored = expiries.get(row.recordId) ?? null;
    const expiry = stored === null ? Date.parse(row.at) + sessionSeconds * 1000 : Date.parse(stored);
    return expiry <= now.getTime() ? [{ row, at: new Date(expiry).toISOString() }] : [];
  });
}

function groupsOf(rows: readonly LogRow[]): Map<string, LogRow[]> {
  const groups = new Map<string, LogRow[]>();
  for (const row of rows) {
    const key = `${row.stamp}|${row.by}|${row.acting ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function accountOf(names: ActivityNames, id: string | null): LoggedAccount {
  return (id === null ? undefined : names.accounts.get(id)) ?? { name: UNKNOWN_ACCOUNT, memberId: null, title: null };
}

function whoOf(by: string, acting: string | null, names: ActivityNames): ActivityWho {
  const account = accountOf(names, by);
  if (acting === null) return { kind: "self", id: by, name: account.name, title: account.title };
  return {
    kind: "as",
    id: by,
    name: account.name,
    actingTitle: names.actingTitles.get(acting) ?? accountOf(names, acting).title ?? "View as",
    actingId: acting,
    actingName: accountOf(names, acting).name,
  };
}

function viewAsEntry(row: LogRow, event: ViewAsEvent, at: string, names: ActivityNames): ActivityEntry {
  const acting = row.by ?? text(row.after, "actingAccountId") ?? "";
  const personId = text(row.after, "personId");
  const person = { id: personId, name: accountOf(names, personId).name };
  return { key: `${event}-${row.id}`, at, who: whoOf(acting, null, names), change: { kind: "view-as", event, person } };
}

function writeEntry(group: readonly LogRow[], names: ActivityNames): ActivityEntry {
  const lead = [...group].sort((a, b) => rankOf(a) - rankOf(b) || OP_RANK(a) - OP_RANK(b) || a.id - b.id)[0];
  const { sentence, area } = describe(lead, group, names);
  const firstId = Math.min(...group.map((r) => r.id));
  return { key: `w-${firstId}`, at: lead.at, who: whoOf(lead.by ?? "", lead.acting, names), change: { kind: "write", sentence, area } };
}

// Which row of a change speaks for it: the table that says most about what the
// person did comes first (an application's move over the interview times it
// offered, a hand-over over the roles it changed), and within one table a row
// written over one removed (a saved draft replaces the old one).
const TABLE_RANK = [
  "applications",
  "orders",
  "hand_over_requests",
  "alias_requests",
  "team_joins",
  "scopes",
  "team_leaves",
  "apply_positions",
  "recruitment_setting",
  "interview_slots",
  "departments",
  "divisions",
  "roles",
  "members",
  "outreach_post_versions",
  "outreach_summit_versions",
  "outreach_tags",
  "outreach_posts",
  "outreach_post_tags",
  "project_versions",
  "projects",
  "partner_versions",
  "partners",
  "faq_versions",
  "faqs",
  "team_page_layer_versions",
  "team_page_advisor_versions",
  "team_page_advisors",
  "alumni_entries",
  "alumni_role_fixes",
  "alumni_imported_roles",
  "users",
  "dashboard_notices",
  "application_files",
];

function rankOf(row: LogRow): number {
  // Moving someone to alumni ends their roles too; the move is the change.
  if (row.table === "members" && row.operation === "UPDATE" && became(row, "team_to")) return -1;
  const rank = TABLE_RANK.indexOf(row.table);
  return rank === -1 ? TABLE_RANK.length : rank;
}

const OP_RANK = (row: LogRow) => (row.operation === "INSERT" ? 0 : row.operation === "UPDATE" ? 1 : 2);

// Row data -------------------------------------------------------------------------

type Data = Readonly<Record<string, unknown>> | null;

function text(data: Data, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function int(data: Data, key: string): number | null {
  const value = data?.[key];
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** The row's data as it now reads: what was written, or what was removed. */
function dataOf(row: LogRow): Data {
  return row.after ?? row.before;
}

function changed(row: LogRow, key: string): boolean {
  return JSON.stringify(row.before?.[key] ?? null) !== JSON.stringify(row.after?.[key] ?? null);
}

/** The value went from empty to set. */
function became(row: LogRow, key: string): boolean {
  return (row.before?.[key] ?? null) === null && (row.after?.[key] ?? null) !== null;
}

function quoted(label: string | null): string {
  return label === null ? "" : ` "${label}"`;
}

/** "Orders and Members", "Positions, Orders and Members". */
function listed(words: readonly string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// Sentences --------------------------------------------------------------------------

type Described = { readonly sentence: string; readonly area: WriteArea };

/** The stored application states, as the Applications page names them. */
const APPLICATION_STATUS_WORDS: Readonly<Record<string, string>> = {
  received: "New",
  pending: "In review",
  interview: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  accepted_by_another_team: "Taken by another team",
  joined: "Joined",
};

/** What a grant's target reads as. */
const TARGET_WORDS: Readonly<Record<string, string>> = {
  all: "full",
  positions: "Positions",
  applications: "Applications",
  members: "Members",
  orders: "Orders",
  content: "Content",
  faq: "FAQ",
  blog: "Blog",
  logs: "Activity log",
};

class Describer {
  constructor(
    private readonly names: ActivityNames,
    private readonly group: readonly LogRow[],
  ) {}

  member(id: number | null): string {
    return (id === null ? undefined : this.names.members.get(id)) ?? "a former member";
  }

  account(id: string | null): string {
    return id === null ? "someone" : (this.names.accounts.get(id)?.name ?? UNKNOWN_ACCOUNT);
  }

  division(id: number | null): string | null {
    return id === null ? null : (this.names.divisions.get(id) ?? null);
  }

  department(id: number | null): string | null {
    return id === null ? null : (this.names.departments.get(id) ?? null);
  }

  application(id: number | null): { readonly accountId: string | null; readonly positionId: number | null } | null {
    return (id === null ? undefined : this.names.applications.get(id)) ?? null;
  }

  position(id: number | null): string {
    return (id === null ? undefined : this.names.positions.get(id)) ?? "a position";
  }

  /** The writer's own member id: a change to their own record is their account's. */
  writerMember(row: LogRow): number | null {
    return row.by === null ? null : (this.names.accounts.get(row.by)?.memberId ?? null);
  }

  has(table: string, operation: string): boolean {
    return this.group.some((r) => r.table === table && r.operation === operation);
  }

  rows(table: string): LogRow[] {
    return this.group.filter((r) => r.table === table);
  }
}

function describe(row: LogRow, group: readonly LogRow[], names: ActivityNames): Described {
  const d = new Describer(names, group);
  const data = dataOf(row);
  const describer = SENTENCES[row.table];
  if (describer) return describer(row, data, d);
  return { sentence: `Changed ${row.table.replaceAll("_", " ")}`, area: "other" };
}

type Sentence = (row: LogRow, data: Data, d: Describer) => Described;

/**
 * The draft version a save wrote, if it wrote one. A save rewrites every
 * version of the record (it removes them all and writes them again), so
 * saving a draft of a published record also writes the published version
 * back unchanged: the draft written beside it is what the save was.
 */
function draftWritten(row: LogRow, d: Describer): LogRow | null {
  if (row.operation === "DELETE") return null;
  return d.rows(row.table).find((r) => r.operation !== "DELETE" && text(r.after, "version") === "draft") ?? null;
}

/**
 * Whether the change took the record off the site: it removed the published
 * version, wrote none back, and wrote a draft (Unpublish keeps what was live
 * as the record's draft).
 */
function unpublishedTo(draft: LogRow, d: Describer): boolean {
  const rows = d.rows(draft.table);
  const isPublished = (data: Data) => text(data, "version") === "published";
  return rows.some((r) => r.operation === "DELETE" && isPublished(r.before)) && !rows.some((r) => r.operation !== "DELETE" && isPublished(r.after));
}

/** A record kept as a draft and a published version (posts, partners, FAQ, projects, advisors). */
function versioned(noun: string, area: WriteArea, labelKey: string): Sentence {
  return (row, data, d) => {
    if (row.operation === "DELETE") return { sentence: `Deleted the ${noun}${quoted(row.label ?? text(data, labelKey))}`, area };
    const draft = draftWritten(row, d);
    if (draft !== null && unpublishedTo(draft, d)) return { sentence: `Unpublished the ${noun}${quoted(draft.label ?? text(draft.after, labelKey))}`, area };
    if (draft !== null) return { sentence: `Saved the draft ${noun}${quoted(draft.label ?? text(draft.after, labelKey))}`, area };
    return { sentence: `Published the ${noun}${quoted(row.label ?? text(data, labelKey))}`, area };
  };
}

/** The list row of a versioned record: its place on the site, and its removal. */
function listRow(plural: string, noun: string, area: WriteArea): Sentence {
  return (row) => {
    if (row.operation === "INSERT") return { sentence: `Added a ${noun}`, area };
    if (row.operation === "DELETE") return { sentence: `Deleted a ${noun}`, area };
    if (changed(row, "featured_slot")) return { sentence: `Changed the featured ${noun}`, area };
    return { sentence: `Reordered the ${plural}`, area };
  };
}

const SENTENCES: Readonly<Record<string, Sentence>> = {
  applications(row, data, d) {
    const area = "applications";
    const applicant = d.account(text(data, "user_id"));
    const position = d.position(int(data, "apply_position_id"));
    if (row.operation === "INSERT") return { sentence: `Applied for ${position}`, area };
    if (row.operation === "DELETE") return { sentence: `Deleted the application of ${applicant} for ${position}`, area };
    if (became(row, "withdrawn_at")) return { sentence: `Withdrew the application for ${position}`, area };
    if (became(row, "joined_at")) return { sentence: `Confirmed ${applicant} joined as ${position}`, area };
    if (changed(row, "nda_arrived_at"))
      return { sentence: `${became(row, "nda_arrived_at") ? "Marked" : "Unmarked"} the signed NDA of ${applicant} as arrived`, area };
    if (changed(row, "status")) {
      const status = text(data, "status") ?? "";
      if (status === "rejected") return { sentence: `Rejected ${applicant} for ${position}`, area };
      if (status === "accepted") return { sentence: `Accepted ${applicant} for ${position}`, area };
      return { sentence: `Moved ${applicant} to ${APPLICATION_STATUS_WORDS[status] ?? status}`, area };
    }
    return { sentence: `Updated the application of ${applicant} for ${position}`, area };
  },

  application_files(row, data) {
    return { sentence: row.operation === "DELETE" ? "Removed an application file" : `Uploaded${quoted(text(data, "original_filename"))}`, area: "applications" };
  },

  interview_slots(row, data, d) {
    const application = d.application(int(data, "application_id"));
    const applicant = d.account(application?.accountId ?? null);
    if (row.operation === "INSERT") return { sentence: `Offered interview times to ${applicant}`, area: "applications" };
    if (row.operation === "DELETE") return { sentence: `Withdrew the interview times offered to ${applicant}`, area: "applications" };
    if (became(row, "chosen_at")) return { sentence: `Booked an interview time for ${d.position(application?.positionId ?? null)}`, area: "applications" };
    return { sentence: `Changed the interview times of ${applicant}`, area: "applications" };
  },

  apply_positions(row, data) {
    const area = "positions";
    const title = text(data, "title") ?? "a position";
    if (row.operation === "INSERT") return { sentence: `Created the position ${title}`, area };
    if (row.operation === "DELETE" || (changed(row, "is_deleted") && data?.is_deleted === true)) return { sentence: `Deleted the position ${title}`, area };
    if (changed(row, "status")) return { sentence: `${data?.status === true ? "Opened" : "Closed"} the position ${title}`, area };
    return { sentence: `Edited the position ${title}`, area };
  },

  recruitment_setting(_row, data) {
    return { sentence: data?.is_open === false ? "Closed recruitment" : "Opened recruitment", area: "positions" };
  },

  orders(row, data) {
    const area = "orders";
    const item = quoted(text(data, "name"));
    const price = Number(data?.price ?? NaN);
    const total = Number.isFinite(price) ? ` · ${formatEuro(Math.round(price * 100) * (int(data, "quantity") ?? 1))}` : "";
    if (row.operation === "INSERT") return { sentence: `Requested${item}${total}`, area };
    if (row.operation === "DELETE") return { sentence: `Deleted order${item}`, area };
    if (!changed(row, "status")) return { sentence: `Edited order${item}`, area };
    switch (text(data, "status")) {
      case "accepted":
        return { sentence: `Approved order${item}${total}`, area };
      case "rejected":
        return { sentence: `Rejected order${item}`, area };
      case "changes_requested":
        return { sentence: `Asked for changes on order${item}`, area };
      case "ordered":
        return { sentence: `Marked order${item} as ordered`, area };
      case "cancelled":
        return { sentence: `Cancelled order${item}`, area };
      default:
        return { sentence: `Sent order${item} again`, area };
    }
  },

  scopes(row, data, d) {
    const area = "access";
    const person = d.member(int(data, "member_id"));
    const target = text(data, "target") ?? "";
    if (target === "approve_orders") {
      return { sentence: row.operation === "DELETE" ? `Removed Approve orders from ${person}` : `Gave Approve orders to ${person}`, area };
    }
    // Give access writes every area of one person at once: name them together.
    const mine = d.rows("scopes").filter((r) => int(dataOf(r), "member_id") === int(data, "member_id") && text(dataOf(r), "target") !== "approve_orders");
    const words = (op: string) => [...new Set(mine.filter((r) => r.operation === op).map((r) => TARGET_WORDS[text(dataOf(r), "target") ?? ""] ?? "some"))];
    const given = words("INSERT");
    const removed = words("DELETE");
    if (row.operation !== "UPDATE" && removed.length === 0) return { sentence: `Gave ${listed(given)} access to ${person}`, area };
    if (row.operation !== "UPDATE" && given.length === 0) return { sentence: `Removed ${listed(removed)} access from ${person}`, area };
    return { sentence: `Changed the access of ${person}`, area };
  },

  roles(row, data, d) {
    const person = d.member(int(data, "member_id"));
    const title = text(data, "title") ?? "a role";
    const division = d.division(int(data, "division_id"));
    if (row.operation === "INSERT") {
      return { sentence: division === null ? `Gave ${person} the role ${title}` : `Added ${person} to ${division}`, area: "members" };
    }
    if (row.operation === "DELETE") return { sentence: `Removed the role ${title} of ${person}`, area: "members" };
    if (became(row, "leaved_at")) {
      return { sentence: division === null ? `Ended the role ${title} of ${person}` : `Removed ${person} from ${division}`, area: "members" };
    }
    if (changed(row, "title")) {
      return { sentence: `Changed the role title of ${person}: ${text(row.before, "title") ?? "none"} → ${title}`, area: "team-tree" };
    }
    if (changed(row, "division_id") && division !== null) return { sentence: `Moved ${person} to ${division}`, area: "members" };
    return { sentence: `Changed the role of ${person}`, area: "team-tree" };
  },

  members(row, data, d) {
    const id = int(data, "member_id");
    const person = d.member(id);
    const own = id !== null && id === d.writerMember(row);
    if (row.operation === "INSERT") return { sentence: `Added ${person} to the team`, area: "members" };
    if (row.operation === "DELETE") return { sentence: `Removed ${person} from the team`, area: "members" };
    if (became(row, "team_to")) return { sentence: `Moved ${person} to alumni`, area: "members" };
    if (changed(row, "picture")) return own ? { sentence: "Changed their own photo", area: "account" } : { sentence: `Changed the photo of ${person}`, area: "members" };
    if (changed(row, "prt_email")) return { sentence: `Set the team email of ${person}`, area: "members" };
    return own ? { sentence: "Updated their own details", area: "account" } : { sentence: `Updated the details of ${person}`, area: "members" };
  },

  users(row, data, d) {
    const id = text(data, "id");
    if (id !== null && id === row.by) return { sentence: "Updated their own details", area: "account" };
    return { sentence: `Updated the details of ${d.account(id)}`, area: "members" };
  },

  team_joins(row, data, d) {
    const area = "members";
    const person = d.account(text(data, "user_id"));
    const division = d.division(int(data, "division_id")) ?? "a division";
    if (row.operation === "INSERT") return { sentence: `Added ${person} to ${division}`, area };
    if (row.operation === "DELETE") {
      return { sentence: d.has("members", "INSERT") ? `Confirmed the NDA of ${person}` : `Cancelled adding ${person} to ${division}`, area };
    }
    return { sentence: `Updated the details of ${person}`, area };
  },

  team_leaves(row, data, d) {
    const id = int(data, "member_id");
    return { sentence: id !== null && id === d.writerMember(row) ? "Left the team" : `Marked ${d.member(id)} as left`, area: "members" };
  },

  hand_over_requests(row, data, d) {
    const area = "team-tree";
    const unit = d.division(int(data, "division_id")) ?? d.department(int(data, "dept_id")) ?? "a role";
    const from = d.member(int(data, "from_id"));
    const to = d.member(int(data, "to_id"));
    if (row.operation === "INSERT") return { sentence: `Asked to hand over ${unit} to ${to}`, area };
    if (row.operation === "DELETE") return { sentence: `Withdrew the hand-over of ${unit} to ${to}`, area };
    switch (text(data, "decision")) {
      case "confirmed":
        return { sentence: `Confirmed the hand-over of ${unit} from ${from} to ${to}`, area };
      case "declined":
        return { sentence: `Declined the hand-over of ${unit} from ${from} to ${to}`, area };
      default:
        return { sentence: `Closed the hand-over of ${unit} from ${from} to ${to}`, area };
    }
  },

  alias_requests(row, data, d) {
    const area = "members";
    const person = d.member(int(data, "member_id"));
    if (row.operation === "INSERT") return { sentence: `Asked for a team email for ${person}`, area };
    switch (text(data, "outcome")) {
      case "created":
        return { sentence: `Created the team email of ${person}`, area };
      case "declined":
        return { sentence: `Declined the team email for ${person}`, area };
      case "cancelled":
        return { sentence: `Cancelled the team email request for ${person}`, area };
      default:
        return { sentence: `Changed the team email request for ${person}`, area };
    }
  },

  dashboard_notices(row, data, d) {
    if (row.operation === "UPDATE" && became(row, "dismissed_at")) return { sentence: "Dismissed a notice", area: "account" };
    return { sentence: `Sent a notice to ${d.member(int(data, "recipient_id"))}`, area: "members" };
  },

  departments: unit("department"),
  divisions: unit("division"),

  alumni_entries(row, data, d) {
    const area = "alumni";
    const person = text(data, "name") ?? text(data, "record_name") ?? d.member(int(data, "member_id"));
    if (row.operation === "INSERT") return { sentence: `Added ${person} to the Alumni page`, area };
    if (row.operation === "DELETE" || became(row, "removed_at")) return { sentence: `Removed ${person} from the Alumni page`, area };
    if (changed(row, "shown")) return { sentence: `${data?.shown === false ? "Hid" : "Showed"} ${person} on the Alumni page`, area };
    if (changed(row, "photo")) return { sentence: `Changed the alumni photo of ${person}`, area };
    return { sentence: `Edited the alumni entry of ${person}`, area };
  },
  alumni_role_fixes: () => ({ sentence: "Fixed a role line on the Alumni page", area: "alumni" }),
  alumni_imported_roles: () => ({ sentence: "Changed an imported role line on the Alumni page", area: "alumni" }),

  outreach_post_versions: versioned("post", "outreach", "title"),
  outreach_posts: listRow("posts", "post", "outreach"),
  outreach_post_tags: () => ({ sentence: "Changed the tags of a post", area: "outreach" }),
  outreach_tags(row, data) {
    const name = quoted(text(data, "name"));
    const verb = row.operation === "INSERT" ? "Added" : row.operation === "DELETE" ? "Removed" : "Edited";
    return { sentence: `${verb} the tag${name}`, area: "outreach" };
  },
  outreach_summit_versions(row, _data, d) {
    return { sentence: draftWritten(row, d) === null ? "Published the summit" : "Saved the draft summit", area: "outreach" };
  },

  project_versions: versioned("project", "projects", "name"),
  projects: listRow("projects", "project", "projects"),
  partner_versions: versioned("partner", "partners", "name"),
  partners: listRow("partners", "partner", "partners"),
  faq_versions: versioned("question", "faq", "question"),
  faqs: listRow("questions", "question", "faq"),
  team_page_layer_versions(row, _data, d) {
    return { sentence: draftWritten(row, d) === null ? "Published the Team page" : "Saved the Team page draft", area: "team-page" };
  },
  team_page_advisor_versions: versioned("advisor", "team-page", "name"),
  team_page_advisors: listRow("advisors", "advisor", "team-page"),
};

function unit(noun: "department" | "division"): Sentence {
  return (row, data) => {
    const area = "team-tree";
    const name = text(data, "name") ?? `a ${noun}`;
    if (row.operation === "INSERT") return { sentence: `Created the ${noun} ${name}`, area };
    if (row.operation === "DELETE") return { sentence: `Deleted the ${noun} ${name}`, area };
    const before = text(row.before, "name");
    if (changed(row, "name") && before !== null) return { sentence: `Renamed the ${noun} ${before} to ${name}`, area };
    if (became(row, "closed_at")) return { sentence: `Closed the ${noun} ${name}`, area };
    return { sentence: `Edited the ${noun} ${name}`, area };
  };
}

// Filters --------------------------------------------------------------------------

/** The date ranges the filter offers, in days; null is the whole window the page reads (`ACTIVITY_WINDOW_DAYS`). */
export const DATE_RANGES = [7, 30, 90] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const DATE_RANGE_LABELS: Readonly<Record<DateRange, string>> = { 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days" };
export const WHOLE_WINDOW_LABEL = "Last 12 months";

export type ActivityFilters = {
  readonly query: string;
  readonly viewAsOnly: boolean;
  readonly area: ActivityArea | null;
  /** An account id: the entries it made, or was viewed as in. */
  readonly personId: string | null;
  readonly range: DateRange | null;
};

/** Board 101 opens on everything of the last 30 days. */
export const OPENING_FILTERS: ActivityFilters = { query: "", viewAsOnly: false, area: null, personId: null, range: 30 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the person is the one who made the entry, the one viewed as, or the one viewing. */
function involves(entry: ActivityEntry, personId: string): boolean {
  const { who, change } = entry;
  return who.id === personId || (who.kind === "as" && who.actingId === personId) || (change.kind === "view-as" && change.person.id === personId);
}

/** The entries every filter keeps. */
export function filterActivity(entries: readonly ActivityEntry[], filters: ActivityFilters, now: Date): ActivityEntry[] {
  const since = filters.range === null ? null : now.getTime() - filters.range * DAY_MS;
  return entries.filter(
    (entry) =>
      (!filters.viewAsOnly || isViewAs(entry)) &&
      (filters.area === null || areaOf(entry.change) === filters.area) &&
      (filters.personId === null || involves(entry, filters.personId)) &&
      (since === null || Date.parse(entry.at) >= since) &&
      matchesQuery(searchFieldsOf(entry), filters.query),
  );
}

function searchFieldsOf(entry: ActivityEntry): string[] {
  const { who } = entry;
  const people = who.kind === "self" ? [who.name, who.title ?? ""] : [who.name, who.actingTitle, who.actingName];
  return [...people, sentenceOf(entry.change), ACTIVITY_AREA_LABELS[areaOf(entry.change)]];
}

/** The people the Person filter offers: everyone who made an entry or was viewed as in one, by name. */
export function activityPeople(entries: readonly ActivityEntry[]): { id: string; name: string }[] {
  const people = new Map<string, string>();
  for (const { who, change } of entries) {
    people.set(who.id, who.name);
    if (who.kind === "as") people.set(who.actingId, who.actingName);
    if (change.kind === "view-as" && change.person.id !== null) people.set(change.person.id, change.person.name);
  }
  return [...people].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** The areas the Area filter offers: those the entries hold, in `ACTIVITY_AREAS` order. */
export function activityAreas(entries: readonly ActivityEntry[]): ActivityArea[] {
  const held = new Set(entries.map((e) => areaOf(e.change)));
  return ACTIVITY_AREAS.filter((area) => held.has(area));
}

// When -----------------------------------------------------------------------------

const TIME_ZONE = "Europe/Rome";
const calendarDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });
const dayParts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });

function dayNumber(date: Date): number {
  const [y, m, d] = calendarDay.format(date).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** The When column on Turin's clock: "Today 14:32", "Yesterday 22:41", "Mon 20 Oct 19:40", and the year when it is not this one. */
export function whenLabel(at: string, now: Date): string {
  const date = new Date(at);
  const time = clock.format(date);
  const days = dayNumber(now) - dayNumber(date);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  const part = (type: Intl.DateTimeFormatPartTypes, of: Date) => dayParts.formatToParts(of).find((p) => p.type === type)?.value ?? "";
  const year = part("year", date) === part("year", now) ? "" : ` ${part("year", date)}`;
  return `${part("weekday", date)} ${part("day", date)} ${part("month", date)}${year} ${time}`;
}
