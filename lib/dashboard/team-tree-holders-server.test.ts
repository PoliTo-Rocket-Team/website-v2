// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { JSDOM } from "jsdom";
import { roles } from "@/db/schema";
import * as teamActions from "@/app/dashboard/team-actions";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { addRows, resetDatabase, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { TeamStructure } from "./team-structure";

// Epic #861, issue #869: the Team tree and Members show every holder of a
// seat, and the Team tree's panels offer Add another holder to the team
// leader and full access alone. Each place reads what the database path
// answers, on the seeded matrix fixture (./access-matrix/fixture.ts), and the
// panels are driven as an editor drives them: the picker refuses someone who
// holds the seat already before save, and a save goes through the server
// write, after which the seat's box names the new holder.

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
// The test database starts its Postgres engine with Node's own globals, so it
// starts before the page's globals take their place.
before(async () => {
  await resetDatabase();
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
});

const LEADER = accountOf("team leader");
const PROJECT_MANAGER = accountOf("Project Manager");
const STRUCTURES = IDS.department("DM");
/** In two divisions, holding no seat: the person every test adds. */
const NEWCOMER = { id: EXTRA.mover, name: "Mover Twice" };
/** An unflagged team-level seat the fixture does not hold: laid over it here. */
const SAFETY_ROW = 9_500;

beforeEach(async () => {
  await seedFixture();
  await addRows(roles, [{ id: SAFETY_ROW, memberId: IDS.person("MA"), title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
});

async function signedIn(userId: string): Promise<DashboardData> {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data;
}

const structureAs = async (userId: string): Promise<TeamStructure | null> => (await signedIn(userId)).teamStructure();

/** The active row Project Manager's seat is. */
async function projectManagerRow(): Promise<number> {
  const row = (await tableRows(roles)).find((r) => r.memberId === PROJECT_MANAGER.memberId && r.leavedAt == null && r.fullAccess === "project_manager");
  assert.ok(row, "the Project Manager holds the seat");
  return row.id as number;
}

/** One seat kind: how the team leader adds a holder, and the box that names its holders. */
type Kind = {
  readonly name: string;
  readonly add: (personId: number) => Promise<unknown>;
  readonly box: (s: TeamStructure) => readonly { readonly id: number }[] | undefined;
};

const KINDS: readonly Kind[] = [
  { name: "the Team Leader box", add: (personId) => teamActions.addTeamLeader({ personId }), box: (s) => s.leader?.holders },
  {
    name: "a full-access seat's box",
    add: async (personId) => teamActions.addSeatHolder(await projectManagerRow(), { personId }),
    box: (s) => s.board.find((b) => b.flag === "project-manager")?.holders,
  },
  { name: "a department's box", add: (personId) => teamActions.addDepartmentHead(STRUCTURES, { personId }), box: (s) => s.departments.find((d) => d.id === STRUCTURES)?.heads },
  {
    name: "an unflagged seat's box",
    add: (personId) => teamActions.addSeatHolder(SAFETY_ROW, { personId }),
    box: (s) => s.board.find((b) => b.title === "Safety Officer")?.holders,
  },
];

describe("the database side names every holder: the Team tree's box and Members", () => {
  for (const kind of KINDS) {
    test(`${kind.name} names both holders, and Members shows the seat on both`, async () => {
      const [holder] = kind.box((await structureAs(LEADER.userId))!) ?? [];
      assert.ok(holder, "one holder before");
      signInAs(LEADER.userId);
      assert.deepEqual(await kind.add(NEWCOMER.id), { ok: true });

      const after = await structureAs(LEADER.userId);
      assert.deepEqual(
        kind.box(after!)?.map((h) => h.id).sort(),
        [holder.id, NEWCOMER.id].sort(),
        "one box names both holders",
      );
      const members = await (await signedIn(LEADER.userId)).members();
      assert.equal(members.scope, "whole-team");
      const personOf = (id: number) => (members.scope === "whole-team" ? members.people.find((p) => p.id === id) : undefined);
      const [had, added] = [personOf(holder.id), personOf(NEWCOMER.id)];
      assert.ok(had && added && had.role !== "member");
      assert.equal(added.role, had.role, "Members ranks each holder by the seat");
      // Each row names the seat by the title it stores: the fixture's head row stores "Head", a new head's row "Head of Structures".
      if (had.role === "head") for (const p of [had, added]) assert.match(p.roleLabel, /^Head/);
      else assert.equal(added.roleLabel, had.roleLabel, "Members shows the seat on each holder");
    });
  }
});

async function mount(element: import("react").ReactElement) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const document = window.document;
  // A test that failed left its panels behind; each panel starts on an empty page.
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const click = (target: Element) =>
    act(() => {
      target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
  const buttons = (text: string) => [...document.querySelectorAll("button")].filter((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text);
  return {
    buttons,
    press: async (text: string) => {
      const [found] = buttons(text);
      assert.ok(found, `a button "${text}"`);
      await click(found);
    },
    /** Types into the open person field, waits for its search, and returns the row that names `name`. */
    find: async (name: string) => {
      const input = [...document.querySelectorAll<HTMLInputElement>('[role="combobox"]')].at(-1);
      assert.ok(input, "a person field");
      await act(() => input.focus());
      await act(() => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, name);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      // The pickers ask the server 250ms after the typing.
      await settle(400);
      const row = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.startsWith(name));
      assert.ok(row, `the field lists ${name}`);
      return row;
    },
    click,
    settle,
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
      document.body.removeAttribute("style");
    },
  };
}

/** One panel: how it is opened on a structure, and which seat kind it adds to. */
type Panel = { readonly name: string; readonly kind: Kind; readonly open: (s: TeamStructure, onClose: () => void) => Promise<import("react").ReactElement> };

const PANELS: readonly Panel[] = [
  {
    name: "the team leader panel",
    kind: KINDS[0]!,
    open: async (s, onClose) => {
      const { createElement } = await import("react");
      const { TeamLeaderDrawer } = await import("@/components/dashboard/team-leader-drawer");
      return createElement(TeamLeaderDrawer, { open: true, leader: s.leader!, addsHolder: s.departmentsEditable, onClose });
    },
  },
  {
    name: "a seat panel",
    kind: KINDS[1]!,
    open: async (s, onClose) => {
      const { createElement } = await import("react");
      const { SeatDrawer } = await import("@/components/dashboard/seat-drawers");
      const roleId = s.board.find((b) => b.flag === "project-manager")!.roleId;
      return createElement(SeatDrawer, { target: { kind: "change", roleId }, structure: s, onClose });
    },
  },
  {
    name: "the department panel",
    kind: KINDS[2]!,
    open: async (s, onClose) => {
      const { createElement } = await import("react");
      const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
      return createElement(DepartmentDrawer, { target: { kind: "edit", departmentId: STRUCTURES }, structure: s, onClose, onTarget: () => {}, onAddDivision: () => {} });
    },
  },
];

describe("Add another holder in the Team tree's panels", () => {
  for (const panel of PANELS) {
    test(`${panel.name}: a holder is refused before save; someone else is saved through the server and named in the box`, async () => {
      const structure = (await structureAs(LEADER.userId))!;
      const [holder] = panel.kind.box(structure)!;
      const everyone = [...(structure.leader?.holders ?? []), ...structure.board.flatMap((b) => b.holders), ...structure.departments.flatMap((d) => d.heads)];
      const holderName = everyone.find((p) => p.id === holder!.id)!.name;
      let closed = false;
      const ui = await mount(await panel.open(structure, () => (closed = true)));
      await ui.press("Add another holder");

      const held = await ui.find(holderName);
      assert.equal(held.getAttribute("aria-disabled"), "true", "someone who holds this seat cannot be picked");
      assert.match(held.textContent ?? "", /holds this seat now/, "and the picker says why, before save");
      await ui.click(held);
      assert.equal(ui.buttons("Add holder").length, 0, "picking them asks nothing");

      await ui.click(await ui.find(NEWCOMER.name));
      await ui.press("Add holder");
      await ui.settle(50);
      assert.equal(closed, true, "the panel closes after the save");
      assert.deepEqual(
        panel.kind.box((await structureAs(LEADER.userId))!)?.map((h) => h.id).sort(),
        [holder!.id, NEWCOMER.id].sort(),
        "the box names the new holder beside the one it had",
      );
      await ui.unmount();
    });
  }
});

describe("who is offered Add another holder: the team leader and full access, nobody else", () => {
  test("full access opens the Team Leader panel to add a holder, with no hand-over; a head and a lead get no panel that adds one", async () => {
    const fullAccess = (await structureAs(PROJECT_MANAGER.userId))!;
    assert.equal(fullAccess.departmentsEditable, true, "full access adds holders");
    assert.equal(fullAccess.leader?.handsOver, null, "only a team leader hands over the role");
    const ui = await mount(await PANELS[0]!.open(fullAccess, () => {}));
    assert.equal(ui.buttons("Add another holder").length, 1);
    assert.equal(ui.buttons("Hand over the role").length, 0);
    await ui.unmount();

    for (const who of ["department head", "division lead"]) {
      const structure = await structureAs(accountOf(who).userId);
      assert.ok(structure, `${who} opens the edit view`);
      // The seat and department panels mount only for `departmentsEditable`, and the Team Leader box opens only for a team leader or it (team-tree-edit.tsx).
      assert.equal(structure.departmentsEditable, false, `${who}: no seat or department panel`);
      assert.equal(structure.leader?.handsOver ?? null, null, `${who}: the Team Leader box is locked`);
    }
  });
});
