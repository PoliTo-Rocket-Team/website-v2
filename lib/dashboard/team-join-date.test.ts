import assert from "node:assert/strict";
import { test } from "node:test";
import { placeHeaderLine, type PersonPlace } from "./member-places";
import { departureYearsOf, joinedYearOf, memberRowOf, type OrgChart } from "./team";
import { recordsOf, rosterOf, type TeamSnapshot } from "./team-snapshot";

// Issue #948 (owner decision, 2026-11-01): every dashboard place that shows
// when a member joined the team reads the stored team join day
// (`members.joined_team_on`), never a role's start, since the roster's role
// starts are academic-year placeholders. With no stored day, nothing is shown.

const org: OrgChart = {
  departments: [{ id: 1, name: "Aerodynamics", kind: "technical" }],
  divisions: [{ id: 10, name: "Mission Analysis Division", departmentId: 1 }],
};

type Role = TeamSnapshot["roles"][number];
type Person = TeamSnapshot["people"][number];

/** Stored join day 2022-11-15; yearly roles from 2020 (a placeholder) to now, with a gap: left and came back. */
const STORED = 1;
/** No stored join day; roles back to 2021. */
const NOT_STORED = 2;

let rowId = 0;
function role(memberId: number, startedAt: string, leavedAt: string | null): Role {
  return { id: ++rowId, member_id: memberId, type: "core", title: "", started_at: startedAt, leaved_at: leavedAt, dept_id: null, division_id: 10, full_access: null };
}

function person(memberId: number, joinedTeamOn: string | null): Person {
  return {
    member_id: memberId,
    user_id: `user-${memberId}`,
    first_name: `Person${memberId}`,
    last_name: "Example",
    email: `${memberId}@team.test`,
    program: null,
    level_of_study: null,
    team_from: 2019,
    team_to: null,
    joined_team_on: joinedTeamOn,
    phone: null,
    mobile_number: null,
    discord: null,
    prt_email: null,
    linkedin: null,
    polito_id: null,
    country: null,
    date_of_birth: null,
    gender: null,
    picture: null,
    nda_signed_at: null,
    nda_confirmed_by: null,
    nda_confirmed_by_acting_account: null,
  };
}

const snapshot: TeamSnapshot = {
  org,
  roles: [
    role(STORED, "2020-10-01", "2021-09-30"),
    role(STORED, "2023-10-01", "2024-09-30"),
    role(STORED, "2025-10-01", null),
    role(NOT_STORED, "2021-10-01", "2022-09-30"),
    role(NOT_STORED, "2025-10-01", null),
  ],
  people: [person(STORED, "2022-11-15"), person(NOT_STORED, null)],
  scopes: [],
};

test("the Members joined year is the stored join day's year, never the earliest role's or team_from, and null without one", () => {
  const joined = Object.fromEntries(rosterOf(snapshot).map((e) => [e.id, e.joined]));
  assert.deepEqual(joined, { [STORED]: 2022, [NOT_STORED]: null });
  assert.deepEqual(
    rosterOf(snapshot).map((e) => memberRowOf(e, org).joined),
    [2022, null],
    "the Members row carries the same year",
  );
  const since = Object.fromEntries(recordsOf(snapshot).map((r) => [r.id, r.since]));
  assert.deepEqual(since, { [STORED]: 2022, [NOT_STORED]: null }, "the member panel's record carries the same year");
});

test("the stored join day reads as a year, and an empty or unreadable one as none", () => {
  assert.equal(joinedYearOf("2022-11-15"), 2022);
  assert.equal(joinedYearOf(null), null);
  assert.equal(joinedYearOf("not a day"), null);
});

test("the member panel's header line names the join year only when one is stored", () => {
  const places: PersonPlace[] = [{ title: "Mission Analysis Lead", unit: "Operations · Mission Analysis", code: "MA", tag: "lead" }];
  assert.equal(placeHeaderLine(places, 2022), "Mission Analysis Lead · member since 2022");
  assert.equal(placeHeaderLine(places, null), "Mission Analysis Lead");
});

test("Move to alumni's years open from the join year, and empty for the lead to fill without one", () => {
  assert.equal(departureYearsOf(2022, 2026), "2022 – 2026");
  assert.equal(departureYearsOf(2026, 2026), "2026");
  assert.equal(departureYearsOf(null, 2026), "");
});
