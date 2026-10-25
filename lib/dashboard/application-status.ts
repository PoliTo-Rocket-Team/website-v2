// The application status list (epic #588, issue #748; rulings R1.2 and R1.4
// on #745). Every application carries one status from a stored list: the ten
// built-in statuses below, in this order, and the statuses approvers add
// under one built-in parent. An added status behaves like its parent. The
// list is stored in `application_statuses` (drizzle/0064), whose checks keep
// a built-in row parentless and give every added row a built-in parent.
// An application with no status reference reads as New.

/** The ten built-in statuses, in the order the owner ruled (2026-10-25), with their first name and colour. */
export const BUILT_IN_STATUSES = [
  { key: "new", name: "New", colour: "#8A8A8F" },
  { key: "interview", name: "Interview", colour: "#FF5E00" },
  { key: "accepted_email_to_be_sent", name: "Accepted · email to be sent", colour: "#F5A623" },
  { key: "accepted_email_sent", name: "Accepted · email sent", colour: "#4DA3FF" },
  { key: "nda_received", name: "NDA received", colour: "#2E9B4F" },
  { key: "joined", name: "Joined", colour: "#2E9B4F" },
  { key: "rejected_email_to_be_sent", name: "Rejected · email to be sent", colour: "#CE2B4B" },
  { key: "rejected_email_sent", name: "Rejected · email sent", colour: "#5E5E64" },
  { key: "accepted_for_another_position", name: "Accepted for another position", colour: "#5E5E64" },
  { key: "withdrawn", name: "Withdrawn", colour: "#5E5E64" },
] as const;

export type BuiltInStatus = (typeof BUILT_IN_STATUSES)[number];
export type BuiltInStatusKey = BuiltInStatus["key"];

/** The built-in status keys, in order. */
export const BUILT_IN_STATUS_KEYS: readonly BuiltInStatusKey[] = BUILT_IN_STATUSES.map((s) => s.key);

export function isBuiltInStatusKey(value: unknown): value is BuiltInStatusKey {
  return typeof value === "string" && (BUILT_IN_STATUS_KEYS as readonly string[]).includes(value);
}

/** One application's status: a built-in one, or one an approver added under a built-in parent. */
export type ApplicationStatus =
  | { readonly kind: "built-in"; readonly key: BuiltInStatusKey }
  | { readonly kind: "added"; readonly key: string; readonly parent: BuiltInStatusKey };

/** The status an application with no status reference has. */
export const NO_STATUS_READS_AS: ApplicationStatus = { kind: "built-in", key: "new" };

/**
 * The built-in status a status behaves like: itself, or an added status's
 * parent.
 */
export function builtInOf(status: ApplicationStatus): BuiltInStatusKey {
  return status.kind === "built-in" ? status.key : status.parent;
}

/** A status reference as an `applications` row reads it: the status's key and its parent's, both null for no reference. */
export type StoredStatusRef = { readonly key: string | null; readonly parentKey: string | null };

/**
 * The status a stored reference names. No reference reads as New. A row the
 * table's checks would refuse (a built-in key with a parent, or an added key
 * with no built-in parent) throws: it is not a status.
 */
export function statusOfStored(ref: StoredStatusRef): ApplicationStatus {
  if (ref.key === null) return NO_STATUS_READS_AS;
  if (isBuiltInStatusKey(ref.key)) {
    if (ref.parentKey !== null) throw new Error(`built-in application status "${ref.key}" has a parent`);
    return { kind: "built-in", key: ref.key };
  }
  if (!isBuiltInStatusKey(ref.parentKey)) throw new Error(`application status "${ref.key}" has no built-in parent`);
  return { kind: "added", key: ref.key, parent: ref.parentKey };
}

/** One row of the stored status list (`application_statuses`), as the database reads it. */
export type StoredStatusRow = {
  readonly key: string;
  readonly name: string;
  readonly colour: string;
  readonly sortOrder: number;
  readonly parentKey: string | null;
};

/** One entry of the status list as the drawer's Status picker shows it (board 97c): the status, its name and its colour. */
export type ListedStatus = { readonly status: ApplicationStatus; readonly name: string; readonly colour: string };

/**
 * The status list in the picker's order (board 97c): the ten built-in
 * statuses in their ruled order, each followed by the statuses added under
 * it in their own order. A built-in status the stored list lacks shows its
 * first name and colour; a stored row the table's checks would refuse is
 * left out.
 */
export function statusListOf(rows: readonly StoredStatusRow[]): ListedStatus[] {
  const stored = new Map(rows.map((r) => [r.key, r]));
  return BUILT_IN_STATUSES.flatMap((builtIn): ListedStatus[] => {
    const own = stored.get(builtIn.key);
    const added = rows
      .filter((r) => r.parentKey === builtIn.key && !isBuiltInStatusKey(r.key))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r): ListedStatus => ({ status: { kind: "added", key: r.key, parent: builtIn.key }, name: r.name, colour: r.colour }));
    return [{ status: { kind: "built-in", key: builtIn.key }, name: own?.name ?? builtIn.name, colour: own?.colour ?? builtIn.colour }, ...added];
  });
}

/** Whether two statuses are the same entry of the list. */
export function sameStatus(a: ApplicationStatus, b: ApplicationStatus): boolean {
  return a.kind === b.kind && a.key === b.key;
}

/**
 * How the list names and colours a status. A status the list does not hold
 * (the page read it before an edit to the list) shows its key in its
 * parent's colour, and a built-in one its first name and colour.
 */
export function listedStatusOf(list: readonly ListedStatus[], status: ApplicationStatus): ListedStatus {
  const listed = list.find((l) => sameStatus(l.status, status));
  if (listed) return listed;
  const builtIn = BUILT_IN_STATUSES.find((s) => s.key === builtInOf(status))!;
  return { status, name: status.kind === "built-in" ? builtIn.name : status.key, colour: builtIn.colour };
}

// Who sets a status ------------------------------------------------------------

/**
 * Who may set a status (owner decision on epic #588, 2026-10-25): anyone who
 * may move the application sets every status but "Accepted · email sent",
 * which the team leader alone sets, because the team leader sends the
 * acceptance email with the NDA. An added status behaves like its parent, so
 * it is set by whoever sets its parent. "Rejected · email sent" stays open to
 * anyone who may move the application.
 */
export type StatusSetter = "approver" | "team-leader";

/** Who sets `status`: the team leader for "Accepted · email sent" and the statuses added under it, else any approver. */
export function setterOf(status: ApplicationStatus | BuiltInStatusKey): StatusSetter {
  const builtIn = typeof status === "string" ? status : builtInOf(status);
  return builtIn === "accepted_email_sent" ? "team-leader" : "approver";
}

/** The viewer as this rule reads them: whether they are the team leader. */
export type StatusSetterViewer = { readonly teamLeader: boolean };

/** Whether a viewer who may move the application may set it to `status`. */
export function maySetStatus(status: ApplicationStatus | BuiltInStatusKey, viewer: StatusSetterViewer): boolean {
  return setterOf(status) === "approver" || viewer.teamLeader;
}

/** What the server answers anyone else who tries to set a team-leader status. */
export const TEAM_LEADER_ONLY_REFUSAL = "Only the team leader marks the acceptance email as sent.";

/**
 * Whether the viewer sees the do-not-email note on an application in
 * `status` (board 97e): everyone but the team leader does while the
 * acceptance email is to be sent or has gone out, so no second email reaches
 * the applicant. From NDA received on, the email step is over.
 */
export function seesDoNotEmailNote(status: ApplicationStatus | BuiltInStatusKey, viewer: StatusSetterViewer): boolean {
  const builtIn = typeof status === "string" ? status : builtInOf(status);
  return !viewer.teamLeader && (builtIn === "accepted_email_to_be_sent" || builtIn === "accepted_email_sent");
}

/** The do-not-email note's words (board 97e). */
export const DO_NOT_EMAIL_NOTE = "Don't email the applicant. The team leader sends the acceptance email with the NDA and marks it as sent.";

// The Statuses editor ------------------------------------------------------------

/**
 * Who manages the status list (owner decision on epic #588, 2026-10-25):
 * anyone who may move at least one application, by the rule every
 * application move asks. `mayMove` answers it for one place the viewer reads
 * applications in.
 */
export function managesStatusList<P>(places: readonly P[], mayMove: (place: P) => boolean): boolean {
  return places.some(mayMove);
}

/**
 * The colours a status may be given in the Statuses editor (board 97d): the
 * colours the built-in statuses ship with, which are the dashboard's own
 * status and text colours, and three more so an added status can stand apart
 * from its parent. Stored as the list stores a colour (`#RRGGBB`, upper case).
 */
export const STATUS_COLOURS = [
  { name: "Grey", colour: "#8A8A8F" },
  { name: "Dark grey", colour: "#5E5E64" },
  { name: "Orange", colour: "#FF5E00" },
  { name: "Amber", colour: "#F5A623" },
  { name: "Blue", colour: "#4DA3FF" },
  { name: "Green", colour: "#2E9B4F" },
  { name: "Red", colour: "#CE2B4B" },
  { name: "Pink", colour: "#E5489A" },
  { name: "Teal", colour: "#1FB5A8" },
  { name: "Violet", colour: "#9B6CF0" },
] as const;

export type StatusColour = (typeof STATUS_COLOURS)[number]["colour"];

export function isStatusColour(value: unknown): value is StatusColour {
  return STATUS_COLOURS.some((c) => c.colour === value);
}

/** What a colour is called, for its swatch's label; a stored colour the editor does not offer reads as its code. */
export function colourName(colour: string): string {
  return STATUS_COLOURS.find((c) => c.colour === colour)?.name ?? colour;
}

/** The longest name a status may have: it has to fit a list row and the picker. */
export const STATUS_NAME_MAX = 40;

/** A status's name and colour as the editor read them: the line a rename or recolour is guarded on. */
export type StatusAsRead = { readonly name: string; readonly colour: string };

/**
 * One change to the status list (board 97d): add a status under a built-in
 * parent, rename and recolour any status, or delete an added one. An edit
 * carries the name and colour it was made over (`was`), so it lands only
 * while the status still reads that way and never undoes someone else's edit.
 * Who may make a change, and whether a delete is allowed (`deleteRefusal`),
 * is checked where it is written.
 */
export type StatusListChange =
  | { readonly kind: "add"; readonly name: string; readonly colour: StatusColour; readonly parent: BuiltInStatusKey }
  | { readonly kind: "edit"; readonly key: string; readonly was: StatusAsRead; readonly name: string; readonly colour: StatusColour }
  | { readonly kind: "delete"; readonly key: string };

function statusAsReadOf(value: unknown): StatusAsRead | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, colour } = value as Record<string, unknown>;
  return typeof name === "string" && typeof colour === "string" ? { name, colour } : null;
}

type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/** A status name as typed: trimmed, inner runs of space made one, and refused when empty or too long. */
export function checkStatusName(value: unknown): Checked<string> {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name === "") return { ok: false, error: "Give the status a name." };
  if (name.length > STATUS_NAME_MAX) return { ok: false, error: `Keep the name to ${STATUS_NAME_MAX} characters.` };
  return { ok: true, value: name };
}

/** A change as the browser sent it, checked for shape: the change, or why it is not one. */
export function parseStatusListChange(value: unknown): Checked<StatusListChange> {
  const invalid = { ok: false, error: "That change is not valid." } as const;
  if (typeof value !== "object" || value === null) return invalid;
  const v = value as Record<string, unknown>;
  const key = typeof v.key === "string" && v.key !== "" ? v.key : null;
  switch (v.kind) {
    case "delete":
      return key === null ? invalid : { ok: true, value: { kind: "delete", key } };
    case "edit":
    case "add": {
      if (!isStatusColour(v.colour)) return invalid;
      const name = checkStatusName(v.name);
      if (!name.ok) return name;
      if (v.kind === "edit") {
        const was = statusAsReadOf(v.was);
        return key === null || was === null ? invalid : { ok: true, value: { kind: "edit", key, was, name: name.value, colour: v.colour } };
      }
      return isBuiltInStatusKey(v.parent) ? { ok: true, value: { kind: "add", name: name.value, colour: v.colour, parent: v.parent } } : invalid;
    }
    default:
      return invalid;
  }
}

/**
 * The key a new added status is stored under: its name in lower case with a
 * short random tail, so two statuses of one name never share a key and an
 * added key is never a built-in one.
 */
export function addedStatusKey(name: string, tail: string): string {
  const stem = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return `${stem || "status"}_${tail}`;
}

/**
 * Why a status cannot be deleted, or null when it can (owner decision on
 * epic #588, 2026-10-25): a built-in status is never deleted, and an added
 * one only while no application uses it.
 */
export function deleteRefusal(status: ApplicationStatus, uses: number): string | null {
  if (status.kind === "built-in") return "Built-in statuses can't be deleted.";
  if (uses === 1) return "1 application uses this status. Move it to another status first.";
  if (uses > 1) return `${uses} applications use this status. Move them to another status first.`;
  return null;
}
