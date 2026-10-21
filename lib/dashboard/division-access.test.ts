import assert from "node:assert/strict";
import { test } from "node:test";
import { maySiteContent } from "@/lib/content/gate";
import { canReach } from "./access";
import {
  accessByPerson,
  canGiveApproveOrders,
  checkRemoveAllAccess,
  checkRemoveGrant,
  checkSaveAccess,
  departmentOfPlace,
  grantRowOf,
  heldLines,
  NO_APPROVE_ORDERS,
  placeKey,
  placesOf,
  roleDivision,
  SEAT_LABELS,
  WHOLE_TEAM_PLACE,
  type AccessGrant,
  type AccessPerson,
  type AccessPlace,
  type AccessUnit,
  type ApproveOrdersAccess,
  type HeldAccess,
} from "./division-access";
import { unitRowsOf, viewerStandingOf, viewerUnitsOf, type FullAccessSeat, type ScopeTarget } from "./viewer";

const msa = { id: 1, name: "Mission Analysis Division" };
const aoa = { id: 2, name: "Optimization and Analysis Division" };
const aerodynamics = { id: 1, name: "Aerodynamics" };

const pietro: AccessPerson = { id: 6, name: "Pietro Ricci", standing: "member", division: msa };
const sofia: AccessPerson = { id: 3, name: "Sofia Neri", standing: "member", division: msa };
const coLead: AccessPerson = { id: 9, name: "Luca Bianchi", standing: "lead", division: msa };
const people = [pietro, sofia, coLead];

const inMsa: AccessPlace = { kind: "division", division: msa };

function grant(id: number, person: AccessPerson, target: AccessGrant["target"], level: AccessGrant["level"], place = inMsa): AccessGrant {
  return { id, person, place, target, level, givenBy: "You", givenOn: "2026-10-02" };
}

const held: HeldAccess[] = [
  { target: "applications", level: "edit" },
  { target: "members", level: "view" },
  { target: "orders", level: "edit" },
];

const divisionUnit: AccessUnit = { kind: "division", divisions: [{ division: msa, held }] };

const lead = (grants: AccessGrant[] = []) => ({ unit: divisionUnit, people, grants, approveOrders: NO_APPROVE_ORDERS });

test("one Save gives one person several areas, each at its own level", () => {
  assert.deepEqual(checkSaveAccess(lead(), { personId: 6, areas: { applications: "edit", members: "view", orders: "view" } }), {
    ok: true,
    value: {
      personId: 6,
      place: inMsa,
      changes: [
        { kind: "add", target: "applications", to: "edit" },
        { kind: "add", target: "members", to: "view" },
        { kind: "add", target: "orders", to: "view" },
      ],
      approveOrders: null,
    },
  });
});

test("a lead cannot give an area they do not hold, or a level above their own", () => {
  for (const areas of [{ positions: "view" }, { members: "edit" }, { applications: "edit", members: "edit" }]) {
    assert.equal(checkSaveAccess(lead(), { personId: 6, areas }).ok, false, JSON.stringify(areas));
  }
});

test("an edit writes only the difference: adds, level changes and removals", () => {
  const access = lead([grant(1, sofia, "applications", "view"), grant(2, sofia, "members", "view")]);
  assert.deepEqual(checkSaveAccess(access, { personId: 3, areas: { applications: "edit", orders: "edit" } }), {
    ok: true,
    value: {
      personId: 3,
      place: inMsa,
      changes: [
        { kind: "change", target: "applications", from: "view", to: "edit" },
        { kind: "remove", target: "members", from: "view" },
        { kind: "add", target: "orders", to: "edit" },
      ],
      approveOrders: null,
    },
  });
});

test("an edit never touches an area held above the lead, nor another lead's access", () => {
  const access = lead([grant(1, pietro, "members", "edit"), grant(2, coLead, "applications", "view")]);
  // Downgrading Pietro's edit on Members, when the lead holds only view there.
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { members: "view" } }).ok, false);
  // Leaving Pietro's Members untouched while adding Orders is fine.
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { members: "edit", orders: "view" } }).ok, true);
  assert.equal(checkSaveAccess(access, { personId: 9, areas: { applications: "edit" } }).ok, false);
});

test("a Save goes only to someone in the division, in the division, with at least one area", () => {
  assert.equal(checkSaveAccess(lead(), { personId: 99, areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, areas: {} }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: "6", areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, areas: { orders: "decide" } }).ok, false);
  // A lead has no department-wide place and no other division.
  assert.equal(checkSaveAccess(lead(), { personId: 6, where: "department-1", areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, where: 2, areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, where: 1, areas: { orders: "view" } }).ok, true);
});

test("Remove all access removes every area, only within the lead's limit", () => {
  const sofiaGrants = [grant(1, sofia, "applications", "edit"), grant(2, sofia, "orders", "view")];
  assert.deepEqual(checkRemoveAllAccess(lead(sofiaGrants), 3), {
    ok: true,
    value: [
      {
        personId: 3,
        place: inMsa,
        changes: [
          { kind: "remove", target: "applications", from: "edit" },
          { kind: "remove", target: "orders", from: "view" },
        ],
        approveOrders: null,
      },
    ],
  });
  const above = [...sofiaGrants, grant(3, sofia, "positions", "view")];
  assert.equal(checkRemoveAllAccess(lead(above), 3).ok, false, "Positions is not the lead's");
});

test("the table shows one row per person, areas in the order given, with the latest giver", () => {
  const rows = accessByPerson([
    { ...grant(5, sofia, "members", "view"), givenOn: "2026-10-04" },
    grant(2, pietro, "positions", "view"),
    grant(1, sofia, "applications", "edit"),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.person.name, r.grants.map((g) => g.target), r.givenOn]),
    [
      ["Sofia Neri", ["applications", "members"], "2026-10-04"],
      ["Pietro Ricci", ["positions"], "2026-10-02"],
    ],
  );
});

// A department head (boards 65 and 65b, issue #230) ------------------------------

const departmentUnit: AccessUnit = { kind: "department", department: aerodynamics, divisions: [msa, aoa] };
const wholeDepartment: AccessPlace = { kind: "department", department: aerodynamics };
const inAoa: AccessPlace = { kind: "division", division: aoa };
const luca: AccessPerson = { id: 4, name: "Luca Marino", standing: "member", division: aoa };
const laura: AccessPerson = { id: 20, name: "Laura Greco", standing: "lead", division: aoa };
const marco: AccessPerson = { id: 2, name: "Marco Bianchi", standing: "lead", division: msa };
const headPeople = [sofia, luca, laura, marco];
const head = (grants: AccessGrant[] = []) => ({
  unit: departmentUnit,
  people: headPeople,
  grants,
  approveOrders: NO_APPROVE_ORDERS,
});

test("a head gives access in the whole department or in one of its divisions", () => {
  assert.deepEqual(
    placesOf(departmentUnit).map((p) => (p.kind === "division" ? p.division.id : p.kind)),
    ["department", 1, 2],
  );
  const whole = checkSaveAccess(head(), { personId: 3, where: "department-1", areas: { members: "view" } });
  assert.deepEqual(whole, { ok: true, value: { personId: 3, place: wholeDepartment, changes: [{ kind: "add", target: "members", to: "view" }], approveOrders: null } });
  const one = checkSaveAccess(head(), { personId: 4, where: 2, areas: { applications: "edit" } });
  assert.deepEqual(one, { ok: true, value: { personId: 4, place: inAoa, changes: [{ kind: "add", target: "applications", to: "edit" }], approveOrders: null } });
  // With no place sent, Give access starts on the whole department.
  const home = checkSaveAccess(head(), { personId: 3, areas: { orders: "view" } });
  assert.ok(home.ok && home.value.place.kind === "department");
});

test("a head gives every unit area their role holds, never Alumni, and only inside their department", () => {
  assert.equal(checkSaveAccess(head(), { personId: 3, where: "department-1", areas: { members: "edit", orders: "view" } }).ok, true);
  assert.equal(checkSaveAccess(head(), { personId: 3, where: "department-1", areas: { alumni: "view" } }).ok, false);
  // A division of another department, and a person from another department, are refused.
  assert.equal(checkSaveAccess(head(), { personId: 3, where: 4, areas: { members: "view" } }).ok, false);
  assert.equal(checkSaveAccess(head(), { personId: 44, where: "department-1", areas: { members: "view" } }).ok, false);
});

test("a lead's role access cannot be changed or removed by a head", () => {
  assert.equal(checkSaveAccess(head(), { personId: 20, where: 2, areas: { members: "view" } }).ok, false);
  const marcosGrant = grant(9, marco, "orders", "edit");
  assert.equal(checkRemoveAllAccess(head([marcosGrant]), 2).ok, false);
});

test("a grant in one place leaves the same area in another place alone; Remove all takes every place", () => {
  const grants = [grant(1, sofia, "members", "view", wholeDepartment), grant(2, sofia, "positions", "edit", inMsa)];
  const msaOnly = checkSaveAccess(head(grants), { personId: 3, where: 1, areas: { positions: "view" } });
  assert.deepEqual(msaOnly, {
    ok: true,
    value: { personId: 3, place: inMsa, changes: [{ kind: "change", target: "positions", from: "edit", to: "view" }], approveOrders: null },
  });
  const removed = checkRemoveAllAccess(head(grants), 3);
  assert.ok(removed.ok);
  if (removed.ok) {
    assert.deepEqual(
      removed.value.map((w) => [w.place.kind, w.changes.map((c) => c.target)]),
      [
        ["department", ["members"]],
        ["division", ["positions"]],
      ],
    );
  }
});

// Remove on one grant (issue #483) -----------------------------------------------

test("removing one of two grants in two places takes only that grant; the other place keeps its own", () => {
  const grants = [grant(1, sofia, "members", "view", wholeDepartment), grant(2, sofia, "positions", "edit", inMsa)];
  const removed = checkRemoveGrant(head(grants), { personId: 3, where: 1, target: "positions" });
  assert.deepEqual(removed, {
    ok: true,
    value: { personId: 3, place: inMsa, changes: [{ kind: "remove", target: "positions", from: "edit" }], approveOrders: null },
  });
  // The whole department's Members is no part of the write.
  const other = checkRemoveGrant(head(grants), { personId: 3, where: "department-1", target: "members" });
  assert.deepEqual(other, {
    ok: true,
    value: { personId: 3, place: wholeDepartment, changes: [{ kind: "remove", target: "members", from: "view" }], approveOrders: null },
  });
  // Two areas in one place: the other area there stays.
  const twoAreas = [grant(1, sofia, "applications", "edit"), grant(2, sofia, "orders", "view")];
  const one = checkRemoveGrant(lead(twoAreas), { personId: 3, where: 1, target: "orders" });
  assert.deepEqual(one.ok && one.value.changes, [{ kind: "remove", target: "orders", from: "view" }]);
});

test("Remove on one grant is refused outside the viewer's reach", () => {
  const grants = [grant(1, pietro, "positions", "view"), grant(2, pietro, "members", "edit"), grant(3, pietro, "orders", "view"), grant(4, coLead, "applications", "view")];
  const access = lead(grants);
  // An area the lead does not hold, and one held above the lead's own level.
  assert.equal(checkRemoveGrant(access, { personId: 6, where: 1, target: "positions" }).ok, false, "Positions is not the lead's");
  assert.equal(checkRemoveGrant(access, { personId: 6, where: 1, target: "members" }).ok, false, "Members is held at edit, the lead only views");
  // A place outside the lead's unit, and someone outside it.
  assert.equal(checkRemoveGrant(access, { personId: 6, where: 2, target: "orders" }).ok, false, "a division the lead does not lead");
  assert.equal(checkRemoveGrant(access, { personId: 6, where: "department-1", target: "orders" }).ok, false, "no department-wide place on a lead's page");
  assert.equal(checkRemoveGrant(access, { personId: 99, where: 1, target: "orders" }).ok, false, "someone outside the division");
  // A lead's access, and an area the person does not hold there.
  assert.equal(checkRemoveGrant(access, { personId: 9, where: 1, target: "applications" }).ok, false, "another lead's access");
  assert.equal(checkRemoveGrant(access, { personId: 6, where: 1, target: "applications" }).ok, false, "Pietro holds no Applications");
  // A malformed removal, and the one within reach.
  assert.equal(checkRemoveGrant(access, { personId: 6, where: 1, target: "logs" }).ok, false);
  assert.equal(checkRemoveGrant(access, { personId: "6", where: 1, target: "orders" }).ok, false);
  assert.equal(checkRemoveGrant(access, { personId: 6, where: 1, target: "orders" }).ok, true);
});

// Full access across the whole team (issue #238) ---------------------------------

const structures = { id: 2, name: "Structures" };
const dm = { id: 3, name: "Design & Manufacturing Division" };
const teamUnit: AccessUnit = {
  kind: "team",
  departments: [
    { department: aerodynamics, divisions: [msa, aoa] },
    { department: structures, divisions: [dm] },
  ],
};
const giulio: AccessPerson = { id: 31, name: "Giulio Russo", standing: "member", division: dm };
const team = (grants: AccessGrant[] = [], approveOrders: ApproveOrdersAccess = NO_APPROVE_ORDERS) => ({
  unit: teamUnit,
  people: [...headPeople, giulio],
  grants,
  approveOrders,
});

test("full access gives access in every department and every division of the team", () => {
  assert.deepEqual(placesOf(teamUnit).map(placeKey), ["team", "department-1", 1, 2, "department-2", 3]);
  const otherDepartment = checkSaveAccess(team(), { personId: 31, where: "department-2", areas: { orders: "edit" } });
  assert.deepEqual(otherDepartment, {
    ok: true,
    value: { personId: 31, place: { kind: "department", department: structures }, changes: [{ kind: "add", target: "orders", to: "edit" }], approveOrders: null },
  });
  assert.equal(checkSaveAccess(team(), { personId: 4, where: 3, areas: { members: "edit" } }).ok, true);
  // A place outside the team, and a lead's role access, are still refused.
  assert.equal(checkSaveAccess(team(), { personId: 4, where: 99, areas: { members: "view" } }).ok, false);
  assert.equal(checkSaveAccess(team(), { personId: 20, where: 2, areas: { members: "view" } }).ok, false);
  assert.deepEqual(departmentOfPlace(teamUnit, { kind: "division", division: dm }), structures);
});

// The team leader's Access page (boards 71 and 71b, issue #247) -----------------

/** The team leader's page: they alone give "Approve orders". */
const teamLeaderGives: ApproveOrdersAccess = { canGive: true, yours: true, holders: [] };
/** The operations lead's or the IT lead's page: every other access, but not "Approve orders". */
const fullAccessOnly: ApproveOrdersAccess = { canGive: false, yours: false, holders: [] };

test("only the team leader sees and gives the Approve orders checkbox (board 71b)", () => {
  const seats: Readonly<Record<FullAccessSeat, boolean>> = {
    "team-leader": true,
    "operations-lead": false,
    "it-lead": false,
    "project-manager": false,
    "chief-engineer": false,
  };
  for (const [seat, gives] of Object.entries(seats) as [FullAccessSeat, boolean][]) assert.equal(canGiveApproveOrders(seat), gives, seat);
  assert.equal(canGiveApproveOrders(null), false);
});

test("the Full access tab labels the Project Manager's and the Chief Engineer's seats by their titles (issue #485)", () => {
  assert.equal(SEAT_LABELS["project-manager"], "Project Manager");
  assert.equal(SEAT_LABELS["chief-engineer"], "Chief Engineer");
});

test("the server refuses Approve orders from the operations lead and the IT lead, and takes it from the team leader", () => {
  const give = { personId: 31, where: "team", areas: {}, approveOrders: true };
  // The operations lead and the IT lead hold the same page; neither gives it, alone or with an area.
  assert.deepEqual(checkSaveAccess(team([], fullAccessOnly), give), { ok: false, error: "Only the team leader gives or removes Approve orders." });
  assert.equal(checkSaveAccess(team([], fullAccessOnly), { ...give, areas: { orders: "view" } }).ok, false);
  const given = checkSaveAccess(team([], teamLeaderGives), give);
  assert.deepEqual(given, { ok: true, value: { personId: 31, place: WHOLE_TEAM_PLACE, changes: [], approveOrders: { personId: 31, holds: true } } });
  // A holder's areas change without touching it; only the team leader removes it.
  const holding: ApproveOrdersAccess = { ...fullAccessOnly, holders: [{ person: giulio, givenBy: "Alessandro Greco", givenOn: "2026-10-06" }] };
  assert.equal(checkSaveAccess(team([], holding), { personId: 31, where: "team", areas: { members: "view" } }).ok, true);
  assert.equal(checkSaveAccess(team([], holding), { personId: 31, where: "team", areas: { members: "view" }, approveOrders: false }).ok, false);
  assert.equal(checkRemoveAllAccess(team([], holding), 31).ok, false);
  const removed = checkRemoveAllAccess(team([], { ...holding, canGive: true }), 31);
  assert.ok(removed.ok && removed.value.some((w) => w.approveOrders?.holds === false));
});

test("Give access offers the whole team, one department or one division, every area at view or edit", () => {
  for (const where of ["team", "department-2", 3] as const) {
    for (const target of ["positions", "applications", "members", "orders"] as const) {
      for (const level of ["view", "edit"] as const) {
        assert.equal(checkSaveAccess(team(), { personId: 31, where, areas: { [target]: level } }).ok, true, `${where} ${target} ${level}`);
      }
    }
  }
  const wholeTeam = checkSaveAccess(team(), { personId: 31, where: "team", areas: { positions: "view", alumni: "edit", orders: "edit" } });
  assert.deepEqual(wholeTeam.ok && wholeTeam.value.changes.map((c) => c.target), ["positions", "alumni", "orders"]);
});

test("the operations lead and the IT lead give every area but Approve orders, Alumni only across the whole team", () => {
  for (const level of ["view", "edit"] as const) {
    assert.equal(checkSaveAccess(team([], fullAccessOnly), { personId: 31, where: "team", areas: { alumni: level } }).ok, true, level);
  }
  // Alumni has no unit: it is never given in one department or division.
  assert.equal(checkSaveAccess(team(), { personId: 31, where: "department-2", areas: { alumni: "view" } }).ok, false);
  assert.equal(checkSaveAccess(team(), { personId: 31, where: 3, areas: { alumni: "edit" } }).ok, false);
  // A head holds no Alumni, so never gives it.
  assert.equal(checkSaveAccess(head(), { personId: 3, where: "department-1", areas: { alumni: "view" } }).ok, false);
});

test("the Activity log is never offered: it is no area of Give access", () => {
  assert.equal(checkSaveAccess(team([], teamLeaderGives), { personId: 31, where: "team", areas: { logs: "view" } }).ok, false);
  assert.equal(checkSaveAccess(team([], teamLeaderGives), { personId: 31, where: "team", areas: { "activity-log": "edit" } }).ok, false);
});

test("an Alumni grant gives the person Alumni page reach, and no content editor (issue #504)", () => {
  const row = grantRowOf(WHOLE_TEAM_PLACE, "alumni");
  assert.deepEqual(row, { scope: "website", target: "all", deptId: null, divisionId: null });
  const member = { type: null, divisionId: 1, fullAccess: null } as const;
  assert.equal(canReach(viewerStandingOf({ scopes: [], activeRoles: [member] }), "alumni"), false);
  const holder = viewerStandingOf({ scopes: [{ scope: row.scope, target: "all", level: "view" }], activeRoles: [member] });
  assert.equal(canReach(holder, "alumni"), true);
  assert.equal(maySiteContent(holder), false);
});

// Content (Owner decision, 2026-10-21, issue #504) ------------------------------

test("full access gives Content across the whole team at Can edit only, never in a department or a division", () => {
  const given = checkSaveAccess(team(), { personId: 31, where: "team", areas: { content: "edit" } });
  assert.deepEqual(given, { ok: true, value: { personId: 31, place: WHOLE_TEAM_PLACE, changes: [{ kind: "add", target: "content", to: "edit" }], approveOrders: null } });
  assert.deepEqual(checkSaveAccess(team(), { personId: 31, where: "team", areas: { content: "view" } }), { ok: false, error: "Content access is given at Can edit only." });
  for (const where of ["department-1", "department-2", 3] as const) {
    assert.deepEqual(checkSaveAccess(team(), { personId: 31, where, areas: { content: "edit" } }), { ok: false, error: "Content access is given to the whole team only." }, String(where));
  }
  // It follows Alumni in the drawer's order.
  const both = checkSaveAccess(team(), { personId: 31, where: "team", areas: { orders: "view", content: "edit", alumni: "view" } });
  assert.deepEqual(both.ok && both.value.changes.map((c) => c.target), ["alumni", "content", "orders"]);
});

test("a lead or head who holds neither full access nor Content cannot give, change or remove Content", () => {
  const held = grant(80, sofia, "content", "edit", WHOLE_TEAM_PLACE);
  for (const [who, facts] of [["lead", lead([held])], ["head", head([held])]] as const) {
    assert.equal(placesOf(facts.unit).some((p) => p.kind === "team"), false, who);
    assert.equal(checkSaveAccess(facts, { personId: 3, where: "team", areas: { content: "edit" } }).ok, false, `${who}: give`);
    assert.equal(checkRemoveGrant(facts, { personId: 3, where: "team", target: "content" }).ok, false, `${who}: remove`);
  }
  assert.equal(checkSaveAccess(lead(), { personId: 3, areas: { content: "edit" } }).ok, false, "lead: in the division");
  assert.equal(checkSaveAccess(head(), { personId: 3, where: "department-1", areas: { content: "edit" } }).ok, false, "head: in the department");
});

test("a lead or head who holds Content gives, keeps and removes it across the whole team, and nothing else there", () => {
  const leadWithContent = (grants: AccessGrant[] = []) => ({ ...lead(grants), unit: { ...divisionUnit, content: true } as AccessUnit });
  const headWithContent = (grants: AccessGrant[] = []) => ({ ...head(grants), unit: { ...departmentUnit, content: true } as AccessUnit });
  assert.deepEqual(placesOf(leadWithContent().unit).map(placeKey), [1, "team"]);
  assert.deepEqual(placesOf(headWithContent().unit).map(placeKey), ["department-1", 1, 2, "team"]);
  assert.deepEqual(heldLines(leadWithContent().unit).at(-1), { where: "the whole team", held: [{ target: "content", level: "edit" }] });
  for (const [who, facts] of [["lead", leadWithContent], ["head", headWithContent]] as const) {
    const given = checkSaveAccess(facts(), { personId: 3, where: "team", areas: { content: "edit" } });
    assert.deepEqual(given.ok && given.value.changes, [{ kind: "add", target: "content", to: "edit" }], `${who}: give`);
    // The whole team holds Content alone for them: no unit area, no Alumni.
    assert.equal(checkSaveAccess(facts(), { personId: 3, where: "team", areas: { positions: "view" } }).ok, false, `${who}: positions`);
    assert.equal(checkSaveAccess(facts(), { personId: 3, where: "team", areas: { alumni: "edit" } }).ok, false, `${who}: alumni`);
    const holding = [grant(81, sofia, "content", "edit", WHOLE_TEAM_PLACE)];
    assert.equal(checkRemoveGrant(facts(holding), { personId: 3, where: "team", target: "content" }).ok, true, `${who}: remove`);
    const all = checkRemoveAllAccess(facts(holding), 3);
    assert.ok(all.ok && all.value.some((w) => w.place.kind === "team" && w.changes.some((c) => c.kind === "remove" && c.target === "content")), `${who}: remove all`);
  }
  assert.equal(checkRemoveGrant(team([grant(82, giulio, "content", "edit", WHOLE_TEAM_PLACE)]), { personId: 31, where: "team", target: "content" }).ok, true, "full access removes it");
});

test("a Content grant is the website row on content: it opens the content editors, and never the Alumni page", () => {
  const row = grantRowOf(WHOLE_TEAM_PLACE, "content");
  assert.deepEqual(row, { scope: "website", target: "content", deptId: null, divisionId: null });
  const member = { type: null, divisionId: 1, fullAccess: null } as const;
  const holder = viewerStandingOf({ scopes: [{ scope: row.scope, target: row.target, level: "edit" }], activeRoles: [member] });
  assert.equal(maySiteContent(holder), true);
  for (const page of ["projects", "outreach", "partners", "faq", "team-page"] as const) assert.equal(canReach(holder, page), true, page);
  assert.equal(canReach(holder, "alumni"), false);
});

test("an area given across the whole team opens its pages in every open department", () => {
  const row = grantRowOf(WHOLE_TEAM_PLACE, "positions");
  assert.deepEqual(row, { scope: "team", target: "positions", deptId: null, divisionId: null });
  const units = unitRowsOf([{ scope: "team", target: "positions", level: "edit", divisionId: null, deptId: null }], [1, 2, 5]);
  assert.deepEqual(viewerUnitsOf(units, []).departmentIds, [1, 2, 5]);
  // Each department's row keeps the area and its level (issue #160).
  assert.deepEqual(units[0], { scope: "department", target: "positions", level: "edit", divisionId: null, deptId: 1 });
  // "Approve orders" is a team row too, in no unit: it opens no department's pages.
  assert.deepEqual(unitRowsOf([{ scope: "team", target: "approve_orders", level: "view", divisionId: null, deptId: null }], [1, 2]), [
    { scope: "team", target: "approve_orders", level: "view", divisionId: null, deptId: null },
  ]);
});

test("a member whose only access is \"Approve orders\" reaches the Orders page, and nothing else it adds (issue #270)", () => {
  const member = { type: null, divisionId: 1, fullAccess: null } as const;
  const standingFrom = (target: ScopeTarget) => {
    const units = unitRowsOf([{ scope: "team", target, level: "view", divisionId: null, deptId: null }], [1, 2]);
    return viewerStandingOf({ scopes: units, activeRoles: [member] });
  };
  const holder = standingFrom("approve_orders");
  assert.deepEqual(holder, { kind: "member", grantedAreas: [], siteContent: false, approveOrders: true });
  assert.equal(canReach(holder, "orders"), true);
  assert.equal(canReach(holder, "members"), false);
  // An area given across the whole team is no "Approve orders".
  assert.equal(standingFrom("positions").approveOrders, false);
  assert.equal(canReach(viewerStandingOf({ scopes: [], activeRoles: [member] }), "orders"), false);
});

test("a holder of Approve orders gets a row of their own, with the chip before their areas", () => {
  const holder = { person: giulio, givenBy: "You", givenOn: "2026-10-06" };
  const rows = accessByPerson([grant(7, sofia, "members", "view")], [holder]);
  assert.deepEqual(
    rows.map((r) => [r.person.name, r.approveOrders, r.grants.length, r.givenBy]),
    [
      ["Giulio Russo", true, 0, "You"],
      ["Sofia Neri", false, 1, "You"],
    ],
  );
});

// A lead of several divisions (issue #185) ---------------------------------------

test("a lead of two divisions gives access in the division of the person they edit, up to what they hold there", () => {
  const sara: AccessPerson = { id: 32, name: "Sara Fontana", standing: "member", division: aoa };
  const viewInAoa: HeldAccess[] = [{ target: "applications", level: "view" }];
  const twoDivisions: AccessUnit = { kind: "division", divisions: [{ division: msa, held }, { division: aoa, held: viewInAoa }] };
  const access = { unit: twoDivisions, people: [...people, sara], grants: [], approveOrders: NO_APPROVE_ORDERS };
  assert.deepEqual(placesOf(twoDivisions).map(placeKey), [1, 2]);

  // Left out, the place is the person's own division, with what the lead holds there.
  const given = checkSaveAccess(access, { personId: 32, areas: { applications: "view" } });
  assert.ok(given.ok && given.value.place.kind === "division" && given.value.place.division.id === 2);
  assert.equal(checkSaveAccess(access, { personId: 32, areas: { applications: "edit" } }).ok, false, "only view in Optimization and Analysis");
  assert.equal(checkSaveAccess(access, { personId: 6, where: 1, areas: { applications: "edit" } }).ok, true);
  // Another of the lead's divisions than the person's, a division they do not lead, a person in neither: refused.
  assert.equal(checkSaveAccess(access, { personId: 32, where: 1, areas: { applications: "view" } }).ok, false);
  assert.equal(checkSaveAccess(access, { personId: 6, where: 3, areas: { applications: "view" } }).ok, false);
  assert.equal(checkSaveAccess(access, { personId: 31, where: 2, areas: { applications: "view" } }).ok, false);

  // "Your access" reads one line per set of areas, naming the divisions that hold it.
  assert.deepEqual(heldLines(twoDivisions).map((l) => l.where), ["Mission Analysis Division", "Optimization and Analysis Division"]);
  const same: AccessUnit = { kind: "division", divisions: [{ division: msa, held }, { division: aoa, held }] };
  assert.deepEqual(heldLines(same).map((l) => l.where), ["Mission Analysis, Optimization and Analysis"]);
});

test("a lead of two divisions has a role row in each, each in its own division, not their primary one", () => {
  const marco: AccessPerson = { id: 2, name: "Marco Bianchi", standing: "lead", division: msa };
  assert.equal(roleDivision({ person: marco, place: { kind: "division", division: msa } }), msa);
  assert.equal(roleDivision({ person: marco, place: { kind: "division", division: aoa } }), aoa);
  // A head's role is in a department: the row stays with the person's own division, if any.
  assert.equal(roleDivision({ person: marco, place: { kind: "department", department: aerodynamics } }), msa);
});
