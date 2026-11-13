import assert from "node:assert/strict";
import { test } from "node:test";
import type { TeamPerson } from "./division-edit";
import { headsAfterMove, moveTargetsOf, ONLY_TEAM_MOVES_HEADS, planMove, titleOnMove, type HeadRow, type MoveRecord, type MoveRequest, type MoveTo } from "./member-move";
import { isDivisionRole, membershipsOfRoles, roleBeyondDivisions, type OrgChart, type RoleSeat, type TeamActor } from "./team";

// The title box of a move (issue #777): Edit details and the Team tree's
// "Move to…" never carry the old unit's title into the new one.

const firmware: MoveTo = { kind: "division", divisionId: 7, as: "member" };
const firmwareLead: MoveTo = { kind: "division", divisionId: 7, as: "lead" };
const engines: MoveTo = { kind: "division", divisionId: 8, as: "member" };
const avionics: MoveTo = { kind: "head", departmentId: 3 };

test("a head of Propulsion moved to Firmware as a member, with nothing typed, carries no title there", () => {
  assert.equal(titleOnMove({ current: "Head of Propulsion", stored: "Head of Propulsion", from: null, to: firmware }), "");
});

test("each new unit empties the box, and back where they are shows the stored title again", () => {
  assert.equal(titleOnMove({ current: "CAD Engineer", stored: "CAD Engineer", from: null, to: firmware }), "");
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: engines }), "");
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: avionics }), "");
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: null }), "CAD Engineer");
  assert.equal(titleOnMove({ current: "", stored: null, from: firmware, to: null }), "");
});

test("lead or member in the one new division keeps what the editor typed", () => {
  assert.equal(titleOnMove({ current: "Firmware Engineer", stored: "CAD Engineer", from: firmware, to: firmwareLead }), "Firmware Engineer");
});

// Seats on a move (issue #841, after the Owner decision on #837): one person
// may hold several seats, so a move refuses only the very seat being filled.

const org: OrgChart = {
  departments: [
    { id: 1, name: "Propulsion", kind: "technical" },
    { id: 2, name: "Avionics", kind: "technical" },
    { id: 3, name: "Recovery", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Engines", departmentId: 1 },
    { id: 11, name: "Tanks", departmentId: 1 },
    { id: 20, name: "Firmware", departmentId: 2 },
    { id: 30, name: "Parachutes", departmentId: 3 },
  ],
};
const team: TeamActor = { kind: "team" };

type Row = RoleSeat & { readonly memberId: number };
const row = (id: number, memberId: number, type: RoleSeat["type"], at: { departmentId?: number; divisionId?: number }): Row => ({
  id,
  memberId,
  type,
  departmentId: at.departmentId ?? null,
  divisionId: at.divisionId ?? null,
  title: "",
  since: "2025-10-01",
  fullAccess: null,
});

// Ada heads Propulsion, is in Engines, and holds a team-level seat. Bruno is in
// Tanks and heads Recovery. Carla heads Avionics. Dario is in Tanks and holds
// an advisor role on Recovery.
const rows: readonly Row[] = [
  row(101, 1, "head", { departmentId: 1 }),
  row(102, 1, "core", { divisionId: 10 }),
  row(103, 1, "core", {}),
  row(201, 2, "core", { divisionId: 11 }),
  row(202, 2, "head", { departmentId: 3 }),
  row(301, 3, "head", { departmentId: 2 }),
  row(401, 4, "core", { divisionId: 11 }),
  row(402, 4, "advisor", { departmentId: 3 }),
];
const names: Record<number, string> = { 1: "Ada", 2: "Bruno", 3: "Carla", 4: "Dario" };
const rowsOf = (memberId: number) => rows.filter((r) => r.memberId === memberId);
const people: readonly TeamPerson[] = [1, 2, 3, 4].map((id) => ({
  id,
  name: names[id],
  emails: [],
  memberships: membershipsOfRoles(rowsOf(id).filter(isDivisionRole)),
  beyond: rowsOf(id).flatMap((r) => roleBeyondDivisions(r, org) ?? []),
}));
const heads: readonly HeadRow[] = rows.filter((r) => r.type === "head");

const plan = (request: Partial<MoveRequest> & Pick<MoveRequest, "personId" | "from" | "to">, actor: TeamActor = team) =>
  planMove({ actor, org, viewerId: 99, request: { title: "", replaced: null, replacing: null, successor: null, ...request }, roles: rowsOf(request.personId), heads, team: people });

const fromPropulsion = { kind: "head", departmentId: 1 } as const;

test("a head who also holds a team-level seat is moved to head another department, and keeps the seat", () => {
  const moved = plan({ personId: 1, from: fromPropulsion, to: { kind: "head", departmentId: 2 }, replaced: "advisor" });
  assert.ok(moved.ok, moved.ok ? "" : moved.error);
  assert.deepEqual(moved.value.end, [101]);
  assert.deepEqual(moved.value.start, { kind: "head", departmentId: 2, title: "Head of Avionics", seat: null });
  assert.equal(moved.value.replaced?.memberId, 3);
  assert.deepEqual(moved.value.replaced?.rows, [301]);
});

test("a member who holds an advisor role is made head of a department, and its head steps down as picked", () => {
  const moved = plan({ personId: 4, from: { kind: "division", divisionId: 11 }, to: { kind: "head", departmentId: 1 }, replaced: "advisor" });
  assert.ok(moved.ok, moved.ok ? "" : moved.error);
  assert.deepEqual(moved.value.end, [401]);
  assert.equal(moved.value.replaced?.memberId, 1);
});

test("made head of a department with two heads, they replace only the head picked; the other head stays (issue #872)", () => {
  // Bruno co-heads Avionics beside Carla here.
  const coHeads: readonly HeadRow[] = [...heads, row(203, 2, "head", { departmentId: 2 })];
  const moveTo = (replacing: number | null) =>
    planMove({
      actor: team,
      org,
      viewerId: 99,
      request: { personId: 4, from: { kind: "division", divisionId: 11 }, to: { kind: "head", departmentId: 2 }, title: "", replaced: "advisor", replacing, successor: null },
      roles: rowsOf(4),
      heads: coHeads,
      team: people,
    });
  const moved = moveTo(3);
  assert.ok(moved.ok, moved.ok ? "" : moved.error);
  assert.equal(moved.value.replaced?.memberId, 3);
  assert.deepEqual(moved.value.replaced?.rows, [301], "Bruno's head row stays");
  const unpicked = moveTo(null);
  assert.equal(unpicked.ok ? "accepted" : unpicked.error, "Pick which head the new head replaces.");
});

test("a successor who heads another department is picked and accepted, and keeps that headship", () => {
  const moved = plan({ personId: 1, from: fromPropulsion, to: { kind: "division", divisionId: 20, as: "member" }, successor: 2 });
  assert.ok(moved.ok, moved.ok ? "" : moved.error);
  assert.deepEqual(moved.value.successor, { memberId: 2, departmentId: 1, title: "Head of Propulsion", seat: null });
  assert.deepEqual(moved.value.end, [101]);
  assert.deepEqual(moved.value.newLeads, [2]);
});

test("the same-seat and scope refusals stay", () => {
  const refused = (moved: ReturnType<typeof plan>) => (moved.ok ? "accepted" : moved.error);
  assert.equal(refused(plan({ personId: 1, from: fromPropulsion, to: { kind: "head", departmentId: 1 } })), "Ada already heads Propulsion.");
  assert.equal(refused(plan({ personId: 2, from: { kind: "division", divisionId: 11 }, to: { kind: "head", departmentId: 3 } })), "Bruno already heads Recovery.");
  const toFirmware = { kind: "division", divisionId: 20, as: "member" } as const;
  assert.equal(refused(plan({ personId: 1, from: fromPropulsion, to: toFirmware, successor: 1 })), "Pick the new head from the people in Propulsion.");
  assert.equal(refused(plan({ personId: 1, from: fromPropulsion, to: toFirmware, successor: 3 })), "Pick the new head from the people in Propulsion.");
  assert.equal(refused(plan({ personId: 1, from: fromPropulsion, to: { kind: "head", departmentId: 2 } })), "Choose what happens to Carla: Become an advisor or Leave the team.");
  const departmentHead: TeamActor = { kind: "head", departmentIds: [1, 2] };
  assert.equal(refused(plan({ personId: 1, from: fromPropulsion, to: toFirmware }, departmentHead)), ONLY_TEAM_MOVES_HEADS);
  assert.equal(
    refused(plan({ personId: 4, from: { kind: "division", divisionId: 11 }, to: { kind: "head", departmentId: 2 }, replaced: "advisor" }, departmentHead)),
    ONLY_TEAM_MOVES_HEADS,
  );
});

test("the head a move replaces cannot both leave the team and take over the department the mover leaves", () => {
  // Carla, who heads Avionics, is also in Engines here.
  const carla: TeamPerson = { ...people[2], memberships: membershipsOfRoles([row(302, 3, "core", { divisionId: 10 })]) };
  const moved = planMove({
    actor: team,
    org,
    viewerId: 99,
    request: { personId: 1, from: fromPropulsion, to: { kind: "head", departmentId: 2 }, title: "", replaced: "leave", replacing: null, successor: 3 },
    roles: rowsOf(1),
    heads,
    team: [people[0], people[1], carla, people[3]],
  });
  assert.equal(moved.ok ? "accepted" : moved.error, "Carla cannot leave the team and head Propulsion. Pick another new head, or choose Become an advisor.");
});

test("Pick a new head lists seated people in the department's divisions, never its own head", () => {
  const record = (id: number): MoveRecord => {
    const person = people.find((p) => p.id === id)!;
    return { id, name: person.name, photoUrl: null, memberships: person.memberships, beyondDivisions: person.beyond };
  };
  const propulsion = moveTargetsOf([1, 2, 3, 4].map(record), org, team).find((d) => d.id === 1);
  assert.deepEqual(
    propulsion?.heads.map((h) => h.id),
    [1],
  );
  assert.deepEqual(
    propulsion?.successors.map((p) => p.name),
    ["Bruno", "Dario"],
  );
});

// Who heads the department a head leaves (issue #879): the confirm says it
// will have no head only when they are its last head.

test("a last head leaves their department with no head; with a co-head, the co-head stays", () => {
  const targets = (records: readonly MoveRecord[]) => moveTargetsOf(records, org, team);
  const record = (person: TeamPerson): MoveRecord => ({ id: person.id, name: person.name, photoUrl: null, memberships: person.memberships, beyondDivisions: person.beyond });
  assert.deepEqual(headsAfterMove(targets(people.map(record)), 1, 1), { kind: "none" });
  // Bruno co-heads Propulsion beside Ada here.
  const bruno: TeamPerson = { ...people[1], beyond: [...rowsOf(2), row(204, 2, "head", { departmentId: 1 })].flatMap((r) => roleBeyondDivisions(r, org) ?? []) };
  const coHeaded = targets([people[0], bruno, people[2], people[3]].map(record));
  assert.deepEqual(headsAfterMove(coHeaded, 1, 1), { kind: "staying", heads: [{ id: 2, name: "Bruno", photoUrl: null }] });
  assert.deepEqual(headsAfterMove(coHeaded, 1, 2), { kind: "staying", heads: [{ id: 1, name: "Ada", photoUrl: null }] });
});
