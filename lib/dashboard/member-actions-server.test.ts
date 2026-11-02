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
import { advisorChange, leadStepDown } from "./member-actions";
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
  test("Change title: their title in the division, and nothing else", async () => {
    assert.deepEqual(await teamActions.saveDivisionTitle(MOVER, DM, "  CAD Engineer "), { ok: true });
    const rows = await activeOf(MOVER);
    assert.equal(rows.find((r) => r.divisionId === DM)?.title, "CAD Engineer");
    assert.equal(rows.find((r) => r.divisionId === EXTRA.testing)?.title, "Member", "their other division keeps its title");
    assert.equal((await teamActions.saveDivisionTitle(MOVER, IDS.division("MA"), "Nope")).ok, false, "a division they are not in");
  });

  test("Make lead: they lead beside the lead there and keep their other roles", async () => {
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
    test(`Becomes an advisor, ${scope}: a member's role in the division ends, their access ends, their other division stays`, async () => {
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

  test("Becomes an advisor on the Members page, for a lead: Remove with Stays as an advisor, refused while they are the only lead", async () => {
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

  test("a division lead elsewhere changes nobody here", async () => {
    signInAs(accountOf("division lead").userId);
    assert.equal((await teamActions.changeDivisionPeople(DM, advisorChange(MOVER, { role: "member" }, "division"))).ok, false);
    assert.equal((await teamActions.saveDivisionTitle(MOVER, DM, "Nope")).ok, false);
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
    /** Opens a row's "…" menu: each item's words, and the reason under a locked one. */
    open: async (label: string) => {
      await act(() => void trigger(label).dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
      return [...document.querySelectorAll('[role="menuitem"]')].map((m) => ({ text: m.textContent ?? "", locked: m.hasAttribute("data-disabled"), item: m }));
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

const TEAM_TREE_ITEMS = ["Change title", "Make lead", "Becomes an advisor", "Edit details", "Move to…", "Remove from Design & Manufacturing", "Leaves the team"];

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
    await ui.click(moverItems.find((m) => m.text.startsWith("Becomes an advisor"))!.item);
    await ui.settle();
    const text = ui.text();
    assert.ok(text.includes(`Where does ${mover.name.split(" ")[0]} advise?`), "the #900 advisor choice");
    for (const scope of ["Design & Manufacturing", "Structures", "Whole team"]) assert.ok(text.includes(scope), `the scope ${scope}`);
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
    for (const [i, item] of TEAM_TREE_ITEMS.entries()) assert.ok(items[i]?.text.startsWith(item), `item ${i + 1} is ${item}`);
    await ui.unmount();
  });

  test("Members page: the row menu offers Becomes an advisor, with the #900 scopes", async () => {
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
    const advisor = items.find((m) => m.text.startsWith("Becomes an advisor"));
    assert.ok(advisor && !advisor.locked, "Becomes an advisor is offered");
    assert.ok(items.some((m) => m.text.startsWith("Remove from Design & Manufacturing")) && items.some((m) => m.text.startsWith("Leaves the team")));
    await ui.click(advisor.item);
    await ui.settle();
    const text = ui.text();
    assert.ok(text.includes("Advises instead of their role in"), "two divisions: it asks which one");
    assert.ok(text.includes(`Where does ${mover.name.split(" ")[0]} advise?`));
    for (const scope of ["Structures", "Whole team"]) assert.ok(text.includes(scope), `the scope ${scope}`);
    await ui.unmount();
  });

  test("Members page, Edit details: the only lead's Member is locked; with another lead, switching to member asks What happens to them?", async () => {
    const page = await dmPage();
    const lead = personIn(page, LEAD);
    const actions = divisionActionsOf(lead);
    assert.ok(actions, "the team leader edits the lead");
    const { act, createElement } = await import("react");
    const { EditDetailsDrawer } = await import("@/components/dashboard/member-panels");
    const sole = await mount(createElement(EditDetailsDrawer, { target: { kind: "person", actions, googleEmails: [] }, openedFrom: "members", onClose: () => {} }));
    // Becomes an advisor is in Edit details too, so the Members table and phone views reach it.
    const advisor = [...window.document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Becomes an advisor");
    assert.ok(advisor, "Edit details offers Becomes an advisor");
    assert.equal(advisor.disabled, true, "locked: they are the division's only lead");
    assert.ok(sole.text().includes("A division needs at least one lead."), "with the reason");
    const soleAs = [...window.document.querySelectorAll("select")].find((s) => s.value === "lead");
    assert.equal(soleAs?.querySelector<HTMLOptionElement>('option[value="member"]')?.disabled, true, "Member is locked under As for the only lead");
    await sole.unmount();

    // A second lead in the division opens Member, and the step-down question with it.
    const shared = { ...actions, position: { ...actions.position, roles: actions.position.roles.map((r) => ({ ...r, leads: 2 })) } };
    const ui = await mount(createElement(EditDetailsDrawer, { target: { kind: "person", actions: shared, googleEmails: [] }, openedFrom: "members", onClose: () => {} }));
    const question = `What happens to ${lead.name.split(" ")[0]}?`;
    assert.ok(!ui.text().includes(question), "not asked while they stay a lead");
    const as = [...window.document.querySelectorAll("select")].find((s) => s.value === "lead");
    assert.ok(as, "the As box shows Division lead");
    assert.equal(as.querySelector<HTMLOptionElement>('option[value="member"]')?.disabled, false, "Member is open with another lead");
    await act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")!.set!.call(as, "member");
      as.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    const text = ui.text();
    assert.ok(text.includes(question), "asked once switched to member");
    for (const option of ["Stays as a member", "Stays as an advisor", "Leaves Design & Manufacturing", "Leaves the team"]) assert.ok(text.includes(option), option);
    await ui.unmount();
  });
});
