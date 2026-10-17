// The alumni seed (issues #304, #326): how people who left show on the
// Alumni page (issue #257). The page lists the years the site publishes
// (lib/about/alumni-import.ts), which drizzle/0021 imports, with its founder
// and co-founder marks; this seed writes the same entries and lines. The rest
// of the page is built from the roles the people seed holds, whose leavers
// are invented, since the public data holds no history; an entry only changes
// how one of them shows: a hidden entry, a fixed name, a request to be
// removed, and the name kept for an account that was anonymized
// (lib/dashboard/anonymize.ts).

import { alumniEntries, alumniImportedRoles, alumniRoleFixes } from "@/db/schema";
import { importedEntries } from "@/lib/about/alumni-import";
import { ANONYMIZED_ALUMNUS, HIDDEN_ALUMNUS, REMOVED_ALUMNUS, RENAMED_ALUMNUS } from "./people";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-07-01 10:00:00+00";

/** The public years as drizzle/0021 imports them: entries numbered from 1. */
export const IMPORTED_ALUMNI = importedEntries(1);

/** The first id after the imported entries. */
const FIRST_MEMBER_ENTRY = IMPORTED_ALUMNI.entries.length + 1;

/** The name the anonymized alumnus's entry keeps from the team record. */
export const ANONYMIZED_KEPT_NAME = "Enrico Lodi";

/** The name an editor fixed for the renamed alumnus. */
export const FIXED_NAME = "Giada Ferraris Bonetti";

export const ALUMNI_ENTRY_ROWS = rowsOf(alumniEntries, [
  ...IMPORTED_ALUMNI.entries.map((entry) => {
    if (entry.who.kind !== "imported") throw new Error(`imported entry ${entry.id} is not an imported person`);
    return {
      id: entry.id,
      kind: "imported" as const,
      recordName: entry.who.name,
      founder: entry.founder === null ? null : entry.founder === "founder" ? ("founder" as const) : ("co_founder" as const),
      photo: entry.photo,
      createdAt: CREATED,
    };
  }),
  { id: FIRST_MEMBER_ENTRY, kind: "member", memberId: HIDDEN_ALUMNUS, shown: false, createdAt: CREATED },
  { id: FIRST_MEMBER_ENTRY + 1, kind: "member", memberId: ANONYMIZED_ALUMNUS, recordName: ANONYMIZED_KEPT_NAME, photo: null, createdAt: CREATED },
  { id: FIRST_MEMBER_ENTRY + 2, kind: "member", memberId: REMOVED_ALUMNUS, removedAt: "2026-07-10 18:30:00+00", createdAt: CREATED },
  { id: FIRST_MEMBER_ENTRY + 3, kind: "member", memberId: RENAMED_ALUMNUS, name: FIXED_NAME, createdAt: CREATED },
]);

export const ALUMNI_IMPORTED_ROLE_ROWS = rowsOf(
  alumniImportedRoles,
  IMPORTED_ALUMNI.imported.map((line) => ({ entryId: line.entryId, year: line.year, groupName: line.group, role: line.role, position: line.position })),
);

export const alumni = tableSeedModule({
  name: "alumni",
  owns: [alumniEntries, alumniImportedRoles, alumniRoleFixes],
  rows: [ALUMNI_ENTRY_ROWS, ALUMNI_IMPORTED_ROLE_ROWS],
});
