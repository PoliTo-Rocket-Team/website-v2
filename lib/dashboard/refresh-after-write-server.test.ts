// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement, type ReactElement } from "react";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import { applications, applicationStatuses } from "@/db/schema";
import type { OutreachRow } from "@/lib/outreach-list";
import { statusPill, type ApproverMove } from "./application-flow";
import { listedStatusOf } from "./application-status";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { ApplicationEntry, ApplicationsPage } from "./recruitment";
import { clearRefreshes, refreshes } from "./access-matrix/fakes/next-cache";
import { addRows, resetDatabase, tableRows } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs, viewAs } from "./access-matrix/session";

// Dashboard lists and panels show a save at once, with no reload (issue
// #984). A status change on the Applications page saves through the one
// server move, and once it lands it asks every dashboard page to read again,
// the same refresh every dashboard write asks for; a refused move asks for
// none and changes nothing. The page itself draws only what its props hold,
// so the fresh props that refresh brings are what the list row and the open
// side panel show. Run on the seeded matrix fixture and a migrated in-memory
// Postgres; the page is drawn in JSDOM.

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
window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
window.HTMLElement.prototype.scrollIntoView = () => {};
// The test database starts its Postgres engine with Node's own globals, so it starts before the page's globals take their place.
before(async () => {
  await resetDatabase();
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
});

/** What every landed dashboard write asks for: the whole dashboard reads again. */
const DASHBOARD = "/dashboard (layout)";

const NEW_APPLICATION = IDS.application("MA");
const INTERVIEW = IDS.interview("MA");
const LEAD = "division lead"; // leads Mission Analysis, so changes its Applications

const statusKeyOf = async (id: number) => (await tableRows(applications)).find((a) => a.id === id)!.statusKey;

async function applicationsPage(): Promise<ApplicationsPage> {
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data.applications();
}

beforeEach(async () => {
  await seedFixture();
  clearRefreshes();
});

describe("A status change refreshes the dashboard once it lands (issue #984)", () => {
  // Every kind of step the page offers: an action button, a hand pick of a built-in status, a hand pick of an added one.
  const steps: readonly { name: string; id: number; move: ApproverMove; lands: string }[] = [
    { name: "the Reject button", id: NEW_APPLICATION, move: { kind: "reject" }, lands: "rejected_email_to_be_sent" },
    { name: "the Accept button", id: INTERVIEW, move: { kind: "accept" }, lands: "accepted_email_to_be_sent" },
    { name: "a hand pick of a built-in status", id: NEW_APPLICATION, move: { kind: "pick", to: "nda_received" }, lands: "nda_received" },
    { name: "a hand pick of an added status", id: NEW_APPLICATION, move: { kind: "pick-added", key: "second_review" }, lands: "second_review" },
  ];
  for (const step of steps) {
    test(`${step.name} saves and asks every dashboard page to read again`, async () => {
      await addRows(applicationStatuses, [{ key: "second_review", name: "Second review", colour: "#FF5E00", sortOrder: 1, parentKey: "new" }]);
      signInAs(accountOf(LEAD).userId);
      assert.deepEqual(await recruitmentActions.moveApplication(step.id, step.move), { ok: true, value: null });
      assert.equal(await statusKeyOf(step.id), step.lands);
      assert.deepEqual(refreshes, [DASHBOARD]);
    });
  }

  test("a move made while viewing as the team leader refreshes the same way", async () => {
    viewAs(accountOf("team leader").userId, accountOf("IT lead").userId);
    assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "reject" }), { ok: true, value: null });
    assert.equal(await statusKeyOf(NEW_APPLICATION), "rejected_email_to_be_sent");
    assert.deepEqual(refreshes, [DASHBOARD]);
  });

  test("a refused move answers its error, writes nothing and refreshes nothing", async () => {
    signInAs(accountOf(LEAD).userId);
    // Mark email sent is no step of a New application.
    const answer = await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "mark-email-sent" });
    assert.equal(answer.ok, false);
    assert.ok(!answer.ok && answer.error.length > 0, "the refusal says why");
    assert.equal(await statusKeyOf(NEW_APPLICATION), "new");
    assert.deepEqual(refreshes, []);
  });
});

async function draw() {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const document = window.document;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const settle = async () => {
    for (let i = 0; i < 5; i++) await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  };
  return {
    container,
    /** Draws the element, as a server render hands the page new props. */
    render: async (element: ReactElement) => {
      await act(async () => root.render(element));
      await settle();
    },
    click: async (el: Element) => {
      await act(() => void el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
      await settle();
    },
    close: async () => {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

/** The applicant's card in the list, which keeps its status pill while the side panel is open. */
function cardOf(container: HTMLElement, a: ApplicationEntry): HTMLButtonElement {
  const card = [...container.querySelectorAll("ul li button")].find(
    (b) => b.closest("ul")?.className.includes("xl:hidden") && b.textContent?.includes(a.applicant.name),
  );
  assert.ok(card, `the list shows ${a.applicant.name}`);
  return card as HTMLButtonElement;
}

const labelOf = (page: ApplicationsPage, a: ApplicationEntry) => statusPill(a.state, listedStatusOf(page.statuses, a.status).name).label;
const panelText = () => window.document.querySelector('[role="dialog"]')?.textContent ?? "";

test("the Applications list row and the open side panel show the status the refreshed page brings, with no reload (issue #984)", async () => {
  signInAs(accountOf(LEAD).userId);
  const { ApplicationsView } = await import("@/components/dashboard/applications");
  const first = await applicationsPage();
  const before = first.applications.find((a) => a.id === NEW_APPLICATION)!;
  const view = await draw();
  await view.render(createElement(ApplicationsView, { page: first, initialPosition: null, lead: "Lead" }));
  await view.click(cardOf(view.container, before));
  assert.ok(cardOf(view.container, before).textContent?.includes(labelOf(first, before)), "the row starts at New");

  // The move lands, and the refresh it asked for hands the page fresh props.
  assert.deepEqual(await recruitmentActions.moveApplication(NEW_APPLICATION, { kind: "reject" }), { ok: true, value: null });
  const second = await applicationsPage();
  const after = second.applications.find((a) => a.id === NEW_APPLICATION)!;
  await view.render(createElement(ApplicationsView, { page: second, initialPosition: null, lead: "Lead" }));

  const shown = labelOf(second, after);
  const row = cardOf(view.container, after).textContent ?? "";
  const panel = panelText();
  await view.close();
  assert.notEqual(shown, labelOf(first, before));
  assert.ok(row.includes(shown), `the row shows ${shown}: ${row}`);
  assert.ok(panel.includes(listedStatusOf(second.statuses, after.status).name), "the open side panel shows the new status");
});

test("the Outreach list shows the rows a refresh brings, where it once kept the rows it first got (issue #984)", async () => {
  const { OutreachView } = await import("@/components/dashboard/outreach");
  const { blankPost } = await import("@/lib/outreach-post-fields");
  const row = (id: number, title: string): OutreachRow => ({
    id,
    slug: `post-${id}`,
    status: "draft",
    post: { ...blankPost("2026-11-01"), title },
  });
  const view = await draw();
  await view.render(createElement(OutreachView, { rows: [row(1, "First post")], tags: [], featured: [] }));
  assert.ok(view.container.textContent?.includes("First post"));
  assert.ok(!view.container.textContent?.includes("Second post"));

  await view.render(createElement(OutreachView, { rows: [row(2, "Second post"), row(1, "First post")], tags: [], featured: [] }));
  const text = view.container.textContent ?? "";
  await view.close();
  assert.ok(text.includes("Second post"), "a post saved elsewhere shows in the list at once");
});
