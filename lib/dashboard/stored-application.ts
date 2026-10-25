// Where a stored application stands (issue #171). The database source
// (./database-recruitment.ts) and the seed's case checks (db/seed/cases.ts)
// both read an `applications` row through this one mapping, so a seeded row
// reads on the page as the seed says it does. The status is read through the
// row's status reference and the status list (./application-status.ts,
// issue #748): an added status reads as its built-in parent, and a row with
// no reference reads as New.

import type { ApplicationState } from "./application-flow";
import { builtInOf, statusOfStored, type BuiltInStatusKey } from "./application-status";
import { interviewStateOf, type SlotRow } from "./interview-slots";

/** The columns of one `applications` row that say where it stands, with its status's parent key. */
export type StoredApplicationRow = {
  status_key: string | null;
  status_parent_key: string | null;
  applied_at: string;
  accepted_at: string | null;
  nda_arrived_at: string | null;
  joined_at: string | null;
};

/** The built-in status a stored row's status behaves like: an added one's parent, and New for no reference. */
export function storedBuiltInStatus(row: Pick<StoredApplicationRow, "status_key" | "status_parent_key">): BuiltInStatusKey {
  return builtInOf(statusOfStored({ key: row.status_key, parentKey: row.status_parent_key }));
}

/**
 * A stored row counts as a new application: its status behaves like New, or
 * it has no status reference. The old status column is not read (issue #748).
 */
export function readsAsNew(row: Pick<StoredApplicationRow, "status_key" | "status_parent_key">): boolean {
  return storedBuiltInStatus(row) === "new";
}

/**
 * Where a stored application stands. Both acceptance email statuses read as
 * Accepted waiting for the NDA, and NDA received as Accepted with the NDA
 * arrived. Both refusal email statuses and "Accepted for another position"
 * read as Rejected: this team did not take them. An interview row reads as
 * ./interview-slots.ts says.
 */
export function storedApplicationState(row: StoredApplicationRow, slots: readonly SlotRow[]): ApplicationState {
  const status = storedBuiltInStatus(row);
  switch (status) {
    case "new":
      return { stage: "new" };
    case "interview":
      return interviewStateOf(slots);
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
      return { stage: "accepted", acceptedAt: row.accepted_at ?? row.applied_at, ndaArrived: status === "nda_received" };
    case "joined":
      return { stage: "joined", joinedAt: row.joined_at ?? row.accepted_at ?? row.applied_at };
    case "rejected_email_to_be_sent":
    case "rejected_email_sent":
    case "accepted_for_another_position":
      return { stage: "rejected" };
    case "withdrawn":
      return { stage: "withdrawn" };
  }
}

/**
 * The built-in status a lead's move writes for the state it reaches from a
 * row whose status behaves like `before`. In review is no status (ruling R1.2
 * on #745), so it writes New. Accept writes "Accepted · email to be sent",
 * the NDA tick "NDA received", and Reject "Rejected · email to be sent".
 * Taking the NDA tick back returns to the acceptance email status the row
 * had, so a sent email stays sent.
 */
export function statusKeyOf(state: Exclude<ApplicationState, { stage: "withdrawn" }>, before: BuiltInStatusKey): BuiltInStatusKey {
  switch (state.stage) {
    case "new":
    case "in-review":
      return "new";
    case "interview":
      return "interview";
    case "accepted":
      if (state.ndaArrived) return "nda_received";
      return before === "accepted_email_sent" ? "accepted_email_sent" : "accepted_email_to_be_sent";
    case "joined":
      return "joined";
    case "rejected":
      return "rejected_email_to_be_sent";
  }
}

/**
 * The status reference a lead's move writes on `row`: the built-in status
 * `statusKeyOf` names, or the row's own status when that is the built-in
 * status it already behaves like, so Change times on an added status under
 * Interview keeps the added status.
 */
export function statusKeyAfter(
  row: Pick<StoredApplicationRow, "status_key" | "status_parent_key">,
  state: Exclude<ApplicationState, { stage: "withdrawn" }>,
): string {
  const before = storedBuiltInStatus(row);
  const next = statusKeyOf(state, before);
  return next === before && row.status_key !== null ? row.status_key : next;
}
