import assert from "node:assert/strict";
import { test } from "node:test";
import { members, users } from "@/db/schema";
import { addRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { joinDayOf } from "./dates";
import { afterWrite, failureReport } from "./failure";
import { rosterOf, type JoinRow } from "./roster";
import { runBackfill } from "./run";
import type { BackfillDb } from "./snapshot";

// The team join date backfill (issue #948) over a fake roster built in memory
// and the in-memory Postgres every migration in drizzle/ built. Every name is
// invented and every email is on example.com.

const db = testDb as unknown as BackfillDb;

const ANNA = 9601; // on the current sheet, which carries the column too
const BRUNO = 9602; // found by his PRT address alone
const CARLA = 9603; // already holds the roster's join day
const DORA = 9604; // already holds a different join day: kept
const ELIO = 9605; // left and came back: two Quitters rows
const SHARED_A = 9606; // two members one address finds
const SHARED_B = 9607;
const GINO = 9608; // a join day stored month/day

/** The Excel day serial of a day, as a date cell stores it. */
const serialOf = (day: string) => String((Date.parse(`${day}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000);

const CURRENT_HEADER = ["First Name", "Last Name", "Personal Mail", "Joined the Team on"];
const QUITTERS_HEADER = ["Left the Team on:", "Joined the Team on:", "First Name", "Last Name", "Personal Mail", "PRT email"];

const ROSTER = rosterOf([
  { name: "2025-2026", rows: [CURRENT_HEADER, ["Anna", "Example", "ANNA@Example.com", "15/11/2023"], ["Nora", "Example", "nora@example.com", ""]] },
  { name: "2024-2025", rows: [["First Name", "Last Name", "Personal Mail"], ["Anna", "Example", "anna@example.com"]] },
  {
    name: "Quitters",
    rows: [
      ["People who left the team"],
      QUITTERS_HEADER,
      // Row 3: Bruno, found by his PRT address.
      ["10/01/2025", "01/10/2022", "Bruno", "Example", "", "bruno@politorocketteam.example.com"],
      // Row 4: Carla, whose join day is already stored.
      ["01/02/2026", "05/10/2022", "Carla", "Example", "carla@example.com", ""],
      // Row 5: Dora, who already holds a different join day.
      ["01/02/2024", "01/10/2022", "Dora", "Example", "dora@example.com", ""],
      // Rows 6 and 7: Elio left and came back; the later stint first.
      ["20/05/2025", "01/02/2024", "Elio", "Example", "elio@example.com", ""],
      ["30/09/2022", "10/10/2021", "Elio", "Example", "elio@example.com", ""],
      // Row 8: no member has his email.
      ["01/03/2025", "01/10/2023", "Fabio", "Example", "fabio@example.com", ""],
      // Row 9: the address finds two members.
      ["01/03/2025", "01/10/2023", "Shared", "Example", "shared@example.com", ""],
      // Row 10: a day that does not exist.
      ["01/03/2025", "31/02/2024", "Hugo", "Example", "hugo@example.com", ""],
      // Row 11: joined after leaving, typed text, so no swap.
      ["01/02/2024", "20/05/2024", "Hugo", "Example", "hugo@example.com", ""],
      // Row 12: a date cell stored month/day: read day first it is 2 March, after the leave day; swapped it is 3 February.
      ["15/02/2024", serialOf("2024-03-02"), "Gino", "Example", "gino@example.com", ""],
      // Row 13: a join day and no email.
      ["15/02/2024", "01/10/2023", "Ivo", "Example", "", ""],
    ],
  },
  { name: "Stats", rows: [["anything"]] },
]);

async function world(): Promise<void> {
  await restore("team-join-date-world", async () => {
    await addRows(members, [
      { memberId: ANNA },
      { memberId: BRUNO, prtEmail: "bruno@politorocketteam.example.com" },
      { memberId: CARLA, joinedTeamOn: "2022-10-05" },
      { memberId: DORA, joinedTeamOn: "2021-01-01" },
      { memberId: ELIO },
      { memberId: SHARED_A },
      { memberId: SHARED_B, prtEmail: "shared@example.com" },
      { memberId: GINO },
    ]);
    await addRows(users, [
      { id: "imported:anna", email: "anna@example.com", member: ANNA },
      { id: "imported:carla", email: "carla@example.com", member: CARLA },
      { id: "imported:dora", email: "dora@example.com", member: DORA },
      { id: "imported:elio", email: "elio@example.com", member: ELIO },
      { id: "imported:shared", email: "shared@example.com", member: SHARED_A },
      { id: "imported:gino", email: "gino@example.com", member: GINO },
    ]);
  });
}

const joinDays = async () =>
  Object.fromEntries(((await tableRows(members)) as (typeof members.$inferSelect)[]).map((m) => [m.memberId, m.joinedTeamOn]));

test("the roster reads every sheet with a Joined the Team on column, and leaves the others out", () => {
  assert.deepEqual(ROSTER.read, ["2025-2026", "Quitters"]);
  assert.deepEqual(ROSTER.skipped, ['2024-2025: no "Joined the Team on" column', 'Stats: no "Joined the Team on" column']);
});

test("a dry run plans each member's earliest join day by row, skips what it cannot place, prints no personal value, and writes nothing", async () => {
  await world();
  const { plan, report } = await runBackfill({ mode: "dry-run", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(
    plan.sets.map((s) => [s.memberId, s.day]).sort(([a], [b]) => Number(a) - Number(b)),
    [
      [ANNA, "2023-11-15"],
      [BRUNO, "2022-10-01"],
      [ELIO, "2021-10-10"],
      [GINO, "2024-02-03"],
    ],
  );
  assert.deepEqual(
    plan.skipped.map((s) => [s.kind, s.at.row]),
    [
      ["no-member", 8],
      ["ambiguous-member", 9],
      ["date-unreadable", 10],
      ["dates-out-of-order", 11],
      ["no-email", 13],
      ["stored-differs", 5],
    ],
  );
  assert.equal(plan.alreadyStored, 1);
  assert.equal(plan.noJoinDate, 1);
  assert.equal(plan.severalDays, 1);
  assert.match(report, /^Team join date backfill \(issue #948\): dry run, nothing written$/m);
  assert.match(report, /^Members to date: 4$/m);
  assert.match(report, /^ {2}Quitters row 6, Quitters row 7: 2021-10$/m);
  assert.match(report, /^ {2}\[stored-differs\] Quitters row 5: /m);
  assert.match(report, /^ {2}Quitters row 12 › field joinedOn$/m);
  for (const personal of ["Anna", "Example", "example.com", "Bruno", String(ANNA), "2023-11-15"]) assert.ok(!report.includes(personal), `the report prints no ${personal}`);
});

test("a real run stores each planned join day, changes nothing else, and a second run plans nothing", async () => {
  await world();
  const before = await joinDays();
  const { written } = await runBackfill({ mode: "backfill", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(written, { members: 4 });
  assert.deepEqual(await joinDays(), { ...before, [ANNA]: "2023-11-15", [BRUNO]: "2022-10-01", [ELIO]: "2021-10-10", [GINO]: "2024-02-03" });
  assert.deepEqual(new Set((await databaseWrites()).map((w) => `${w.kind} ${w.table}`)), new Set(["update members"]));
  const again = await runBackfill({ mode: "backfill", file: "roster.xlsx", roster: ROSTER, db });
  assert.deepEqual(again.plan.sets, []);
  assert.deepEqual(again.written, { members: 0 });
});

test("a failure after a real run's commit says the backfill was written; a dry run's says nothing was written", async () => {
  await world();
  const fail = { name: "writing the report file", act: () => Promise.reject(new Error("EACCES: permission denied")) };
  const real = await runBackfill({ mode: "backfill", file: "roster.xlsx", roster: ROSTER, db }, [fail]).then(() => "no failure", failureReport);
  assert.match(real, /^Team join date backfill was written: its transaction committed\. Then writing the report file failed\.\n {2}EACCES: permission denied$/);
  await world();
  const dry = await runBackfill({ mode: "dry-run", file: "roster.xlsx", roster: ROSTER, db }, [fail]).then(() => "no failure", failureReport);
  assert.match(dry, /^Team join date backfill failed; nothing was written\./);
  assert.deepEqual(await databaseWrites(), []);
  assert.equal(await afterWrite("closing the database connection", () => 7), 7);
});

test("a row's join day reads day first, swaps a date cell stored month/day, and gives none when its dates do not read or stay out of order", () => {
  const row = (joinedOn: string, leftOn: string): JoinRow => ({
    at: { sheet: "Quitters", row: 2 },
    value: { firstName: "A", lastName: "B", personalEmail: "", studentEmail: "", phdEmail: "", prtEmail: "", joinedOn, leftOn },
  });
  assert.deepEqual(joinDayOf(row("01/10/2023", "")), { kind: "joined", day: "2023-10-01", swapped: false });
  assert.deepEqual(joinDayOf(row("2023-11-02", "15/03/2026")), { kind: "joined", day: "2023-11-02", swapped: false });
  // The leave cell is swapped first: 2026-01-03 read swapped is 1 March 2026, after the join day, which stands as read.
  assert.deepEqual(joinDayOf(row("15/02/2026", serialOf("2026-01-03"))), { kind: "joined", day: "2026-02-15", swapped: false });
  assert.deepEqual(joinDayOf(row(serialOf("2024-03-02"), "15/02/2024")), { kind: "joined", day: "2024-02-03", swapped: true });
  assert.deepEqual(joinDayOf(row("", "15/02/2024")), { kind: "no-join-date" });
  assert.deepEqual(joinDayOf(row("31/02/2024", "")), { kind: "date-unreadable", field: "joinedOn" });
  assert.deepEqual(joinDayOf(row("01/10/2023", "soon")), { kind: "date-unreadable", field: "leftOn" });
  assert.deepEqual(joinDayOf(row("20/05/2024", "01/02/2024")), { kind: "dates-out-of-order" });
});
