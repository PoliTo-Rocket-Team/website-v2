import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { getPublicPositions } from "@/app/actions/get-apply-positions";
import { applications, applyPositions } from "@/db/schema";
import { databaseApplyData } from "@/lib/apply/database";
import { submitDepsOf } from "@/lib/apply/data";
import { submitApplication } from "@/lib/apply/submit";
import { tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { openDashboard } from "./open";
import type { DashboardData } from "./data";

// Delete position (issue #772), on the real database: a soft delete through
// the audited path. The position leaves the Positions page, /apply and the
// submit; its row and its applications stay, and the Applications page still
// lists them under its title, with no step or file link the server refuses.
// It runs against the migrated in-memory Postgres the access matrix uses
// (./access-matrix/test-database.ts).

const POSITION = IDS.position("MA");
const EDITOR = "division lead"; // leads Mission Analysis, so changes its positions
const VIEWER = "member with a Positions grant (Can view) in MA";

async function dashboardOf(name: string): Promise<DashboardData> {
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

const stored = async () => (await tableRows(applyPositions)).find((p) => p.id === POSITION);
const applicationsOn = async () =>
  (await tableRows(applications)).filter((a) => a.applyPositionId === POSITION).map((a) => a.id);

describe("Delete position, on the real database (issue #772)", () => {
  test("the editor of the position and the team leader delete it; the row and its applications stay", async () => {
    for (const who of [EDITOR, "team leader"]) {
      await seedFixture();
      const kept = await applicationsOn();
      assert.ok(kept.length > 0, "the position has applications");
      signInAs(accountOf(who).userId);
      assert.deepEqual(await recruitmentActions.deletePosition(POSITION), { ok: true, value: null }, who);
      assert.equal((await stored())?.isDeleted, true, `${who}: the row stays, marked deleted`);
      assert.deepEqual(await applicationsOn(), kept, `${who}: its applications stay`);
    }
  });

  test("a viewer who cannot edit the position is refused, and it stays", async () => {
    await seedFixture();
    const data = await dashboardOf(VIEWER);
    assert.ok(
      (await data.positions()).positions.some((p) => p.id === POSITION && !p.canChange),
      "they read it and may not change it",
    );
    const answer = await recruitmentActions.deletePosition(POSITION);
    assert.equal(answer.ok, false);
    assert.equal((await stored())?.isDeleted, false);
  });

  test("a deleted position leaves the Positions page, /apply and the submit, and the activity log names it", async () => {
    await seedFixture();
    const editor = await dashboardOf(EDITOR);
    const title = (await editor.positions()).positions.find((p) => p.id === POSITION)?.title;
    assert.ok(title, "the editor reads it before the delete");
    const listed = await getPublicPositions();
    assert.ok(listed.status === "available" && listed.positions.some((p) => p.id === POSITION), "on /apply before the delete");

    assert.deepEqual(await recruitmentActions.deletePosition(POSITION), { ok: true, value: null });

    assert.equal((await editor.positions()).positions.some((p) => p.id === POSITION), false, "off the Positions page");
    const after = await getPublicPositions();
    assert.ok(after.status === "available" && !after.positions.some((p) => p.id === POSITION), "off /apply");
    signInAs(accountOf("member").userId);
    assert.deepEqual(await submitApplication(POSITION, new FormData(), submitDepsOf(databaseApplyData)), {
      ok: false,
      reason: "not-public",
    });

    // The IT lead reads the activity log (lib/dashboard/access-matrix-server.test.ts).
    const log = await (await dashboardOf("IT lead")).activityLog();
    assert.ok(
      log?.entries.some((e) => e.change.kind === "write" && e.change.sentence === `Deleted the position ${title}`),
      "the activity log says it was deleted",
    );
  });

  test("its applications still list on the Applications page under its title, with no step or file link the server refuses", async () => {
    await seedFixture();
    const before = await (await dashboardOf(EDITOR)).applications();
    const own = before.applications.filter((a) => a.position.ref === String(POSITION));
    assert.ok(own.length > 0 && own.every((a) => a.canChange), "listed and movable before the delete");

    assert.deepEqual(await recruitmentActions.deletePosition(POSITION), { ok: true, value: null });

    for (const who of [EDITOR, "team leader"]) {
      const after = await (await dashboardOf(who)).applications();
      const kept = after.applications.filter((a) => a.position.ref === String(POSITION));
      assert.deepEqual(
        kept.map((a) => a.id).sort(),
        own.map((a) => a.id).sort(),
        `${who}: the same applications list`,
      );
      for (const a of kept) {
        assert.equal(a.position.title, own[0].position.title, `${who}: under the position's title`);
        assert.equal(a.canChange, false, `${who}: no step is offered`);
        assert.ok(a.documents.every((d) => d.href === null), `${who}: no file link is offered`);
        const step = await recruitmentActions.moveApplication(a.id, { kind: "reject" });
        assert.equal(step.ok, false, `${who}: the server refuses a step, as the page shows`);
      }
    }
  });
});
