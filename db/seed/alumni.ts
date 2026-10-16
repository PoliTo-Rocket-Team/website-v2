// The alumni seed (issue #304): how people who left show on the Alumni page
// (issue #257). The page is built from the roles the people seed holds; an
// entry only changes how one person shows: a founder mark, a hidden entry, a
// fixed name, a request to be removed, and the name kept for an account
// that was anonymized (lib/dashboard/anonymize.ts).

import { alumniEntries, alumniImportedRoles, alumniRoleFixes } from "@/db/schema";
import {
  ANONYMIZED_ALUMNUS,
  CO_FOUNDER,
  FOUNDER,
  HIDDEN_ALUMNUS,
  REMOVED_ALUMNUS,
  RENAMED_ALUMNUS,
} from "./people";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-07-01 10:00:00+00";

/** The name the anonymized alumnus's entry keeps from the team record. */
export const ANONYMIZED_KEPT_NAME = "Enrico Lodi";

/** The name an editor fixed for the renamed alumnus. */
export const FIXED_NAME = "Giada Ferraris Bonetti";

export const ALUMNI_ENTRY_ROWS = rowsOf(alumniEntries, [
  { id: 1, kind: "member", memberId: FOUNDER, founder: "founder", createdAt: CREATED },
  { id: 2, kind: "member", memberId: CO_FOUNDER, founder: "co_founder", createdAt: CREATED },
  { id: 3, kind: "member", memberId: HIDDEN_ALUMNUS, shown: false, createdAt: CREATED },
  { id: 4, kind: "member", memberId: ANONYMIZED_ALUMNUS, recordName: ANONYMIZED_KEPT_NAME, photo: null, createdAt: CREATED },
  { id: 5, kind: "member", memberId: REMOVED_ALUMNUS, removedAt: "2026-07-10 18:30:00+00", createdAt: CREATED },
  { id: 6, kind: "member", memberId: RENAMED_ALUMNUS, name: FIXED_NAME, createdAt: CREATED },
]);

export const alumni = tableSeedModule({
  name: "alumni",
  owns: [alumniEntries, alumniImportedRoles, alumniRoleFixes],
  rows: [ALUMNI_ENTRY_ROWS],
});
