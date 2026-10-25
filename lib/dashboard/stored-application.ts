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
 * Where a stored application stands: the built-in status its status behaves
 * like, with what that status keeps. The accepted statuses keep the day it was
 * accepted, Joined the day it joined, and an Interview its stored times
 * (./interview-slots.ts).
 */
export function storedApplicationState(row: StoredApplicationRow, slots: readonly SlotRow[]): ApplicationState {
  const status = storedBuiltInStatus(row);
  switch (status) {
    case "interview":
      return interviewStateOf(slots);
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
      return { status, acceptedAt: row.accepted_at ?? row.applied_at };
    case "joined":
      return { status, joinedAt: row.joined_at ?? row.accepted_at ?? row.applied_at };
    default:
      return { status };
  }
}

/**
 * The status reference a lead's move writes on `row`: the built-in status the
 * move set, or the row's own status when the move keeps the built-in status it
 * already behaves like, so Change times on an added status under Interview
 * keeps the added status.
 */
export function statusKeyAfter(row: Pick<StoredApplicationRow, "status_key" | "status_parent_key">, state: ApplicationState): string {
  return state.status === storedBuiltInStatus(row) && row.status_key !== null ? row.status_key : state.status;
}
