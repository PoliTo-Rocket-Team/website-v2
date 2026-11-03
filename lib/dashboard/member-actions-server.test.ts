// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { JSDOM } from "jsdom";
import * as teamActions from "@/app/dashboard/team-actions";
import { roles, scopes } from "@/db/schema";
import type { DashboardData } from "./data";
import type { DivisionMembers, DivisionPerson } from "./division-members";
import { divisionActionsOf } from "./members-view";
import { advisorChange, advisorRoleSave, leadStepDown } from "./member-actions";
import { openDashboard } from "./open";
import { addRows, resetDatabase, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { NO_TEAM_ADDRESSES } from "./team-address";

// Member action parity (issue #901): the Team tree's member menu and the
// Members page offer the same actions on a member, and each one saves through
// the write its place already uses. Run on the seeded matrix fixture
// (./access-matrix/fixture.ts) and a freshly migrated PGlite database: the
// writes through the real server actions, the menus mounted in JSDOM.

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
const globals: Record<string, unknown> = {
  window,
  document: window.document,
  navigator: window.navigator,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
};
for (const name of Object.getOwnPropertyNames(window)) {
  if (/^[A-Z]/.test(name) && typeof (window as unknown as Record<string, unknown>)[name] === "function") {
    globals[name] = (window as unknown as Record<string, unknown>)[name];
  }
}
class StillObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globals.ResizeObserver = StillObserver;
globals.IntersectionObserver = StillObserver;
window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
window.HTMLElement.prototype.scrollIntoView = () => {};
// The test database starts its Postgres engine with Node's own globals, so it starts before the page's globals take their place.
before(async () => {
  await resetDatabase();
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
});

const TEAM_LEADER = accountOf("team leader").userId;
const DM = IDS.division("DM"); // Design & Manufacturing, in Structures
const STRUCTURES = IDS.department("DM");
const LEAD = IDS.lead("DM"); // its one lead
const MEMBER = IDS.person("DM"); // a member, in no other division
const MOVER = EXTRA.mover; // a member, also in Testing

beforeEach(async () => {
  await seedFixture();
  signInAs(TEAM_LEADER);
});

const activeOf = async (memberId: number) => (await tableRows(roles)).filter((r) => r.leavedAt == null && r.memberId === memberId);
const roleIn = async (memberId: number, divisionId: number) => (await activeOf(memberId)).filter((r) => r.divisionId === divisionId).map((r) => r.type);

async function data(): Promise<DashboardData> {
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data;
}

/** Design & Manufacturing as the Team tree's edit view reads it. */
async function dmPage(): Promise<DivisionMembers> {
  const structure = (await (await data()).teamStructure())!;
  const page = structure.departments.flatMap((d) => d.divisions).find((d) => d.id === DM)?.page ?? null;
  assert.ok(page, "the team leader edits Design & Manufacturing");
  return page;
}

function personIn(page: DivisionMembers, id: number): DivisionPerson {
  const person = page.people.find((p) => p.id === id);
  assert.ok(person, `person ${id} is in the division`);
  return person;
}

describe("each member action saves through its place's write", () => {
  test("the role pill's Lead: they lead beside the lead there and keep their other roles", async () => {
    assert.deepEqual(await teamActions.saveMember(MOVER, DM, "division-lead"), { ok: true });
    assert.deepEqual(await roleIn(MOVER, DM), ["lead"]);
    assert.deepEqual(await roleIn(MOVER, EXTRA.testing), ["core"]);
    assert.deepEqual(await roleIn(LEAD, DM), ["lead"], "several leads");
  });

  for (const [scope, at] of [
    ["division", (r: Record<string, unknown>) => r.divisionId === DM],
    ["department", (r: Record<string, unknown>) => r.deptId === STRUCTURES && r.divisionId == null],
    ["team", (r: Record<string, unknown>) => r.deptId == null && r.divisionId == null],
  ] as const) {
    test(`the role pill's Advisor, ${scope}: a member's role in the division ends, their access ends, their other division stays`, async () => {
      await addRows(scopes, [{ id: 9_700, memberId: MOVER, scope: "division", target: "positions", accessLevel: "edit", divisionId: DM }]);
      assert.deepEqual(await teamActions.changeDivisionPeople(DM, advisorChange(MOVER, { role: "member" }, scope)), { ok: true });
      const active = await activeOf(MOVER);
      assert.equal(active.some((r) => r.divisionId === DM && r.type !== "advisor"), false, "no member role in the division");
      assert.ok(active.some((r) => r.divisionId === EXTRA.testing && r.type === "core"), "still in Testing");
      const advisor = active.filter((r) => r.type === "advisor");
      assert.equal(advisor.length, 1);
      assert.ok(at(advisor[0]), `the Advisor role sits at the ${scope}`);
      assert.deepEqual((await tableRows(scopes)).filter((r) => r.memberId === MOVER), [], "their access ends");
    });
  }

  test("the role pill's Advisor, for a lead: Remove with Stays as an advisor, refused while they are the only lead", async () => {
    const asLead = advisorChange(LEAD, { role: "lead" }, "team");
    const refused = await teamActions.changeDivisionPeople(DM, asLead);
    assert.deepEqual(refused, { ok: false, error: "A division needs at least one lead." });
    assert.deepEqual(await roleIn(LEAD, DM), ["lead"]);
    await teamActions.saveMember(MOVER, DM, "division-lead");
    assert.deepEqual(await teamActions.changeDivisionPeople(DM, asLead), { ok: true });
    assert.deepEqual(await roleIn(LEAD, DM), []);
    assert.ok((await activeOf(LEAD)).some((r) => r.type === "advisor" && r.divisionId == null && r.deptId == null));
  });

  test("Edit details' lead to member saves the Team tree's Remove: Stays as a member, or Leaves the division", async () => {
    await teamActions.saveMember(MOVER, DM, "division-lead");
    assert.deepEqual(await teamActions.changeDivisionPeople(DM, leadStepDown(MOVER, "member", null)), { ok: true });
    assert.deepEqual(await roleIn(MOVER, DM), ["core"]);
    await teamActions.saveMember(MOVER, DM, "division-lead");
    assert.deepEqual(await teamActions.changeDivisionPeople(DM, leadStepDown(MOVER, "leave-division", null)), { ok: true });
    assert.deepEqual(await roleIn(MOVER, DM), []);
    assert.deepEqual(await roleIn(MOVER, EXTRA.testing), ["core"]);
  });

  // An advisor's pill (issue #972; Owner decision, 2026-11-03): back to Member or Lead, or another scope.
  const asAdvisor = async () => {
    assert.deepEqual(await teamActions.changeDivisionPeople(DM, advisorChange(MEMBER, { role: "member" }, "division")), { ok: true });
    assert.deepEqual(await roleIn(MEMBER, DM), ["advisor"]);
  };

  for (const [pick, type] of [
    ["member", "core"],
    ["lead", "lead"],
  ] as const) {
    test(`an advisor's pill back to ${pick}: their Advisor role there ends and a ${pick} role starts, untitled`, async () => {
      await asAdvisor();
      const write = advisorRoleSave(MEMBER, { kind: pick });
      assert.ok(write?.kind === "role");
      assert.deepEqual(await teamActions.saveMember(MEMBER, DM, write.role), { ok: true });
      const here = (await activeOf(MEMBER)).filter((r) => r.divisionId === DM);
      assert.deepEqual(
        here.map((r) => [r.type, r.title]),
        [[type, ""]],
      );
      assert.equal((await activeOf(MEMBER)).filter((r) => r.type === "advisor").length, 0, "no Advisor role is left");
    });
  }

  for (const [scope, at] of [
    ["department", (r: Record<string, unknown>) => r.deptId === STRUCTURES && r.divisionId == null],
    ["team", (r: Record<string, unknown>) => r.deptId == null && r.divisionId == null],
  ] as const) {
    test(`an advisor's pill to ${scope}: their one Advisor role moves there`, async () => {
      await asAdvisor();
      const write = advisorRoleSave(MEMBER, { kind: "advisor", scope });
      assert.ok(write?.kind === "advise");
      assert.deepEqual(await teamActions.changeDivisionPeople(DM, write.change), { ok: true });
      const advisor = (await activeOf(MEMBER)).filter((r) => r.type === "advisor");
      assert.equal(advisor.length, 1, "one Advisor role");
      assert.ok(at(advisor[0]), `it sits at the ${scope}`);
      assert.deepEqual(await roleIn(MEMBER, DM), [], "nothing left in the division");
    });
  }

  test("a division lead elsewhere changes nobody here", async () => {
    signInAs(accountOf("division lead").userId);
    assert.equal((await teamActions.changeDivisionPeople(DM, advisorChange(MOVER, { role: "member" }, "division"))).ok, false);
    assert.deepEqual(await roleIn(MOVER, DM), ["core"]);
  });
});

async function mount(element: import("react").ReactElement) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const document = window.document;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const click = (target: Element) => act(() => void target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
  const trigger = (label: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
    assert.ok(found, `a button "${label}"`);
    return found;
  };
  return {
    /** Opens a row's "…" menu or a role pill: each item's words, and the reason under a locked one. */
    open: async (label: string) => {
      await act(() => void trigger(label).dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
      return [...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')].map((m) => ({
        text: m.textContent ?? "",
        locked: m.hasAttribute("data-disabled"),
        checked: m.getAttribute("aria-checked") === "true",
        item: m,
      }));
    },
    click,
    settle,
    text: () => document.body.textContent ?? "",
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
      document.body.removeAttribute("style");
    },
  };
}

const TEAM_TREE_ITEMS = ["Edit details", "Move to…", "Remove from Design & Manufacturing", "Leaves the team"];
/** What Edit details' role pill holds now, in the role section (issue #972). */
const ROLE_ACTIONS_GONE = ["Change title", "Make lead", "Becomes an advisor"];

describe("the Team tree and the Members page offer the same member actions", () => {
  test("Team tree, Edit division: a member row's menu offers every action; Remove is locked as their only division", async () => {
    const page = await dmPage();
    const { createElement } = await import("react");
    const { DivisionDrawer } = await import("@/components/dashboard/division-drawer");
    const edited: number[] = [];
    const structure = (await (await data()).teamStructure())!;
    const ui = await mount(
      createElement(DivisionDrawer, {
        target: { kind: "edit", tab: page },
        takenCodes: structure.takenCodes,
        seats: structure.seats,
        editable: true,
        onClose: () => {},
        onFill: () => {},
        onEdit: (p: DivisionPerson) => edited.push(p.id),
        mayClose: () => false,
        onCloseDivision: () => {},
      }),
    );
    const member = personIn(page, MEMBER);
    const items = await ui.open(`Actions for ${member.name}`);
    assert.equal(items.length, TEAM_TREE_ITEMS.length);
    for (const [i, label] of TEAM_TREE_ITEMS.entries()) assert.ok(items[i]?.text.startsWith(label), `item ${i + 1} is ${label}`);
    const remove = items.find((m) => m.text.startsWith("Remove from"))!;
    assert.ok(remove.locked && remove.text.includes("only division"), "Remove from is locked: their only division");
    assert.ok(items.filter((m) => m !== remove).every((m) => !m.locked), "the team leader may take every other action");

    await ui.click(items.find((m) => m.text.startsWith("Edit details"))!.item);
    assert.deepEqual(edited, [MEMBER], "Edit details opens the page's Edit details panel for them");

    const mover = personIn(page, MOVER);
    const moverItems = await ui.open(`Actions for ${mover.name}`);
    const moverRemove = moverItems.find((m) => m.text.startsWith("Remove from"))!;
    assert.ok(!moverRemove.locked && moverRemove.text.includes("Stays in Testing"), "Remove from is open for someone in another division");
    for (const gone of ROLE_ACTIONS_GONE) assert.ok(!moverItems.some((m) => m.text.startsWith(gone)), `no ${gone}: Edit details' role pill holds it`);
    await ui.unmount();
  });

  test("Team tree, Edit department: a division's member rows carry the same menu", async () => {
    const structure = (await (await data()).teamStructure())!;
    const { createElement } = await import("react");
    const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
    const ui = await mount(
      createElement(DepartmentDrawer, {
        target: { kind: "edit", departmentId: STRUCTURES },
        structure,
        onClose: () => {},
        onTarget: () => {},
        onAddDivision: () => {},
        onEdit: () => {},
      }),
    );
    const member = personIn(await dmPage(), MEMBER);
    const label = `Actions for ${member.name}`;
    if (![...window.document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === label)) {
      // Only the first division starts open.
      await ui.click([...window.document.querySelectorAll("button[aria-expanded]")].find((b) => b.textContent?.includes("Design & Manufacturing"))!);
    }
    const items = await ui.open(label);
    assert.equal(items.length, TEAM_TREE_ITEMS.length);
    for (const [i, item] of TEAM_TREE_ITEMS.entries()) assert.ok(items[i]?.text.startsWith(item), `item ${i + 1} is ${item}`);
    await ui.unmount();
  });

  test("Members page: the row menu offers each Remove from and Leaves the team, and none of the role actions", async () => {
    const d = await data();
    const { createElement } = await import("react");
    const { MembersView } = await import("@/components/dashboard/members");
    const ui = await mount(
      createElement(MembersView, { directory: await d.members(), aliases: {}, teamAddresses: NO_TEAM_ADDRESSES, editable: true, exportable: false, askedDivision: DM }),
    );
    const mover = personIn(await dmPage(), MOVER);
    // The table opens first; the List view's rows carry the ⋯ menu.
    await ui.click([...window.document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "List")!);
    const items = await ui.open(`Actions for ${mover.name}`);
    assert.ok(items.some((m) => m.text.startsWith("Remove from Design & Manufacturing")) && items.some((m) => m.text.startsWith("Leaves the team")));
    for (const gone of ROLE_ACTIONS_GONE) assert.ok(!items.some((m) => m.text.startsWith(gone)), `no ${gone}`);
    await ui.unmount();
  });

  test("Edit details: one row per division; the role pill offers Member, Lead and the advisor scopes, locked with the reason", async () => {
    const page = await dmPage();
    const mover = personIn(page, MOVER);
    const actions = divisionActionsOf(mover);
    assert.ok(actions, "the team leader edits them");
    const { createElement } = await import("react");
    const { EditDetailsDrawer } = await import("@/components/dashboard/member-panels");
    const ui = await mount(createElement(EditDetailsDrawer, { target: { kind: "person", actions, googleEmails: [] }, openedFrom: "team-tree", onClose: () => {} }));
    for (const short of ["Design & Manufacturing", "Testing"]) {
      const pill = [...window.document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith(`Role in ${short}:`));
      assert.ok(pill, `a role pill for ${short}`);
      assert.equal(pill.closest("ul")?.querySelectorAll("select").length, 0, "no browser dropdown in the role rows");
    }
    const items = await ui.open("Role in Design & Manufacturing: Member");
    const labels = ["Member", "Lead", "This division", "Its department", "Whole team"];
    assert.equal(items.length, labels.length);
    labels.forEach((label, i) => assert.ok(items[i]?.text.startsWith(label), `item ${i} is ${label}`));
    assert.ok(items[0]?.checked, "the current role carries the check");
    assert.ok(items[1]?.text.includes("Leads beside "), "Lead names the division's lead");
    assert.ok(items[2]?.text.endsWith("Design & Manufacturing"), "This division names the division");
    assert.ok(items.every((m) => !m.locked), "the team leader may pick each");
    assert.ok(ui.text().includes("Leaves the team") && ui.text().includes("Ends every role. They move to alumni."));
    assert.ok(!ui.text().includes("Also on the Team tree"), "no link back to the Team tree it was opened from");
    await ui.unmount();
  });

  test("Edit details, the only lead: Member is locked with the reason; with another lead, Member asks What happens to them?", async () => {
    const page = await dmPage();
    const lead = personIn(page, LEAD);
    const actions = divisionActionsOf(lead);
    assert.ok(actions, "the team leader edits the lead");
    const { createElement } = await import("react");
    const { EditDetailsDrawer } = await import("@/components/dashboard/member-panels");
    const pillLabel = "Role in Design & Manufacturing: Lead";
    const sole = await mount(createElement(EditDetailsDrawer, { target: { kind: "person", actions, googleEmails: [] }, openedFrom: "members", onClose: () => {} }));
    const soleItems = await sole.open(pillLabel);
    const member = soleItems.find((m) => m.text.startsWith("Member"))!;
    assert.ok(member.locked && member.text.includes("A division needs at least one lead."), "Member is locked for the only lead, with the reason");
    assert.ok(soleItems.filter((m) => !m.text.startsWith("Lead")).every((m) => m.locked), "so is each advisor scope");
    await sole.unmount();

    // A second lead in the division opens Member, and the step-down question with it.
    const shared = { ...actions, position: { ...actions.position, roles: actions.position.roles.map((r) => ({ ...r, leads: 2 })) } };
    const ui = await mount(createElement(EditDetailsDrawer, { target: { kind: "person", actions: shared, googleEmails: [] }, openedFrom: "members", onClose: () => {} }));
    const question = `What happens to ${lead.name.split(" ")[0]}?`;
    assert.ok(!ui.text().includes(question), "not asked while they stay a lead");
    const items = await ui.open(pillLabel);
    const open = items.find((m) => m.text.startsWith("Member"))!;
    assert.ok(!open.locked, "Member is open with another lead");
    await ui.click(open.item);
    await ui.settle();
    const text = ui.text();
    assert.ok(text.includes(question), "asked once switched to member");
    for (const option of ["Stays as a member", "Stays as an advisor", "Leaves Design & Manufacturing", "Leaves the team"]) assert.ok(text.includes(option), option);
    await ui.unmount();
  });

  test("Edit details, an advisor: every choice of the pill is open, and Save makes the pick (#972)", async () => {
    assert.deepEqual(await teamActions.changeDivisionPeople(DM, advisorChange(MEMBER, { role: "member" }, "division")), { ok: true });
    const page = await dmPage();
    const actions = divisionActionsOf(personIn(page, MEMBER));
    assert.ok(actions, "the team leader edits the advisor");
    const { createElement } = await import("react");
    const { EditDetailsDrawer } = await import("@/components/dashboard/member-panels");
    let closed = false;
    const ui = await mount(createElement(EditDetailsDrawer, { target: { kind: "person", actions, googleEmails: [] }, openedFrom: "members", onClose: () => (closed = true) }));
    const items = await ui.open("Role in Design & Manufacturing: Advisor · this division");
    assert.ok(items.every((m) => !m.locked), "Member, Lead and each scope are open");
    await ui.click(items.find((m) => m.text.startsWith("Lead"))!.item);
    await ui.settle();
    const save = [...window.document.querySelectorAll("button")].find((b) => b.getAttribute("type") === "submit");
    assert.ok(save, "a Save button");
    await ui.click(save);
    for (let i = 0; i < 50 && !closed; i++) await ui.settle(20);
    assert.ok(closed, "Save closes the panel");
    assert.deepEqual(await roleIn(MEMBER, DM), ["lead"], "they lead the division, no longer advise it");
    await ui.unmount();
  });
});
