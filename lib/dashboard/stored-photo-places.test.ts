// The views import their server actions; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";
import { members, users } from "@/db/schema";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import { addRows, changeRows, resetDatabase } from "./access-matrix/test-database";
import { accountOf, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { MyApplications } from "./my-applications";
import type { Joining } from "./team";

// Issue #656: the seven dashboard places that drew a person as the PRT mark
// even when that person has a stored photo. Each place is rendered from what
// the database path answers wherever a stored photo can reach it, and driven
// as an editor drives it (a pick, a row opened), for the three stored
// pictures: a photo shows it; none, or an empty one, shows the PRT mark.

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

const PHOTO = "https://store.example/photo/stored.jpg";

/** The three stored pictures, and what a circle shows for each. */
const CASES = [
  { stored: PHOTO, shows: `photo ${PHOTO}`, label: "a stored photo shows it" },
  { stored: null, shows: "mark", label: "no stored photo shows the PRT mark" },
  { stored: "", shows: "mark", label: "an empty stored picture shows the PRT mark" },
] as const;

/** Person MA in Mission Analysis: the one every picker here finds and picks. */
const PICKED = { id: IDS.person("MA"), name: "Person MA" };
/** Structures' head, whom Edit department shows and Change head replaces. */
const HEAD = { id: 310, name: "Head Structures" };
const LEADER = accountOf("team leader");
const ALUMNUS = accountOf("alumnus with scope rows left over");

/** Seeds the fixture with `stored` as the picture of each member named. */
async function seedWith(stored: string | null, memberIds: readonly number[]): Promise<void> {
  await seedFixture();
  for (const memberId of memberIds) await changeRows(members, { memberId }, { picture: stored });
}

async function signedIn(userId: string): Promise<DashboardData> {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  return (opening as { data: DashboardData }).data;
}

async function mount(element: () => Promise<import("react").ReactElement>) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const document = window.document;
  // A test that failed left its panels behind; each place starts on an empty page.
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const shown = await element();
  await act(() => root.render(shown));
  const settle = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const click = (target: Element) =>
    act(() => {
      target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
  const button = (text: string): Element => {
    // A button may carry a short phone label before its own ("GiveGive access").
    const found = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().endsWith(text) || b.getAttribute("aria-label") === text);
    assert.ok(found, `a button "${text}"`);
    return found;
  };
  return {
    settle,
    click,
    press: (text: string) => click(button(text)),
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
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
      document.body.removeAttribute("style");
    },
  };
}

/** What a circle draws: `photo <src>` for a photo, `mark` for the PRT mark. */
function drawnBy(circle: Element): string {
  if (circle.tagName === "IMG") return `photo ${circle.getAttribute("src")}`;
  assert.ok(circle.querySelector("img")?.getAttribute("src")?.includes("prt-mark-white"), "the circle draws the PRT mark");
  return "mark";
}

/** An avatar: a photo <img>, or the span the mark sits in. */
const CIRCLE = 'img[aria-hidden="true"]:not([src*="prt-mark-white"]), span[aria-hidden="true"]:has(> img[src*="prt-mark-white"])';

/**
 * What the circles beside `name` draw, each read from the nearest box around
 * a place the name is written that holds one, once per distinct drawing: a
 * person drawn the same way everywhere reads as one entry.
 */
function circlesBeside(name: string, within: ParentNode = window.document): string[] {
  const named = [...within.querySelectorAll("span, p, h1, h2, h3")].filter((e) => e.textContent?.trim() === name && ![...e.children].some((c) => c.textContent?.trim() === name));
  assert.ok(named.length > 0, `${name} is shown`);
  const drawn = named.map((e) => {
    for (let box = e.parentElement; box !== null; box = box.parentElement) {
      const circle = box.querySelector(CIRCLE);
      if (circle) return drawnBy(circle);
    }
    assert.fail(`no circle beside ${name}`);
  });
  return [...new Set(drawn)];
}

function noEmptyImage(): void {
  assert.equal(window.document.querySelector('img[src=""]'), null, "no <img src=\"\">");
}

const NO_WRITE = async () => ({ ok: false as const, error: "not in this test" });

// 1. Edit team tree drawers (#656) and 2. the person picker's rows (#657)

for (const { stored, shows, label } of CASES) {
  test(`Hand over your role: the team leader and the person picked to take over; ${label}`, async () => {
    await seedWith(stored, [LEADER.memberId!, PICKED.id]);
    const data = await signedIn(LEADER.userId);
    const structure = (await data.teamStructure())!;
    const { createElement } = await import("react");
    const { TeamLeaderDrawer } = await import("@/components/dashboard/team-leader-drawer");
    const ui = await mount(async () => createElement(TeamLeaderDrawer, { open: true, leader: structure.leader!, onClose: () => {} }));
    assert.deepEqual(circlesBeside(structure.leader!.name), [shows], "the current team leader");
    const row = await ui.find(PICKED.name);
    assert.equal(drawnBy(row.querySelector(CIRCLE)!), shows, "the picker's row");
    await ui.click(row);
    assert.deepEqual(circlesBeside(PICKED.name), [shows], "the person who takes over");
    noEmptyImage();
    await ui.unmount();
  });

  test(`Change holder: the holder, the person picked and the holder they replace; ${label}`, async () => {
    await seedFixture();
    const holderId = (await (await signedIn(LEADER.userId)).teamStructure())!.board[0].holder.id;
    await seedWith(stored, [holderId, PICKED.id]);
    const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
    const seat = structure.board[0];
    const { createElement } = await import("react");
    const { SeatDrawer } = await import("@/components/dashboard/seat-drawers");
    const ui = await mount(async () => createElement(SeatDrawer, { target: { kind: "change", roleId: seat.roleId }, structure, onClose: () => {} }));
    assert.deepEqual(circlesBeside(seat.holder.name), [shows], "who holds the seat");
    await ui.press("Change holder");
    await ui.click(await ui.find(PICKED.name));
    assert.deepEqual(circlesBeside(seat.holder.name), [shows], "the holder replaced");
    assert.deepEqual(circlesBeside(PICKED.name), [shows], "the holder picked");
    noEmptyImage();
    await ui.unmount();
  });

  test(`New department: the head picked; ${label}`, async () => {
    await seedWith(stored, [PICKED.id]);
    const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
    const { createElement } = await import("react");
    const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
    const ui = await mount(async () => createElement(DepartmentDrawer, { target: { kind: "new" }, structure, onClose: () => {}, onTarget: () => {} }));
    await ui.press("Pick head");
    await ui.click(await ui.find(PICKED.name));
    assert.deepEqual(circlesBeside(PICKED.name), [shows]);
    noEmptyImage();
    await ui.unmount();
  });

  test(`Edit department: the head, the head picked and the head they replace; ${label}`, async () => {
    await seedWith(stored, [HEAD.id, PICKED.id]);
    const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
    const { createElement } = await import("react");
    const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
    const ui = await mount(async () => createElement(DepartmentDrawer, { target: { kind: "edit", departmentId: 2 }, structure, onClose: () => {}, onTarget: () => {} }));
    assert.deepEqual(circlesBeside(HEAD.name), [shows], "the head");
    await ui.press("Change head");
    await ui.click(await ui.find(PICKED.name));
    assert.deepEqual(circlesBeside(HEAD.name), [shows], "the head replaced");
    assert.deepEqual(circlesBeside(PICKED.name), [shows], "the new head");
    noEmptyImage();
    await ui.unmount();
  });

  test(`Close department: each person it moves; ${label}`, async () => {
    await seedWith(stored, [PICKED.id]);
    const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
    const { createElement } = await import("react");
    const { DepartmentDrawer } = await import("@/components/dashboard/department-drawers");
    const ui = await mount(async () => createElement(DepartmentDrawer, { target: { kind: "close", departmentId: 1 }, structure, onClose: () => {}, onTarget: () => {} }));
    assert.deepEqual(circlesBeside(PICKED.name), [shows]);
    noEmptyImage();
    await ui.unmount();
  });

  test(`New division: the lead and the member picked; ${label}`, async () => {
    await seedWith(stored, [PICKED.id]);
    const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
    const { createElement } = await import("react");
    const { DivisionDrawer } = await import("@/components/dashboard/division-drawer");
    const ui = await mount(async () =>
      createElement(DivisionDrawer, {
        target: { kind: "new", department: { id: 1, name: "Aerodynamics" } },
        takenCodes: structure.takenCodes,
        seats: structure.seats,
        editable: true,
        onClose: () => {},
        onFill: () => {},
        mayClose: () => false,
        onCloseDivision: () => {},
      }),
    );
    await ui.press("Add lead");
    await ui.click(await ui.find(PICKED.name));
    assert.deepEqual(circlesBeside(PICKED.name), [shows], "the lead picked");
    await ui.unmount();

    const again = await mount(async () =>
      createElement(DivisionDrawer, {
        target: { kind: "new", department: { id: 1, name: "Aerodynamics" } },
        takenCodes: structure.takenCodes,
        seats: structure.seats,
        editable: true,
        onClose: () => {},
        onFill: () => {},
        mayClose: () => false,
        onCloseDivision: () => {},
      }),
    );
    await again.press("Add member");
    await again.click(await again.find(PICKED.name));
    assert.deepEqual(circlesBeside(PICKED.name), [shows], "the member picked");
    noEmptyImage();
    await again.unmount();
  });
}

// 2. The person picker's box (#657), 3. the Access page (#658)

/** Person DM holds a Members grant in Design & Manufacturing: their row is on the team's Access page. */
const GRANTEE = { id: IDS.person("DM"), name: "Person DM" };

for (const { stored, shows, label } of CASES) {
  test(`Access: the phone card, the table row, the locked Person field and the picked person in the field; ${label}`, async () => {
    await seedWith(stored, [GRANTEE.id, PICKED.id]);
    const access = (await (await signedIn(LEADER.userId)).divisionAccess())!;
    const { createElement } = await import("react");
    const { DivisionAccessView } = await import("@/components/dashboard/division-access");
    const ui = await mount(async () => createElement(DivisionAccessView, { access, saveAccess: NO_WRITE, removeAllAccess: NO_WRITE, removeGrant: NO_WRITE }));
    // The phone card and the table row.
    assert.ok(window.document.querySelectorAll(`[aria-label^="${GRANTEE.name}"][aria-label$="Edit access"]`).length >= 2, "both the card and the row name them");
    assert.deepEqual(circlesBeside(GRANTEE.name), [shows]);
    await ui.click(window.document.querySelector(`[aria-label^="${GRANTEE.name}"][aria-label$="Edit access"]`)!);
    const field = [...window.document.querySelectorAll('[role="dialog"] div')].find((d) => d.querySelector('[aria-label="Locked"]') && d.textContent?.trim() === GRANTEE.name)!;
    assert.deepEqual(circlesBeside(GRANTEE.name, field), [shows], "the locked Person field");
    await ui.unmount();

    const giving = await mount(async () => createElement(DivisionAccessView, { access, saveAccess: NO_WRITE, removeAllAccess: NO_WRITE, removeGrant: NO_WRITE }));
    await giving.press("Give access");
    const row = await giving.find(PICKED.name);
    assert.equal(drawnBy(row.querySelector(CIRCLE)!), shows, "the field's row");
    await giving.click(row);
    const input = window.document.querySelector('[role="dialog"] [role="combobox"]')!;
    assert.equal(drawnBy(input.parentElement!.querySelector(CIRCLE)!), shows, "the person picked, in the field");
    noEmptyImage();
    await giving.unmount();
  });
}

// 4. The Members page (#659)

for (const { stored, shows, label } of CASES) {
  test(`Members: the "is joining" card; ${label}`, async () => {
    const { createElement } = await import("react");
    const { JoiningBanner } = await import("@/components/dashboard/division-members");
    const joining: Joining = { applicationId: 1, name: "Giulia Rossi", photoUrl: stored, position: "Mission Analyst", ndaArrived: true, canConfirm: true };
    const ui = await mount(async () => createElement("ul", null, createElement(JoiningBanner, { joining, division: "Mission Analysis", editable: true })));
    assert.deepEqual(circlesBeside("Giulia Rossi is joining"), [shows]);
    noEmptyImage();
    await ui.unmount();
  });

  test(`Add member: the person picked from the team; ${label}`, async () => {
    await seedWith(stored, [PICKED.id]);
    const structure = (await (await signedIn(LEADER.userId)).teamStructure())!;
    const division = structure.departments.find((d) => d.id === 2)!.divisions[0].page!.division;
    const { createElement } = await import("react");
    const { AddMemberDrawer } = await import("@/components/dashboard/member-panels");
    const ui = await mount(async () => createElement(AddMemberDrawer, { open: true, onOpenChange: () => {}, target: { kind: "division", division } }));
    await ui.click(await ui.find(PICKED.name));
    assert.deepEqual(circlesBeside(PICKED.name), [shows]);
    noEmptyImage();
    await ui.unmount();
  });
}

// 5. The Applications page (#660): an applicant with a member record shows its photo.

for (const { stored, shows, label } of CASES) {
  test(`Applications: the list row and the detail panel's header; ${label}`, async () => {
    await seedFixture();
    await addRows(members, [{ memberId: 900, ndaSignedAt: "2025-10-01", picture: stored }]);
    await changeRows(users, { id: "applicant-ma" }, { member: 900 });
    const page = await (await signedIn(LEADER.userId)).applications();
    const applicant = page.applications.find((a) => a.applicant.email === "appl-ma@mail.test")!;
    const { createElement } = await import("react");
    const { ApplicationsView } = await import("@/components/dashboard/applications");
    const ui = await mount(async () => createElement(ApplicationsView, { page, initialPosition: null, lead: "Viewer" }));
    // The table's row; the phone list's card draws no circle (board 58m).
    const listRow = [...window.document.querySelectorAll("li button")].find((b) => b.textContent?.includes(applicant.applicant.email) && b.querySelector(CIRCLE))!;
    assert.deepEqual(circlesBeside(applicant.applicant.name, listRow), [shows], "the list row");
    await ui.click(listRow);
    const panel = window.document.querySelector('[role="dialog"]')!;
    assert.deepEqual(circlesBeside(applicant.applicant.name, panel), [shows], "the detail panel's header");
    noEmptyImage();
    await ui.unmount();
  });
}

// 6. My account (#661) and 7. the applicant and alumni Overviews (#662)

for (const { stored, shows, label } of CASES) {
  test(`My account: the Sign-in card shows the photo the sidebar shows; ${label}`, async () => {
    await seedWith(stored, [ALUMNUS.memberId!]);
    const data = await signedIn(ALUMNUS.userId);
    const account = (await data.myAccount())!;
    assert.equal(account.photoUrl, data.viewer.photoUrl, "the sidebar's photo");
    const { createElement } = await import("react");
    // The card as My account draws it; the page around it signs out through the app router.
    const { SignInCard } = await import("@/components/dashboard/account-parts");
    const ui = await mount(async () => createElement(SignInCard, { account }));
    assert.deepEqual(circlesBeside(account.name), [shows]);
    noEmptyImage();
    await ui.unmount();
  });

  test(`The alumni Overview's header shows the viewer's photo; ${label}`, async () => {
    await seedWith(stored, [ALUMNUS.memberId!]);
    const data = await signedIn(ALUMNUS.userId);
    const [mine, me] = await Promise.all([data.myApplications(), data.myAlumni()]);
    const { createElement } = await import("react");
    const { alumniOverview } = await import("./my-alumni");
    const { OverviewView } = await import("@/components/dashboard/overview");
    const ui = await mount(async () => createElement(OverviewView, { overview: alumniOverview(data.viewer, me!, mine!) }));
    assert.deepEqual(circlesBeside(data.viewer.name), [shows]);
    noEmptyImage();
    await ui.unmount();
  });

  test(`The applicant Overview's header shows the viewer's photo; ${label}`, async () => {
    // Only someone with a member record has a stored photo, so the viewer is given here as `DashboardViewer` carries it.
    const viewer = { name: "Chiara Rinaldi", photoUrl: stored };
    const mine: MyApplications = { firstName: "Chiara", email: "chiara@example.com", active: [], past: [] };
    const { createElement } = await import("react");
    const { applicantOverview } = await import("./applicant-overview");
    const { OverviewView } = await import("@/components/dashboard/overview");
    const ui = await mount(async () => createElement(OverviewView, { overview: applicantOverview(viewer, mine) }));
    assert.deepEqual(circlesBeside(viewer.name), [shows]);
    noEmptyImage();
    await ui.unmount();
  });
}
