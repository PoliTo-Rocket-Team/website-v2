// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { resetDatabase } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { TeamStructure } from "./team-structure";

// Issue #927: every Team tree create or save form stays clickable while it is
// incomplete, says what is missing above its main button and focuses the
// first field in error. Each field the summary can name must have exactly one
// control to focus in the state the form is drawn in: none leaves focus where
// it was, two send it to whichever comes first. Each form is driven through
// its states (picker open or closed, one holder or several, Add another
// holder) and refused in each.

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
// A refused form scrolls to its first field in error; JSDOM draws no layout.
window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
window.HTMLElement.prototype.scrollIntoView = () => {};
// The test database starts its Postgres engine with Node's own globals, so it
// starts before the page's globals take their place.
before(async () => {
  await resetDatabase();
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
});
beforeEach(() => seedFixture());

const LEADER = accountOf("team leader");
const STRUCTURES = IDS.department("DM");
/** Holds no seat: the person each picker picks. */
const PICKED = { id: EXTRA.mover, name: "Mover Twice" };

async function structure(): Promise<TeamStructure> {
  signInAs(LEADER.userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (await (opening as { data: DashboardData }).data.teamStructure())!;
}

async function mount(element: import("react").ReactElement) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { focusTargets } = await import("@/components/dashboard/error-summary");
  const document = window.document;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(element));
  const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const click = (target: Element) => act(() => void target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
  const button = (text: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text);
    assert.ok(found, `a button "${text}"`);
    return found;
  };
  const fill = (input: HTMLInputElement, value: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  return {
    press: (text: string) => click(button(text)),
    /** Types into the form's text field named `name`. */
    fill: (name: string, value: string) => fill(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, value),
    /** Picks `name` in the open person field. */
    pick: async (name: string) => {
      const input = [...document.querySelectorAll<HTMLInputElement>('[role="combobox"]')].at(-1);
      assert.ok(input, "a person field");
      await act(() => input.focus());
      await fill(input, name);
      // The pickers ask the server 250ms after the typing.
      await settle(400);
      const row = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.startsWith(name));
      assert.ok(row, `the field lists ${name}`);
      await click(row);
    },
    /** Opens a row's "…" menu and chooses `item`. */
    menu: async (trigger: string, item: string) => {
      await act(() => void button(trigger).dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
      const found = [...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent?.includes(item));
      assert.ok(found, `the menu item "${item}"`);
      await click(found);
    },
    /**
     * Presses `submit` with focus elsewhere: the summary shows, every field in
     * error (`inError`, in the form's order) has exactly one control to focus,
     * and the first one has focus.
     */
    refused: async (submit: string, inError: readonly string[], state: string) => {
      (document.activeElement as HTMLElement | null)?.blur();
      await click(button(submit));
      assert.ok(document.querySelector('[role="alert"]'), `${state}: the summary shows`);
      const form = document.getElementById(button(submit).getAttribute("form")!) as HTMLFormElement;
      for (const name of inError) assert.equal(focusTargets(form, name).length, 1, `${state}: one control to focus for "${name}"`);
      assert.equal(document.activeElement?.getAttribute("name"), inError[0], `${state}: focus is on "${inError[0]}"`);
    },
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
      document.body.removeAttribute("style");
    },
  };
}

test("Add seat: refused with the picker closed and open, it focuses the title, then the holder", async () => {
  const s = await structure();
  const { createElement } = await import("react");
  const { SeatDrawer } = await import("@/components/dashboard/seat-drawers");
  const ui = await mount(createElement(SeatDrawer, { target: { kind: "new" }, structure: s, onClose: () => {} }));
  await ui.refused("Add seat", ["title", "holder"], "nothing filled");
  await ui.fill("title", "Safety Officer");
  await ui.refused("Add seat", ["holder"], "no holder, picker closed");
  await ui.press("Pick holder");
  await ui.refused("Add seat", ["holder"], "no holder, picker open");
  await ui.unmount();
});

test("Change holder on a seat with one holder: every state points at who takes the seat, then the hand-over", async () => {
  const s = await structure();
  const seat = s.board[0];
  assert.equal(seat.holders.length, 1, "the fixture's seat has one holder");
  const { createElement } = await import("react");
  const { SeatDrawer } = await import("@/components/dashboard/seat-drawers");
  const open = () => mount(createElement(SeatDrawer, { target: { kind: "change", roleId: seat.roleId }, structure: s, onClose: () => {} }));

  let ui = await open();
  await ui.refused("Save changes", ["next"], "nobody picked");
  await ui.press("Change holder");
  await ui.refused("Save changes", ["next"], "Change holder's picker open");
  await ui.pick(PICKED.name);
  await ui.refused("Save changes", [`seat-${seat.roleId}`], "picked, no hand-over");
  await ui.unmount();

  ui = await open();
  await ui.press("Add another holder");
  await ui.refused("Save changes", ["next"], "Add another holder open");
  await ui.unmount();
});

test("Change holder on a seat with several holders: every state points at who takes the seat, then the hand-over", async () => {
  const s = await structure();
  const [seat, ...rest] = s.board;
  // A second holder laid over the first seat: each holder's Replace sits in its row's menu (issue #872).
  const [first] = seat.holders;
  const holders = [first, { ...first, id: first.id + 100_000, roleId: first.roleId + 100_000, name: "Second Holder" }] as const;
  const shared = { ...s, board: [{ ...seat, holders }, ...rest] };
  const { createElement } = await import("react");
  const { SeatDrawer } = await import("@/components/dashboard/seat-drawers");
  const open = () => mount(createElement(SeatDrawer, { target: { kind: "change", roleId: seat.roleId }, structure: shared, onClose: () => {} }));

  let ui = await open();
  await ui.refused("Save changes", ["next"], "nobody picked");
  await ui.menu(`Actions for ${holders[0].name}`, `Replace ${holders[0].name}`);
  await ui.refused("Save changes", ["next"], "Replace's picker open");
  await ui.pick(PICKED.name);
  await ui.refused("Save changes", [`seat-${seat.roleId}`], "picked, no hand-over");
  await ui.unmount();

  ui = await open();
  await ui.press("Add another holder");
  await ui.refused("Save changes", ["next"], "Add another holder open");
  await ui.unmount();
});

test("Hand over your role: refused with the picker open, closed by Add another holder, and after a pick", async () => {
  const s = await structure();
  assert.ok(s.leader?.handsOver, "the team leader may hand over");
  const { createElement } = await import("react");
  const { TeamLeaderDrawer } = await import("@/components/dashboard/team-leader-drawer");
  const open = () => mount(createElement(TeamLeaderDrawer, { open: true, leader: s.leader!, addsHolder: true, onClose: () => {} }));

  let ui = await open();
  await ui.refused("Hand over the role", ["next", "team-leader-next"], "picker open");
  await ui.pick(PICKED.name);
  await ui.refused("Hand over the role", ["team-leader-next"], "picked, nothing chosen next");
  await ui.unmount();

  ui = await open();
  await ui.press("Add another holder");
  await ui.refused("Hand over the role", ["next", "team-leader-next"], "Add another holder open");
  await ui.unmount();
});

test("New department: refused with the head picker closed and open", async () => {
  const s = await structure();
  const { createElement } = await import("react");
  const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
  const ui = await mount(createElement(DepartmentDrawer, { target: { kind: "new" }, structure: s, onClose: () => {}, onTarget: () => {}, onAddDivision: () => {} }));
  await ui.refused("Create department", ["name", "code", "head"], "nothing filled");
  await ui.fill("name", "Payload");
  await ui.fill("code", "PL");
  await ui.refused("Create department", ["head"], "no head, picker closed");
  await ui.press("Pick head");
  await ui.refused("Create department", ["head"], "no head, picker open");
  await ui.unmount();
});

test("Edit department: refused on the name, and on the hand-over after Change head", async () => {
  const s = await structure();
  const department = s.departments.find((d) => d.id === STRUCTURES)!;
  assert.equal(department.heads.length, 1, "the fixture's department has one head");
  const { createElement } = await import("react");
  const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
  const ui = await mount(createElement(DepartmentDrawer, { target: { kind: "edit", departmentId: STRUCTURES }, structure: s, onClose: () => {}, onTarget: () => {}, onAddDivision: () => {} }));
  await ui.press("Change head");
  await ui.pick(PICKED.name);
  await ui.refused("Save changes", [`head-${STRUCTURES}`], "new head, no hand-over");
  await ui.fill("name", "");
  await ui.refused("Save changes", ["name", `head-${STRUCTURES}`], "no name, no hand-over");
  await ui.unmount();
});

test("New division: refused with the lead picker closed and open", async () => {
  const s = await structure();
  const { createElement } = await import("react");
  const { DivisionDrawer } = await import("@/components/dashboard/division-drawer");
  const ui = await mount(
    createElement(DivisionDrawer, {
      target: { kind: "new", department: { id: STRUCTURES, name: "Structures" } },
      takenCodes: s.takenCodes,
      seats: s.seats,
      editable: true,
      onClose: () => {},
      onFill: () => {},
      mayClose: () => false,
      onCloseDivision: () => {},
    }),
  );
  await ui.refused("Create division", ["name", "code", "lead"], "nothing filled");
  await ui.fill("name", "Payload Bay");
  await ui.fill("code", "PB");
  await ui.refused("Create division", ["lead"], "no lead, picker closed");
  await ui.press("Add lead");
  await ui.refused("Create division", ["lead"], "no lead, picker open");
  await ui.unmount();
});
