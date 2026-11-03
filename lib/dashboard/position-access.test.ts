import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecruitmentRole } from "./application-documents";
import { mayChangePositionIn, type PositionWriter } from "./position-access";
import type { RoleType } from "./team";
import { areaGrantsOf, viewerStandingOf, type FlaggedSeat, type ScopeUnitRow } from "./viewer";

// The one rule the database side asks before editing a position, switching
// it open or closed, or moving an application to it (issue #461), for each
// role, with the viewer built from roles and scope rows as `readIdentity`
// builds it (lib/dashboard/database.ts).

const AERODYNAMICS = 1;
const STRUCTURES = 2;
const OPERATIONS = 3;
const MISSION_ANALYSIS = { divisionId: 1, departmentId: AERODYNAMICS };
const OPTIMIZATION = { divisionId: 2, departmentId: AERODYNAMICS };
const STRUCTURES_ANALYSIS = { divisionId: 4, departmentId: STRUCTURES };
const LOGISTICS = { divisionId: 15, departmentId: OPERATIONS };
const UNITS = [MISSION_ANALYSIS, OPTIMIZATION, STRUCTURES_ANALYSIS];

/** Each division's code; Logistics's is the recruitment manager's (`recruitmentManagerDivision`, ./notices.ts). */
const CODES: Readonly<Record<number, string>> = { 1: "MSA", 2: "OPT", 4: "STA", 15: "LGS" };

type Role = RecruitmentRole & { readonly fullAccess: FlaggedSeat | null };

/** An active role in `unit`, its division open unless `closedAt` names the day it closed. */
const role = (
  type: RoleType,
  unit: { divisionId: number | null; departmentId: number | null },
  fullAccess: FlaggedSeat | null = null,
  closedAt: string | null = null,
): Role => ({
  type,
  ...unit,
  divisionCode: unit.divisionId === null ? null : (CODES[unit.divisionId] ?? null),
  divisionClosedAt: unit.divisionId === null ? null : closedAt,
  fullAccess,
});

/** The viewer `readIdentity` reads from these active roles and scope rows. */
function writerOf(roles: readonly Role[], scopes: readonly ScopeUnitRow[] = []): PositionWriter {
  return {
    ...viewerStandingOf({ scopes, activeRoles: roles }),
    roles,
    grants: areaGrantsOf(scopes),
  };
}

const NO_UNIT = { divisionId: null, departmentId: null };

/** Each role as the dashboard reads it, and the units it may change positions and applications in. */
const CASES: readonly { readonly name: string; readonly viewer: PositionWriter; readonly changes: readonly (typeof MISSION_ANALYSIS)[] }[] = [
  // The team leader's seat is the `president` role, with no scope row (issue #444).
  { name: "team leader", viewer: writerOf([role("president", NO_UNIT)]), changes: UNITS },
  // A team leader who also keeps a member role in one division is still the team leader everywhere.
  { name: "team leader with a member role", viewer: writerOf([role("core", OPTIMIZATION), role("president", NO_UNIT)]), changes: UNITS },
  { name: "department head", viewer: writerOf([role("head", { divisionId: null, departmentId: AERODYNAMICS })]), changes: [MISSION_ANALYSIS, OPTIMIZATION] },
  { name: "division lead", viewer: writerOf([role("lead", MISSION_ANALYSIS)]), changes: [MISSION_ANALYSIS] },
  { name: "lead of two divisions", viewer: writerOf([role("lead", MISSION_ANALYSIS), role("lead", STRUCTURES_ANALYSIS)]), changes: [MISSION_ANALYSIS, STRUCTURES_ANALYSIS] },
  { name: "member", viewer: writerOf([role("core", MISSION_ANALYSIS)]), changes: [] },
];

test("the team leader is full access through their seat, with no scope row (issue #444)", () => {
  const leader = writerOf([role("president", NO_UNIT)]);
  assert.equal(leader.kind, "operations-lead");
  assert.equal(leader.kind === "operations-lead" ? leader.seat : null, "team-leader");
  assert.deepEqual(leader.grants, []);
});

test("each role edits, switches and moves applications only in its own units, and the team leader everywhere (issue #461)", () => {
  for (const { name, viewer, changes } of CASES) {
    for (const unit of UNITS) {
      for (const area of ["positions", "applications"] as const) {
        assert.equal(mayChangePositionIn(viewer, area, unit), changes.includes(unit), `${name}, ${area}, division ${unit.divisionId}`);
      }
    }
  }
});

test("a member changes a position only with a Can edit grant on that area covering it (issue #160)", () => {
  const grant = (target: "positions" | "applications", level: "view" | "edit"): ScopeUnitRow => ({
    scope: "division",
    target,
    level,
    divisionId: MISSION_ANALYSIS.divisionId,
    deptId: null,
  });
  const editor = writerOf([role("core", OPTIMIZATION)], [grant("positions", "edit")]);
  assert.equal(mayChangePositionIn(editor, "positions", MISSION_ANALYSIS), true);
  assert.equal(mayChangePositionIn(editor, "applications", MISSION_ANALYSIS), false);
  assert.equal(mayChangePositionIn(editor, "positions", OPTIMIZATION), false, "their own division is not granted");
  const viewerOnly = writerOf([role("core", OPTIMIZATION)], [grant("positions", "view")]);
  assert.equal(mayChangePositionIn(viewerOnly, "positions", MISSION_ANALYSIS), false);
});

test("someone off the team changes nothing, whatever scope rows remain (issue #201)", () => {
  const alumnus = writerOf([], [{ scope: "admin", target: "all", level: "edit", divisionId: null, deptId: null }]);
  for (const unit of UNITS) assert.equal(mayChangePositionIn(alumnus, "positions", unit), false);
});

// The recruitment manager (issue #194, Owner decisions on the issue,
// 2026-10-22 and 2026-10-25): the lead of the open Logistics division moves
// every division's applications, team-wide. Since issue #885 that lead seat
// is a full-access seat, so it changes positions in every division too.

const OPEN_UNITS = [...UNITS, LOGISTICS];
const where = (viewer: PositionWriter, area: "positions" | "applications") => OPEN_UNITS.filter((unit) => mayChangePositionIn(viewer, area, unit));

test("the Logistics lead, a full-access seat, moves applications and changes positions in every open division (issues #194, #885)", () => {
  const manager = writerOf([role("lead", LOGISTICS)]);
  assert.deepEqual(where(manager, "applications"), OPEN_UNITS, "in Logistics and in every other division");
  assert.deepEqual(where(manager, "positions"), OPEN_UNITS);
});

test("with Logistics closed, its former lead moves applications only where their role lets them, as before (issue #194)", () => {
  const formerManager = writerOf([role("lead", LOGISTICS, null, "2026-09-30")]);
  assert.deepEqual(where(formerManager, "applications"), [LOGISTICS]);
  assert.deepEqual(where(formerManager, "positions"), [LOGISTICS]);
});

test("a lead of another division, a member of Logistics and a member with no grant gain nothing (issue #194)", () => {
  const otherLead = writerOf([role("lead", MISSION_ANALYSIS)]);
  assert.equal(mayChangePositionIn(otherLead, "applications", OPTIMIZATION), false, "a division they do not lead");
  assert.equal(mayChangePositionIn(otherLead, "applications", LOGISTICS), false, "Logistics itself");
  assert.deepEqual(where(otherLead, "applications"), [MISSION_ANALYSIS]);
  for (const member of [writerOf([role("core", LOGISTICS)]), writerOf([role("core", MISSION_ANALYSIS)])]) {
    assert.deepEqual(where(member, "applications"), []);
    assert.deepEqual(where(member, "positions"), []);
  }
});
