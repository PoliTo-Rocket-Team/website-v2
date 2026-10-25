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
