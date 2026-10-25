// The page's server actions run for real here, on the access tests' in-memory database.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { accountOf, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";

// Issue #616: every dashboard list opens a row's side view on a click on the
// row. The Alumni page is drawn in a DOM as the team leader gets it: a click
// on a desktop table row, or on its name button, opens that person's fix
// panel, as the phone card does; a click on the row's Shown / Hidden switch
// only flips the switch.

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

type Target = "row" | "name" | "phone card" | "switch";

/** Draws the team leader's Alumni page, clicks one part of the first person's row, and says which panel opened. */
async function clickAlumnus(target: Target) {
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { AlumniView } = await import("@/components/dashboard/alumni");

  const data = await teamLeader();
  const directory = await data.alumni();
  const first = directory.rows[0];
  assert.ok(first, "the team leader's Alumni page has rows");

  const document = window.document;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const click = (el: Element) =>
    act(() => void el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));

  await act(() => root.render(createElement(AlumniView, { directory, editable: true })));
  const name = container.querySelector(`table button[aria-label="Fix how ${first.name} shows"]`);
  assert.ok(name, "the table row's name is a button");
  const row = name.closest("tr");
  assert.ok(row, "the name sits in a table row");
  assert.equal(row.querySelector('[aria-label^="More"], [aria-haspopup="menu"]'), null, "the row has no three-dot button");

  if (target === "row") await click(row.querySelector("td:nth-child(2)")!);
  else if (target === "name") await click(name);
  else if (target === "switch") await click(row.querySelector('[role="switch"]')!);
  else {
    const card = [...container.querySelectorAll('ul[aria-label="Alumni"] button')].find((b) => b.textContent?.includes(first.name));
    assert.ok(card, "the phone card is a button");
    await click(card);
  }
  for (let i = 0; i < 5; i++) await settle();

  const opened = document.querySelector('[role="dialog"] h2')?.textContent ?? null;
  await act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  return { name: first.name, opened };
}

for (const target of ["row", "name", "phone card"] as const) {
  test(`a click on an Alumni ${target} opens that person's fix panel`, async () => {
    await seedFixture();
    const r = await clickAlumnus(target);
    assert.equal(r.opened, r.name);
  });
}

test("a click on an Alumni row's Shown / Hidden switch opens no panel", async () => {
  await seedFixture();
  const r = await clickAlumnus("switch");
  assert.equal(r.opened, null);
});
