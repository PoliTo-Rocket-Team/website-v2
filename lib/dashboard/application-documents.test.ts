import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applicationIdOf,
  documentHref,
  documentKindOf,
  mayOpenApplication,
  readsRecruitment,
  readsRecruitmentIn,
  type ApplicationPlace,
  type RecruitmentReader,
} from "./application-documents";
import type { AreaGrant, GrantArea } from "./viewer";

// The document route's access check (issue #406): it opens an application's
// files for exactly the viewers whose Applications page lists it.

const TEST_BENCH = { divisionId: 20, departmentId: 2 };
const OTHER_DEPARTMENT = { divisionId: 5, departmentId: 1 };
const open = (unit = TEST_BENCH): ApplicationPlace => ({ unit, withdrawn: false });

const flags = { siteContent: false, approveOrders: false } as const;
/** A role's place in the open test bench division, with that division's code, as `readIdentity` reads a role. */
const IN_TEST_BENCH = { ...TEST_BENCH, divisionCode: "TBE", divisionClosedAt: null };
/** A role's place in no division. */
const NO_DIVISION = { divisionId: null, divisionCode: null, divisionClosedAt: null };
/** A member role in the test bench division: it leads nothing, so it reads no application. */
const inTestBench = { roles: [{ type: "core" as const, ...IN_TEST_BENCH }], grants: [] };

/** A member holding a Can edit grant on each of `areas` over the test bench division, as `readIdentity` reads them. */
function granted(...areas: readonly GrantArea[]): RecruitmentReader {
  const grants: AreaGrant[] = areas.map((target) => ({ target, level: "edit", unit: { kind: "division", divisionId: TEST_BENCH.divisionId } }));
  return { kind: "member", grantedAreas: areas, ...flags, roles: inTestBench.roles, grants };
}

const teamLeader: RecruitmentReader = { kind: "operations-lead", seat: "team-leader", ...flags, roles: [{ type: "president", ...NO_DIVISION, departmentId: null }], grants: [] };
const divisionLead: RecruitmentReader = { kind: "division-lead", ...flags, roles: [{ type: "lead", ...IN_TEST_BENCH }], grants: [] };
const departmentHead: RecruitmentReader = { kind: "department-head", ...flags, roles: [{ type: "head", ...NO_DIVISION, departmentId: TEST_BENCH.departmentId }], grants: [] };
const grantHolder = granted("applications");
const plainMember: RecruitmentReader = { kind: "member", grantedAreas: [], ...flags, ...inTestBench };
const applicant: RecruitmentReader = { kind: "non-member", siteContent: false, approveOrders: false, roles: [], grants: [] };
const alumnus: RecruitmentReader = { kind: "alumni", siteContent: false, approveOrders: false, roles: [], grants: [] };

describe("who may open an application's documents", () => {
  test("full access opens every application, in any division", () => {
    assert.equal(mayOpenApplication(teamLeader, open()), true);
    assert.equal(mayOpenApplication(teamLeader, open(OTHER_DEPARTMENT)), true);
  });

  test("a lead, a head or a grant holder opens applications in the units they cover, and no others", () => {
    for (const viewer of [divisionLead, departmentHead, grantHolder]) {
      assert.equal(mayOpenApplication(viewer, open()), true, viewer.kind);
      assert.equal(mayOpenApplication(viewer, open(OTHER_DEPARTMENT)), false, viewer.kind);
    }
  });

  test("a member with no grant, an applicant and an alumnus are refused, even in a division they hold a role in", () => {
    for (const viewer of [plainMember, applicant, alumnus]) assert.equal(mayOpenApplication(viewer, open()), false, viewer.kind);
  });

  test("a member granted any area but Applications is refused every application and its documents (issue #471)", () => {
    for (const area of ["positions", "members", "orders"] as const) {
      const member = granted(area);
      assert.equal(mayOpenApplication(member, open()), false, area);
      assert.equal(readsRecruitment(member, "applications"), false, area);
      assert.equal(readsRecruitmentIn(member, "applications", TEST_BENCH), false, area);
    }
    assert.equal(mayOpenApplication(granted("positions", "members", "orders"), open()), false, "three other areas together");
  });

  test("an Applications grant opens applications only in the units it names, not the units another grant names (issue #471)", () => {
    const split: RecruitmentReader = {
      kind: "member",
      grantedAreas: ["positions", "applications"],
      ...flags,
      roles: inTestBench.roles,
      grants: [
        { target: "applications", level: "view", unit: { kind: "division", divisionId: TEST_BENCH.divisionId } },
        { target: "positions", level: "edit", unit: { kind: "division", divisionId: OTHER_DEPARTMENT.divisionId } },
      ],
    };
    assert.equal(mayOpenApplication(split, open()), true);
    assert.equal(mayOpenApplication(split, open(OTHER_DEPARTMENT)), false, "the Positions grant's division opens no application");
    assert.equal(readsRecruitmentIn(split, "positions", OTHER_DEPARTMENT), true);
    assert.equal(readsRecruitmentIn(split, "positions", TEST_BENCH), false, "the Applications grant's division lists no positions");
  });

  test("a Positions grant reads the Positions page and no Applications page; an Applications grant the reverse (issue #471)", () => {
    assert.deepEqual([readsRecruitment(granted("positions"), "positions"), readsRecruitment(granted("positions"), "applications")], [true, false]);
    assert.deepEqual([readsRecruitment(grantHolder, "positions"), readsRecruitment(grantHolder, "applications")], [false, true]);
    const both = granted("positions", "applications");
    assert.deepEqual([readsRecruitment(both, "positions"), readsRecruitment(both, "applications"), mayOpenApplication(both, open())], [true, true, true]);
  });

  test("a withdrawn application, or one off every page, opens for nobody", () => {
    assert.equal(mayOpenApplication(teamLeader, { unit: TEST_BENCH, withdrawn: true }), false);
    assert.equal(mayOpenApplication(teamLeader, null), false);
  });
});

describe("the document route's address", () => {
  test("each document opens at its own route, and the route reads it back", () => {
    assert.equal(documentHref(21, "cv"), "/dashboard/applications/21/cv");
    assert.equal(documentHref(21, "motivation-letter"), "/dashboard/applications/21/motivation-letter");
    assert.equal(documentKindOf("motivation-letter"), "motivation-letter");
    assert.equal(applicationIdOf("21"), 21);
  });

  test("anything else in the address is not a document", () => {
    for (const segment of ["", "letter", "CV", "cv.pdf"]) assert.equal(documentKindOf(segment), null);
    for (const segment of ["", "0", "-1", "021", "1.5", "abc", "99999999999"]) assert.equal(applicationIdOf(segment), null);
  });
});
