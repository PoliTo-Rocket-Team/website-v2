import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applicationIdOf,
  documentHref,
  documentKindOf,
  mayOpenApplication,
  type ApplicationPlace,
  type RecruitmentReader,
} from "./application-documents";

// The document route's access check (issue #406): it opens an application's
// files for exactly the viewers whose Applications page lists it.

const TEST_BENCH = { divisionId: 20, departmentId: 2 };
const OTHER_DEPARTMENT = { divisionId: 5, departmentId: 1 };
const open = (unit = TEST_BENCH): ApplicationPlace => ({ unit, withdrawn: false });

const flags = { siteContent: false, approveOrders: false } as const;
const covering = { divisionIds: [TEST_BENCH.divisionId], departmentIds: [] };

const teamLeader: RecruitmentReader = { kind: "operations-lead", seat: "team-leader", ...flags, divisionIds: [], departmentIds: [] };
const divisionLead: RecruitmentReader = { kind: "division-lead", ...flags, ...covering };
const departmentHead: RecruitmentReader = { kind: "department-head", ...flags, divisionIds: [], departmentIds: [TEST_BENCH.departmentId] };
const grantHolder: RecruitmentReader = { kind: "member", areaGrant: true, ...flags, ...covering };
const plainMember: RecruitmentReader = { kind: "member", areaGrant: false, ...flags, ...covering };
const applicant: RecruitmentReader = { kind: "non-member", siteContent: false, approveOrders: false, ...covering };
const alumnus: RecruitmentReader = { kind: "alumni", siteContent: false, approveOrders: false, ...covering };

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

  test("a member with no grant, an applicant and an alumnus are refused, even in a unit their ids name", () => {
    for (const viewer of [plainMember, applicant, alumnus]) assert.equal(mayOpenApplication(viewer, open()), false, viewer.kind);
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
