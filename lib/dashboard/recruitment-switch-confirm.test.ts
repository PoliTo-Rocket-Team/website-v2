// The page's server actions run for real here, on the access tests' in-memory database.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { accountOf, seedFixture } from "./access-matrix/fixture";
import { databaseWrites } from "./access-matrix/test-database";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";

// Issue #691: a click on the site-wide recruitment switch asks first. The
// Positions page is drawn in a DOM as the team leader gets it, and its
// recruitment switch is clicked: the switch keeps the saved state while the
// warning is open, Confirm saves the state asked for through the real
// setRecruitment action, and Cancel or Escape saves nothing.

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
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
// The DOM's own classes: an event made from Node's classes cannot be dispatched
// on a jsdom node. Node's own Blob, URL and the like stay, as the in-memory
// database loads through them.
for (const name of Object.getOwnPropertyNames(window)) {
  const domOnly = !(name in globalThis) || /Event(Target)?$/.test(name);
  if (/^[A-Z]/.test(name) && domOnly && typeof (window as unknown as Record<string, unknown>)[name] === "function") {
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
for (const [name, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

async function teamLeader(): Promise<DashboardData> {
  signInAs(accountOf("team leader").userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (opening as { data: DashboardData }).data;
}

const savedState = async () => (await (await teamLeader()).recruitment()).recruitment.isOpen;

type Answer = "Confirm" | "Cancel" | "Escape";

/** Draws the team leader's Positions page, clicks the recruitment switch and answers the warning. */
async function clickSwitchAndAnswer(answer: Answer) {
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { PositionsView } = await import("@/components/dashboard/positions");

  const data = await teamLeader();
  const [page, recruitment] = await Promise.all([data.positions(), data.recruitment()]);
  assert.equal(page.scope, "team", "the team leader gets the switch, not the notice");
  const before = recruitment.recruitment.isOpen;

  const document = window.document;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const fire = (target: Element, event: Event) => act(() => void target.dispatchEvent(event));
  const switchOf = () => document.querySelector('[role="switch"][aria-label="Recruitment is open"]');
  const checked = () => switchOf()?.getAttribute("aria-checked") === "true";

  await act(() => root.render(createElement(PositionsView, { page, recruitment })));
  const toggle = switchOf();
  assert.ok(toggle, "the switch is drawn");
  assert.equal(toggle.hasAttribute("disabled"), false, "the team leader's switch is live");

  const writes = (await databaseWrites()).length;
  await fire(toggle, new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  await settle();
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, "a click opens the warning");
  const asked = dialog.querySelector("h2")?.textContent;
  assert.equal(checked(), before, "the switch keeps the saved state while the warning is open");
  assert.equal((await databaseWrites()).length, writes, "nothing is saved before an answer");

  const button = (text: string) => {
    const found = [...dialog.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
    assert.ok(found, `the warning has "${text}"`);
    return found;
  };
  const click = (b: Element) => fire(b, new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  if (answer === "Confirm") await click(button(before ? "Close recruitment" : "Open recruitment"));
  else if (answer === "Cancel") await click(button("Cancel"));
  else await fire(dialog, new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  // The confirmed write is a server action in a transition; let it land.
  for (let i = 0; i < 20; i++) await settle();

  const wrote = (await databaseWrites()).length > writes;
  const result = { before, asked, wrote, dialogOpen: document.querySelector('[role="dialog"]') !== null, after: await savedState() };
  await act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  return result;
}

for (const isOpen of [true, false]) {
  test(`with recruitment ${isOpen ? "open" : "closed"}, Confirm saves the state asked for`, async () => {
    await seedFixture();
    if ((await savedState()) !== isOpen) await (await teamLeader()).setRecruitment({ isOpen });
    const r = await clickSwitchAndAnswer("Confirm");
    assert.equal(r.asked, isOpen ? "Close recruitment?" : "Open recruitment?");
    assert.equal(r.dialogOpen, false);
    assert.equal(r.after, !isOpen);
  });
}

for (const answer of ["Cancel", "Escape"] as const) {
  test(`${answer} on the warning saves nothing`, async () => {
    await seedFixture();
    const r = await clickSwitchAndAnswer(answer);
    assert.equal(r.dialogOpen, false);
    assert.equal(r.wrote, false, "nothing is written");
    assert.equal(r.after, r.before);
  });
}
