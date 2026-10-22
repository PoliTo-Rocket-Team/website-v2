import assert from "node:assert/strict";
import { test } from "node:test";
import { DashboardRefused } from "@/lib/dashboard/data";
import type { PositionRow } from "@/lib/dashboard/recruitment";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE, type DummyState } from "./state";

// Who may edit a position, switch it open or closed, and move its
// applications on the test developer's dashboard (issue #461): the team
// leader everywhere, through the full-access standing (issue #444); a
// department head in their department (Aerodynamics); a division lead in
// their division (Mission Analysis); a member nowhere. A position created in
// the session is changed like any other.

type Role = Extract<TestViewer, "team-leader" | "department-head" | "division-lead" | "member">;

const ROLES: readonly Role[] = ["team-leader", "department-head", "division-lead", "member"];

/** Whether the role may change a position, by where it is. */
function reaches(role: Role, position: Pick<PositionRow, "department" | "division">): boolean {
  switch (role) {
    case "team-leader":
      return true;
    case "department-head":
      return position.department === "Aerodynamics";
    case "division-lead":
      return position.division === "Mission Analysis Division";
    case "member":
      return false;
  }
}

/** The dummy dashboard as `role`, with what a write saves kept for the next read. */
function session(role: Role, state: DummyState = EMPTY_DUMMY_STATE) {
  let saved = state;
  const data = dummyDashboardData(role, { current: dummyRecruitmentOf(undefined), save: async () => {} }, {
    current: state,
    save: async (next) => void (saved = next),
  });
  return { data, saved: () => saved };
}

/** Every position, as the team leader's full view lists it. */
async function allPositions(state: DummyState = EMPTY_DUMMY_STATE): Promise<readonly PositionRow[]> {
  return (await session("team-leader", state).data.positions()).positions;
}

/** One position in Mission Analysis, one elsewhere in Aerodynamics, one outside Aerodynamics. */
async function samples(): Promise<readonly PositionRow[]> {
  const all = await allPositions();
  return [
    all.find((p) => p.division === "Mission Analysis Division")!,
    all.find((p) => p.division === "Optimization and Analysis Division")!,
    all.find((p) => p.department !== "Aerodynamics")!,
  ];
}

const NEW_POSITION = {
  title: "Launch Analyst",
  description: "You check the launch window.",
  required: ["Python"],
  desirable: [],
  questions: [],
  motivationLetter: false,
  open: false,
};

/** The team leader posts a role in `divisionId`; the state with it saved, and the row it lists as. */
async function postedBy(divisionId: number): Promise<{ state: DummyState; position: PositionRow }> {
  const leader = session("team-leader");
  const result = await leader.data.createPosition({ ...NEW_POSITION, divisionId });
  assert.ok(result.ok, "the team leader posts a role in any division");
  const position = (await allPositions(leader.saved())).find((p) => result.ok && p.id === result.value.id)!;
  return { state: leader.saved(), position };
}

test("each role edits a position only where it reaches it, and the team leader everywhere (issue #461)", async () => {
  for (const position of await samples()) {
    for (const role of ROLES) {
      const { data, saved } = session(role);
      const edit = { ...position.content, title: `${position.title} II` };
      if (reaches(role, position)) {
        assert.deepEqual(await data.editPosition(position.id, edit), { ok: true, value: null }, `${role} edits ${position.title}`);
      } else {
        await assert.rejects(data.editPosition(position.id, edit), DashboardRefused, `${role} may not edit ${position.title}`);
        assert.deepEqual(saved(), EMPTY_DUMMY_STATE);
      }
    }
  }
});

test("each role switches a position open or closed only where it reaches it, and the team leader everywhere (issue #461)", async () => {
  for (const position of await samples()) {
    for (const role of ROLES) {
      const { data, saved } = session(role);
      if (reaches(role, position)) {
        await data.setPositionOpen(position.id, !position.open);
        const after = (await allPositions(saved())).find((p) => p.id === position.id)!;
        assert.equal(after.open, !position.open, `${role} switches ${position.title}`);
      } else {
        await assert.rejects(data.setPositionOpen(position.id, !position.open), DashboardRefused, `${role} may not switch ${position.title}`);
        assert.deepEqual(saved(), EMPTY_DUMMY_STATE);
      }
    }
  }
});

test("each role moves an application only where it reaches the position, and the team leader everywhere (issue #461)", async () => {
  const all = await allPositions();
  const applications = (await session("team-leader").data.applications()).applications;
  for (const position of await samples()) {
    const application = applications.find(
      (a) => a.position.ref === position.ref && a.state.stage !== "joined" && a.state.stage !== "rejected" && a.state.stage !== "withdrawn",
    );
    assert.ok(application, `an application to ${position.title} that can still be rejected`);
    assert.ok(all.some((p) => p.ref === application.position.ref));
    for (const role of ROLES) {
      const { data, saved } = session(role);
      if (reaches(role, position)) {
        assert.deepEqual(await data.moveApplication(application.id, { kind: "reject" }), { ok: true, value: null }, `${role} rejects for ${position.title}`);
      } else {
        await assert.rejects(data.moveApplication(application.id, { kind: "reject" }), DashboardRefused, `${role} may not move for ${position.title}`);
        assert.deepEqual(saved(), EMPTY_DUMMY_STATE);
      }
    }
  }
});

test("a position created in the session is edited and switched by every role that reaches it, and refused to the rest (issue #461)", async () => {
  // Mission Analysis (1), Optimization and Analysis (2), Structures Analysis (4).
  for (const divisionId of [1, 2, 4]) {
    const { state, position } = await postedBy(divisionId);
    assert.equal(position.open, false);
    for (const role of ROLES) {
      const { data, saved } = session(role, state);
      if (reaches(role, position)) {
        await data.setPositionOpen(position.id, true);
        const opened = (await allPositions(saved())).find((p) => p.id === position.id)!;
        assert.equal(opened.open, true, `${role} opens the new ${position.division} role`);
        const edit = { ...position.content, title: "Launch Analyst II" };
        assert.deepEqual(await data.editPosition(position.id, edit), { ok: true, value: null }, `${role} edits the new role`);
      } else {
        await assert.rejects(data.setPositionOpen(position.id, true), DashboardRefused, `${role} may not switch the new role`);
        await assert.rejects(data.editPosition(position.id, position.content), DashboardRefused, `${role} may not edit the new role`);
        assert.deepEqual(saved(), state);
      }
    }
  }
});

test("a head and a lead switch a role they created themselves (issue #461)", async () => {
  for (const role of ["department-head", "division-lead"] as const) {
    const own = session(role);
    const divisionId = (await own.data.positions()).newPosition.divisions[0].id;
    const result = await own.data.createPosition({ ...NEW_POSITION, divisionId });
    assert.ok(result.ok);
    if (!result.ok) continue;
    const next = session(role, own.saved());
    await next.data.setPositionOpen(result.value.id, true);
    const after = (await session(role, next.saved()).data.positions()).positions.find((p) => p.id === result.value.id);
    assert.equal(after?.open, true, `${role} opens their own new role`);
  }
});
