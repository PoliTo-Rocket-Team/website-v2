// Where a stored application stands (issue #171). The database source
// (./database-recruitment.ts) and the seed's case checks (db/seed/cases.ts)
// both read an `applications` row through this one mapping, so a seeded row
// reads on the page as the seed says it does.

import type { applications } from "@/db/schema";
import type { ApplicationState } from "./application-flow";
import { interviewStateOf, type SlotRow } from "./interview-slots";

/** An `applications` status, as the database stores it. */
export type StoredApplicationStatus = (typeof applications.$inferSelect)["status"];

/** The columns of one `applications` row that say where it stands. */
export type StoredApplicationRow = {
  status: StoredApplicationStatus;
  applied_at: string;
  accepted_at: string | null;
  nda_arrived_at: string | null;
  joined_at: string | null;
};

/**
 * Where a stored application stands. "Accepted by another team" reads as
 * Rejected: this team did not take them. An interview row reads as
 * ./interview-slots.ts says.
 */
export function storedApplicationState(row: StoredApplicationRow, slots: readonly SlotRow[]): ApplicationState {
  switch (row.status) {
    case "received":
      return { stage: "new" };
    case "pending":
      return { stage: "in-review" };
    case "interview":
      return interviewStateOf(slots);
    case "accepted":
      return { stage: "accepted", acceptedAt: row.accepted_at ?? row.applied_at, ndaArrived: row.nda_arrived_at !== null };
    case "joined":
      return { stage: "joined", joinedAt: row.joined_at ?? row.accepted_at ?? row.applied_at };
    case "rejected":
    case "accepted_by_another_team":
      return { stage: "rejected" };
  }
}
