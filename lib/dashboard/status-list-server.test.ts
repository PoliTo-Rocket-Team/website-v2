import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { sql } from "drizzle-orm";
import { applications, applicationStatuses } from "@/db/schema";
import { listedStatusOf } from "./application-status";
import type { DashboardData } from "./data";
import { addRows, changeRows, tableRows, testDb } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { openDashboard } from "./open";

// The Statuses editor's writes on the real database (board 97d, issue #752):
// a built-in status is renamed and recoloured but never deleted, an added one
// is deleted only while no application uses it, a rename or recolour reaches
// every application in that status, and someone who may move no application
// neither gets the editor nor makes its writes. It runs against the migrated
// in-memory Postgres the access matrix uses (./access-matrix/test-database.ts).

const APPLICATION = IDS.application("MA");
const MAY = "division lead"; // leads Mission Analysis, so moves its applications
const READS_ONLY = "member with an Applications grant (Can view) across the team"; // reads every application, moves none

const statusRow = async (key: string) => (await tableRows(applicationStatuses)).find((s) => s.key === key);
const SECOND_INTERVIEW = { key: "second_interview", name: "Second interview", colour: "#FF5E00", sortOrder: 1, parentKey: "interview" };

async function dashboardOf(name: string): Promise<DashboardData> {
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (opening as { data: DashboardData }).data;
}

describe("The Statuses editor's writes (issue #752)", () => {
  test("a built-in status cannot be deleted", async () => {
    await seedFixture();
    signInAs(accountOf(MAY).userId);
    assert.deepEqual(await recruitmentActions.changeStatusList({ kind: "delete", key: "interview" }), { ok: false, error: "Built-in statuses can't be deleted." });
    assert.ok(await statusRow("interview"), "Interview stays in the list");
  });

  test("an added status any application uses cannot be deleted; once none does, it can", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [SECOND_INTERVIEW]);
    await changeRows(applications, { id: APPLICATION }, { statusKey: "second_interview" });
    signInAs(accountOf(MAY).userId);

    const inUse = await recruitmentActions.changeStatusList({ kind: "delete", key: "second_interview" });
    assert.deepEqual(inUse, { ok: false, error: "1 application uses this status. Move it to another status first." });
    assert.ok(await statusRow("second_interview"), "the status stays while it is used");

    await changeRows(applications, { id: APPLICATION }, { statusKey: "interview" });
    assert.deepEqual(await recruitmentActions.changeStatusList({ kind: "delete", key: "second_interview" }), { ok: true, value: null });
    assert.equal(await statusRow("second_interview"), undefined);
  });

  test("an added status sits last under the parent it was given, with its name and colour", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [SECOND_INTERVIEW]);
    signInAs(accountOf(MAY).userId);
    assert.deepEqual(await recruitmentActions.changeStatusList({ kind: "add", name: "  Final  round ", colour: "#9B6CF0", parent: "interview" }), { ok: true, value: null });
    const added = (await tableRows(applicationStatuses)).find((s) => s.name === "Final round");
    assert.ok(added);
    assert.deepEqual({ parentKey: added.parentKey, colour: added.colour, sortOrder: added.sortOrder }, { parentKey: "interview", colour: "#9B6CF0", sortOrder: 2 });
  });

  test("renaming and recolouring a status shows the new name and colour on every application in it", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [SECOND_INTERVIEW]);
    await changeRows(applications, { id: APPLICATION }, { statusKey: "second_interview" });
    const data = await dashboardOf(MAY);
    assert.deepEqual(
      await recruitmentActions.changeStatusList({ kind: "edit", key: "second_interview", was: { name: "Second interview", colour: "#FF5E00" }, name: "Panel interview", colour: "#1FB5A8" }),
      { ok: true, value: null },
    );
    assert.deepEqual(
      await recruitmentActions.changeStatusList({ kind: "edit", key: "interview", was: { name: "Interview", colour: "#FF5E00" }, name: "First round", colour: "#4DA3FF" }),
      { ok: true, value: null },
    );

    const page = await data.applications();
    const shown = (id: number) => {
      const entry = page.applications.find((a) => a.id === id)!;
      const { name, colour } = listedStatusOf(page.statuses, entry.status);
      return { name, colour };
    };
    assert.deepEqual(shown(APPLICATION), { name: "Panel interview", colour: "#1FB5A8" });
    assert.deepEqual(shown(IDS.interview("MA")), { name: "First round", colour: "#4DA3FF" }, "a built-in status renamed and recoloured");
  });

  test("of two edits made over one reading of a status, the later is told the list changed and undoes nothing", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [SECOND_INTERVIEW]);
    signInAs(accountOf(MAY).userId);
    const read = { name: SECOND_INTERVIEW.name, colour: SECOND_INTERVIEW.colour };

    const rename = await recruitmentActions.changeStatusList({ kind: "edit", key: "second_interview", was: read, name: "Panel interview", colour: read.colour });
    assert.deepEqual(rename, { ok: true, value: null });
    const recolour = await recruitmentActions.changeStatusList({ kind: "edit", key: "second_interview", was: read, name: read.name, colour: "#1FB5A8" });
    assert.deepEqual(recolour, { ok: false, error: "The status list changed. Reload the page." });

    const stored = await statusRow("second_interview");
    assert.deepEqual({ name: stored?.name, colour: stored?.colour }, { name: "Panel interview", colour: SECOND_INTERVIEW.colour });
  });

  test("a delete the foreign key refuses, because an application moved in past the guard, answers a refusal, not an error", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [SECOND_INTERVIEW]);
    signInAs(accountOf(MAY).userId);
    // The move lands after the delete's guard has read no application in the
    // status and before the row goes, as a move committed mid-delete would.
    // Here it runs inside the delete, so it rolls back with it: the re-read
    // then finds no application in the status and answers the list changed.
    // A move committed on its own stays, and the re-read answers it in use.
    await testDb.execute(
      sql.raw(`create function test_journal.move_in_mid_delete() returns trigger language plpgsql as $$
        begin
          update public.applications set status_key = old.key where id = ${APPLICATION};
          return old;
        end $$`),
    );
    await testDb.execute(
      sql.raw("create trigger move_in_mid_delete before delete on public.application_statuses for each row execute function test_journal.move_in_mid_delete()"),
    );
    try {
      const answer = await recruitmentActions.changeStatusList({ kind: "delete", key: "second_interview" });
      assert.deepEqual(answer, { ok: false, error: "The status list changed. Reload the page." });
    } finally {
      await testDb.execute(sql.raw("drop trigger move_in_mid_delete on public.application_statuses"));
      await testDb.execute(sql.raw("drop function test_journal.move_in_mid_delete()"));
    }
    assert.ok(await statusRow("second_interview"), "the status stays");
  });

  test("someone who may move no application gets no editor and is refused its writes, which write nothing", async () => {
    await seedFixture();
    await addRows(applicationStatuses, [SECOND_INTERVIEW]);
    const before = await tableRows(applicationStatuses);

    const reader = await dashboardOf(READS_ONLY);
    const page = await reader.applications();
    assert.ok(page.applications.length > 0, "they read applications");
    assert.ok(page.applications.every((a) => !a.canChange), "and move none");
    assert.equal(page.statusUses, null, "so the page offers no Statuses editor");
    for (const change of [
      { kind: "add", name: "Mine", colour: "#E5489A", parent: "new" },
      { kind: "edit", key: "new", was: { name: "New", colour: "#8A8A8F" }, name: "Mine", colour: "#E5489A" },
      { kind: "delete", key: "second_interview" },
    ]) {
      const answer = await recruitmentActions.changeStatusList(change);
      assert.equal(answer.ok, false, `${change.kind} is refused`);
    }
    assert.deepEqual(await tableRows(applicationStatuses), before);

    const mover = await (await dashboardOf(MAY)).applications();
    assert.notEqual(mover.statusUses, null, "a lead who moves applications gets the editor");
  });
});
