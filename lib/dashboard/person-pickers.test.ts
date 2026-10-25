// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";
import { betterAuthUsers } from "@/db/schema";
import { SEED_DATA, teamRolesOf } from "@/db/seed/cases";
import { NO_TEAM_LAYER } from "@/lib/about/team-layer";
import { leaderFieldErrors, leaderGaps, newLeaderFields, teamByName } from "@/lib/about/team-page-add";
import { teamBuildOf } from "@/lib/about/team-roles";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { addRows, resetDatabase } from "./access-matrix/test-database";
import { accountOf, seedFixture } from "./access-matrix/fixture";
import { VIEWERS } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";

// Issue #618: every dashboard person field behaves as Give access on the
// Access page does. Each place is rendered as the dashboard renders it, from
// what the database path answers, and opened the way an editor opens it:
// the field lists people at once with nobody chosen, typing narrows the
// list, and whatever needs a person refuses to go on while nobody is picked.

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

async function signedIn(userId: string): Promise<DashboardData> {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data;
}

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
  const input = () => {
    const field = [...document.querySelectorAll<HTMLInputElement>('[role="combobox"]')].at(-1);
    assert.ok(field, "a person field");
    return field;
  };
  const button = (text: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text);
    assert.ok(found, `a button "${text}"`);
    return found;
  };
  return {
    settle,
    input,
    button,
    press: (text: string) => act(() => void button(text).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))),
    /** Opens the field without typing, and waits for any server search it asks. */
    open: async () => {
      await act(() => input().focus());
      await settle(400);
    },
    type: async (text: string) => {
      await act(() => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input(), text);
        input().dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      await settle(400);
    },
    enter: () => act(() => void input().dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))),
    expanded: () => input().getAttribute("aria-expanded") === "true",
    options: () => [...document.querySelectorAll('[role="option"]')],
    chosen: () => [...document.querySelectorAll('[role="option"][aria-selected="true"]')].length,
    text: () => document.body.textContent ?? "",
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
      document.body.removeAttribute("style");
    },
  };
}

type Mounted = Awaited<ReturnType<typeof mount>>;

/** Opened with no text, the field lists people with nobody chosen; a letter narrows the list to names that hold it. */
async function listsOnOpenAndNarrows(ui: Mounted, letter: string): Promise<void> {
  await ui.open();
  assert.equal(ui.expanded(), true, "the list is open");
  const all = ui.options().length;
  assert.ok(all > 1, `people are listed as the field opens (${all})`);
  assert.equal(ui.chosen(), 0, "nobody is chosen");
  await ui.type(letter);
  const narrowed = ui.options();
  assert.ok(narrowed.length > 0 && narrowed.length < all, `"${letter}" narrows the list (${narrowed.length} of ${all})`);
  for (const option of narrowed) assert.ok(option.textContent?.toLowerCase().includes(letter), `${option.textContent} holds "${letter}"`);
}

test("Edit team tree, Add seat: the Holder field lists the team as it opens, and Add seat waits for a holder", async () => {
  await seedFixture();
  const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
  const { createElement } = await import("react");
  const { SeatDrawer } = await import("@/components/dashboard/seat-drawers");
  const ui = await mount(createElement(SeatDrawer, { target: { kind: "new" }, structure, onClose: () => {} }));
  assert.equal(ui.button("Add seat").disabled, true, "no holder, no seat");
  await ui.press("Pick holder");
  // Before #618 the open field showed only its help sentence.
  await listsOnOpenAndNarrows(ui, "a");
  await ui.unmount();
});

test("Members, Add member: the field lists the team as it opens and keeps its taken rows", async () => {
  await seedFixture();
  const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
  const division = structure.departments.find((d) => d.id === 2)!.divisions[0].page!.division;
  const { createElement } = await import("react");
  const { AddMemberDrawer } = await import("@/components/dashboard/member-panels");
  const ui = await mount(createElement(AddMemberDrawer, { open: true, onOpenChange: () => {}, target: { kind: "division", division } }));
  await ui.open();
  assert.ok(ui.options().some((o) => o.getAttribute("aria-disabled") === "true" && o.textContent?.includes("Already in")), "who is already here shows why");
  await listsOnOpenAndNarrows(ui, "a");
  await ui.unmount();
});

test("View as: the field lists people as it opens with nobody chosen, and neither the button nor Enter starts View as until someone is picked", async () => {
  await seedFixture();
  // View as starts from a Better Auth account; the IT lead seat may use it on every site.
  await addRows(
    betterAuthUsers,
    [...VIEWERS.map(({ name }) => accountOf(name).userId), "person-ma"].map((id) => ({ id, name: id, email: `${id}@auth.test`, emailVerified: true, role: "user" })),
  );
  signInAs(accountOf("IT lead").userId);
  const { createElement } = await import("react");
  const { ViewAsBody } = await import("@/components/dashboard/view-as-dialog");
  const { Dialog, DialogContent } = await import("@/components/ui/dialog");
  const ui = await mount(createElement(Dialog, { open: true }, createElement(DialogContent, null, createElement(ViewAsBody, { opening: { actingTitle: "IT lead" }, fieldId: "view-as-field" }))));
  const start = () => [...window.document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("View as"))!;
  await listsOnOpenAndNarrows(ui, "a");
  assert.equal(start().textContent, "View as");
  assert.equal(start().disabled, true, "the button waits for a pick");
  // Enter in the open list chooses its active row; it never starts View as with nobody chosen.
  await ui.enter();
  assert.equal(ui.expanded(), false, "Enter picked the active row");
  assert.notEqual(start().textContent, "View as", "the button names who was picked");
  assert.equal(start().disabled, false);
  // Typing other text unchooses them.
  await ui.type("an");
  assert.equal(start().textContent, "View as");
  assert.equal(start().disabled, true);
  await ui.unmount();
});

test("Team page editor, Add leader: the Person field opens on the whole team with nobody picked, and shows why Add to page is refused", async () => {
  const build = teamBuildOf(teamRolesOf(SEED_DATA));
  const fields = newLeaderFields(0);
  const { createElement } = await import("react");
  const { TeamLeaderPanel } = await import("@/components/dashboard/team-leader-panel");
  const ui = await mount(
    createElement(TeamLeaderPanel, {
      adding: true,
      fields,
      gaps: leaderGaps(build, NO_TEAM_LAYER, null),
      people: teamByName(build),
      errors: leaderFieldErrors(build, NO_TEAM_LAYER, null, fields),
      photoChoices: [],
      onChange: () => {},
      onPerson: () => {},
      onSubmit: () => {},
      onCancel: () => {},
      onRemove: null,
    }),
  );
  assert.equal(ui.text().includes("Choose a person."), true, "the field says why it is refused");
  assert.equal(ui.input().value, "", "the box reads nobody");
  await listsOnOpenAndNarrows(ui, "a");
  await ui.unmount();
});
