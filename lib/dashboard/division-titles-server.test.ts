import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { roles } from "@/db/schema";
import { addRows, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { NO_MEMBER_DETAILS } from "./details";
import type { DetailsTarget } from "./division-members";

// Issue #911: Edit details gives each division row its own title. Save writes each row's title to that
// division's role rows only, and checks the viewer's reach for every division it writes, refusing the whole
// save when one is out of reach. On the migrated in-memory Postgres the access matrix uses.

const MA = IDS.division("MA");
const OA = IDS.division("OA");
const PERSON = { kind: "person", id: IDS.person("MA") } as const satisfies DetailsTarget;
const OA_ROW = 5_900;
const REFUSED = { ok: false, error: "You can edit only people your Members page lets you change." };

/** The fixture, with the MA person also a member of OA (both in Aerodynamics). */
async function seedTwoDivisions(): Promise<void> {
  await seedFixture();
  await addRows(roles, [{ id: OA_ROW, memberId: PERSON.id, divisionId: OA, title: "Member", startedAt: "2025-10-01", type: "core" }]);
}

/** The person's active title in each division. */
async function titles(): Promise<Record<number, string | null>> {
  const rows = (await tableRows(roles)).filter((r) => r.memberId === PERSON.id && r.leavedAt === null && r.divisionId !== null);
  return Object.fromEntries(rows.map((r) => [r.divisionId, r.title]));
}

const save = (viewer: string, title: string, divisionTitles: readonly { divisionId: number; title: string }[]) => {
  signInAs(accountOf(viewer).userId);
  return teamActions.saveMemberDetails(PERSON, MA, { title, divisionTitles, details: NO_MEMBER_DETAILS });
};

describe("Edit details saves each division row's title (issue #911)", () => {
  test("each row's title goes to its own division's rows; a row left as it was keeps its title", async () => {
    await seedTwoDivisions();
    assert.deepEqual(await save("department head", "Member", [{ divisionId: OA, title: "Trajectory analyst" }]), { ok: true });
    assert.deepEqual(await titles(), { [MA]: "Member", [OA]: "Trajectory analyst" });

    assert.deepEqual(await save("department head", "Mission designer", []), { ok: true });
    assert.deepEqual(await titles(), { [MA]: "Mission designer", [OA]: "Trajectory analyst" });
  });

  test("a division outside the viewer's reach refuses the whole save, and nothing is written", async () => {
    await seedTwoDivisions();
    // MA's lead reaches MA, not OA.
    assert.deepEqual(await save("division lead", "Mission designer", [{ divisionId: OA, title: "Trajectory analyst" }]), REFUSED);
    assert.deepEqual(await titles(), { [MA]: "Member", [OA]: "Member" });
  });

  test("the form's own division sent again as a row is refused", async () => {
    await seedTwoDivisions();
    assert.deepEqual(await save("department head", "Member", [{ divisionId: MA, title: "Other" }]), REFUSED);
    assert.deepEqual(await titles(), { [MA]: "Member", [OA]: "Member" });
  });
});
