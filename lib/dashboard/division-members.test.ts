import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_MEMBER_DETAILS } from "./details";
import { addOutcome, checkAddMember, divisionMembers, headcountLine, lookupForAdd, type PersonRecord } from "./division-members";
import { membershipsOf, type OrgChart } from "./team";

// Issue #231: the division page's shapes and Add member's rules, as both
// data sources build them. Aerodynamics holds Mission Analysis (1) and
// Optimization (2); Structures holds Design & Manufacturing (3).
const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics" },
    { id: 2, name: "Structures" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

function record(id: number, name: string, list: [divisionId: number, role: "lead" | "member", since: string, title: string | null][]): PersonRecord {
  return {
    id,
    name,
    signInEmail: `${name.split(" ")[0].toLowerCase()}@gmail.com`,
    photoUrl: null,
    since: 2024,
    memberships: membershipsOf(list.map(([divisionId, role, since]) => ({ divisionId, role, since }))),
    beyondDivisions: [],
    titles: Object.fromEntries(list.map(([divisionId, , , title]) => [divisionId, title])),
    details: { ...NO_MEMBER_DETAILS, phone: "+39 349 778 0045" },
    nda: { signedOn: "2024-03-12", confirmedBy: "Marco Bianchi" },
  };
}

const records = [
  record(2, "Marco Bianchi", [[1, "lead", "2023-10-01", "Mission Analysis Lead"]]),
  record(16, "Davide Russo", [
    [3, "member", "2023-10-01", "CAD Engineer"],
    [1, "member", "2024-10-01", "Mission Analyst"],
  ]),
  record(20, "Paolo Conti", [[2, "lead", "2023-10-01", null]]),
];

test("a division's page lists its people with this division first, a code chip inside the department and the department's name outside it", () => {
  const page = divisionMembers({ records, org, divisionId: 1, actor: { kind: "lead", divisionIds: [1] }, selfId: 2, reach: [1], waiting: [], joining: [] })!;
  assert.deepEqual(page.people.map((p) => p.name), ["Marco Bianchi", "Davide Russo"], "leads first, and nobody from outside the division");
  const davide = page.people[1];
  assert.equal(davide.title, "Mission Analyst");
  assert.deepEqual(davide.divisions.map((d) => [d.name, d.sameDepartment, d.title]), [
    ["Mission Analysis", true, "Mission Analyst"],
    ["Design & Manufacturing", false, "CAD Engineer"],
  ]);
  assert.deepEqual(davide.chips.map((c) => [c.label, c.code]), [["MA", true], ["Structures", false]]);
  assert.equal(page.people[0].self, true);
  assert.equal(page.division.leadsHint, "Leads are changed by the Head of Aerodynamics");
  assert.equal(headcountLine({ people: page.people, waiting: [{ joinId: 1, email: "e@x.it", name: null, title: null, details: NO_MEMBER_DETAILS }] }), "1 lead, 3 members");
});

test("Add member: a team member joins at once with no second NDA; anyone else waits for Confirm NDA (#231)", () => {
  const inMission = membershipsOf([{ divisionId: 1, role: "member", since: "2024-10-01" }]);
  assert.deepEqual(addOutcome({ kind: "member", memberships: inMission }, 2), { kind: "joins" });
  assert.deepEqual(addOutcome({ kind: "member", memberships: inMission }, 1), { kind: "refused", reason: "They are already in this division." });
  assert.deepEqual(addOutcome({ kind: "not-on-team" }, 1), { kind: "waits-for-nda" });
  assert.deepEqual(addOutcome({ kind: "waiting" }, 1), { kind: "refused", reason: "They are already waiting for their NDA here." });
});

test("an added email is kept as the sign-in account will carry it, so their first sign-in with it finds them", () => {
  const checked = checkAddMember({ kind: "email", divisionId: 1, email: "  Elena.Marino@Studenti.Polito.it ", firstName: "Elena", lastName: "Marino", title: "", details: null });
  assert.ok(checked.ok);
  assert.equal(checked.value.kind === "email" && checked.value.email, "elena.marino@studenti.polito.it");
  assert.equal(checked.value.title, null);
  assert.equal(checkAddMember({ kind: "email", divisionId: 1, email: "not an email", firstName: "", lastName: "", title: "", details: null }).ok, false);
});

test("Add member's field finds a member by name or by either email, and says when an email is new or already waiting", () => {
  const team = records.map((r) => ({ id: r.id, name: r.name, emails: [r.signInEmail, `${r.name[0].toLowerCase()}.x@politorocketteam.it`], memberships: r.memberships }));
  const byName = lookupForAdd("paolo", team, [], 1, org);
  assert.ok(byName.kind === "people" && byName.people.length === 1 && byName.people[0].here === false);
  const byEmail = lookupForAdd("DAVIDE@gmail.com", team, [], 1, org);
  assert.ok(byEmail.kind === "people" && byEmail.people[0].id === 16 && byEmail.people[0].here === true);
  assert.deepEqual(lookupForAdd("new.person@studenti.polito.it", team, [], 1, org), { kind: "new-email", email: "new.person@studenti.polito.it" });
  assert.deepEqual(lookupForAdd("Elena@x.it", team, ["elena@x.it"], 1, org), { kind: "waiting", email: "elena@x.it" });
  assert.deepEqual(lookupForAdd("p", team, [], 1, org), { kind: "none" });
});

// Issue #351: the page offers a change only where the viewer may make it.
test("a viewer who changes nobody in the division sees its people with no action on any row", () => {
  for (const actor of [null, { kind: "lead" as const, divisionIds: [2] }]) {
    const page = divisionMembers({ records, org, divisionId: 1, actor, selfId: null, reach: [1, 2], waiting: [], joining: [] })!;
    assert.equal(page.editable, false);
    assert.deepEqual(page.people.map((p) => p.name), ["Marco Bianchi", "Davide Russo"], "viewing is unchanged");
    assert.ok(page.people.every((p) => p.removal.kind === "not-in-reach" && !p.leave.allowed));
  }
});

test("a viewer who may change the division gets the row actions their actor allows", () => {
  const page = divisionMembers({ records, org, divisionId: 1, actor: { kind: "lead", divisionIds: [1, 2] }, selfId: null, reach: [1, 2], waiting: [], joining: [] })!;
  assert.equal(page.editable, true);
  assert.equal(page.people.find((p) => p.name === "Davide Russo")!.removal.kind, "offered");
});
