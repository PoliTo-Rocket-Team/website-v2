// Where a stored application stands (issue #171). The database source
// (./database-recruitment.ts) and the seed's case checks (db/seed/cases.ts)
// both read an `applications` row through this one mapping, so a seeded row
// reads on the page as the seed says it does. The status is read through the
// row's status reference and the status list (./application-status.ts,
// issue #748): an added status reads as its built-in parent, and a row with
// no reference reads as New.

import { statusAfter, type ApplicationState } from "./application-flow";
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
 * The status reference a lead's move writes on `row` (`statusAfter`,
 * ./application-flow.ts): after a button, the built-in status the move set,
 * or the row's own status when the move keeps the built-in status it already
 * behaves like, so Change times on an added status under Interview keeps the
 * added status; after a hand pick, the picked status.
 */
export function statusKeyAfter(
  row: Pick<StoredApplicationRow, "status_key" | "status_parent_key">,
  state: ApplicationState,
  via: "button" | "pick" = "button",
): string {
  return statusAfter(statusOfStored({ key: row.status_key, parentKey: row.status_parent_key }), state, via).key;
}

/** The days a stored row keeps beside its status: when it was accepted, when the signed NDA arrived, when it ended without a place, when it joined. */
export type StoredDays = {
  readonly accepted_at: string | null;
  readonly nda_arrived_at: string | null;
  readonly rejected_at: string | null;
  readonly joined_at: string | null;
};

/**
 * The days a hand pick of a status added under `parent` records (epic #588,
 * review of PR #755): an added status behaves like its parent, so the row
 * keeps the days its parent's state reads, and a day it lacks is the day of
 * the pick. Nothing else is written: no team member, no interview times, no
 * withdrawal. So an application picked into a status under "Accepted · email
 * sent" from New has an acceptance day the applicant's month counts from, and
 * one under NDA received has the NDA day Confirm join asks for. A day the row
 * already has is kept, and a day the parent does not read is left as it is.
 * A status the team added under Withdrawn is the team's decision, not the
 * applicant's withdrawal, so its day is the day it ended without a place
 * (`rejected_at`), as for "Accepted for another position"; the withdrawal day
 * stays the applicant's Withdraw's, with its effects.
 */
export function daysOfAddedPick(parent: BuiltInStatusKey, row: StoredDays, now: string): Partial<StoredDays> {
  switch (parent) {
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
      return { accepted_at: row.accepted_at ?? now };
    case "nda_received":
      return { accepted_at: row.accepted_at ?? now, nda_arrived_at: row.nda_arrived_at ?? now };
    case "joined":
      return { joined_at: row.joined_at ?? now };
    case "rejected_email_to_be_sent":
    case "rejected_email_sent":
    case "accepted_for_another_position":
    case "withdrawn":
      return { rejected_at: row.rejected_at ?? now };
    case "new":
    case "interview":
      return {};
  }
}
