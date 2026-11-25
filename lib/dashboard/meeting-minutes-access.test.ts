import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canReach, sidebarFor } from "./access";
import { fake, installFakes } from "./access-matrix/hooks";
import { BREAK_GLASS_STANDING, GRANT_AREAS, standingOf, viewerStandingOf, type ActiveRoleRef, type ScopeRef, type ViewerStanding } from "./viewer";

// Who opens Meeting Minutes & Requests, from the active roles and scope rows
// up to the page itself, asked for by its address. No database: the page's
// one read, `openDashboard`, answers the viewer each case names.

let page: () => Promise<ReactElement | null>;
let open: typeof import("./access-matrix/fakes/open-dashboard");

before(async () => {
  installFakes({ "server-only": fake("server-only.ts"), "@/lib/dashboard/open": fake("open-dashboard.ts") });
  open = await import(fake("open-dashboard.ts"));
  // The page is a Suspense around the component that checks and renders.
  const Page = (await import("../../app/dashboard/meeting-minutes/page")).default;
  const suspense = Page() as ReactElement<{ children: ReactElement<object, () => Promise<ReactElement | null>> }>;
  page = () => suspense.props.children.type();
});

const role = (type: ActiveRoleRef["type"], at: Partial<ActiveRoleRef> = {}): ActiveRoleRef => ({ type, divisionId: null, divisionCode: null, divisionClosedAt: null, fullAccess: null, ...at });
const lead = role("lead", { divisionId: 1, divisionCode: "MSA" });
const head = role("head");
const core = role("core", { divisionId: 1, divisionCode: "MSA" });
const logistics = role("lead", { divisionId: 15, divisionCode: "LGS" });
const teamLeader = role("president");
const pm = role(null, { fullAccess: "project-manager" });
const ce = role(null, { fullAccess: "chief-engineer" });
// As the data holds them: the flag is on the seat's own lead or head row.
const itLead = role("lead", { divisionId: 17, divisionCode: "ITC", fullAccess: "it-lead" });
const opsLead = role("head", { fullAccess: "operations-lead" });
const org: ScopeRef = { scope: "org", target: "all", level: "edit" };
const admin: ScopeRef = { scope: "admin", target: "all", level: "edit" };
const extras: readonly ScopeRef[] = [
  ...GRANT_AREAS.map((target): ScopeRef => ({ scope: "division", target, level: "edit" })),
  { scope: "department", target: "all", level: "edit" },
  { scope: "website", target: "content", level: "edit" },
  { scope: "team", target: "approve_orders", level: "edit" },
];

const of = (activeRoles: readonly ActiveRoleRef[], scopes: readonly ScopeRef[] = [], onAlumniRecord = false) => viewerStandingOf({ activeRoles, scopes, onAlumniRecord });

const CASES: readonly [string, ViewerStanding, boolean][] = [
  ["team leader", of([teamLeader]), true],
  ["Project Manager", of([pm]), true],
  ["Chief Engineer", of([ce]), true],
  ["department head", of([head]), true],
  ["division lead", of([lead]), true],
  ["department head with every grant", of([head], extras), true],
  ["division lead with every grant", of([lead], extras), true],
  ["operations lead", of([opsLead]), true],
  ["IT lead", of([itLead]), true],
  ["Logistics lead", of([logistics]), true],
  ["operations lead, IT lead and Logistics lead at once", of([opsLead, itLead, logistics]), true],
  ["operations lead with every grant", of([opsLead], extras), true],
  ["IT lead with an org row", of([itLead], [org]), true],
  ["Logistics lead with an admin row", of([logistics], [admin]), true],
  ["IT lead who is a member elsewhere", of([itLead, core]), true],
  ["member", of([core]), false],
  ["advisor", of([role("advisor")]), false],
  ["member with every grant", of([core], extras), false],
  ["member with an org row", of([core], [org]), true],
  ["member with an admin row", of([core], [admin]), true],
  ["alumnus with an admin row left over", of([], [admin], true), false],
  ["non-member with an org row left over", of([], [org]), false],
  ["no member row", viewerStandingOf(null), false],
  ["break-glass admin", BREAK_GLASS_STANDING, true],
  ["member with an org row at Can view", of([core], [{ ...org, level: "view" }]), true],
  ["member with an org row on one area", of([core], [{ ...org, target: "positions" }]), true],
  ["advisor with an org row, as a former team leader keeps", of([role("advisor")], [org]), true],
  // Someone in two of these.
  ["division lead with an org row", of([lead], [org]), true],
  ["department head with an admin row", of([head], [admin]), true],
  ["IT lead who is also Project Manager", of([itLead, pm]), true],
  ["operations lead who is also Chief Engineer", of([opsLead, ce]), true],
  ["IT lead who also leads another division", of([itLead, lead]), true],
  ["operations lead who also heads another department", of([opsLead, head]), true],
  ["Logistics lead who also leads another division", of([logistics, lead]), true],
  ["Logistics lead who also heads a department", of([logistics, head]), true],
  ["Project Manager with an org row", of([pm], [org]), true],
  ["IT lead and Project Manager with an org row", of([itLead, pm], [org]), true],
  ["Logistics lead who is also team leader", of([logistics, teamLeader]), true],
  ["lead of a closed Logistics, who holds no Logistics seat", of([{ ...logistics, divisionClosedAt: "2026-09-30" }]), true],
];

for (const [who, standing, admitted] of CASES) {
  test(`${who}: ${admitted ? "reaches" : "does not reach"} the page, by the rule, the sidebar and the address`, async () => {
    // The dashboard hands a page and the sidebar `standingOf`, never the raw identity.
    const viewer = standingOf(standing);
    assert.deepEqual(viewer, standing, "standingOf keeps every fact the rule reads");
    assert.equal(canReach(viewer, "meeting-minutes"), admitted);
    const listed = sidebarFor(viewer, { counts: {}, hasShownApplications: true }).some((s) => s.items.some((i) => i.key === "meeting-minutes"));
    assert.equal(listed, admitted);
    open.openAs(viewer);
    if (admitted) {
      const html = renderToStaticMarkup((await page())!);
      assert.match(html, /drive\.google\.com/);
      assert.match(html, /docs\.google\.com/);
    } else {
      await assert.rejects(page(), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    }
  });
}

test("a break-glass account is admitted whatever roles its person holds, none included, by the rule, the sidebar and the address", async () => {
  for (const held of [of([]), of([core]), of([teamLeader, lead]), of([pm]), of([head]), of([itLead, lead], [org])]) {
    // `readIdentity` (./database.ts) spreads the break-glass standing last, over the held roles.
    const identity = { ...held, ...BREAK_GLASS_STANDING } as ViewerStanding;
    for (const viewer of [identity, standingOf(identity)]) {
      assert.equal(canReach(viewer, "meeting-minutes"), true);
      const listed = sidebarFor(viewer, { counts: {}, hasShownApplications: true }).some((s) => s.items.some((i) => i.key === "meeting-minutes"));
      assert.equal(listed, true);
      open.openAs(viewer);
      assert.match(renderToStaticMarkup((await page())!), /drive\.google\.com/);
    }
  }
});

test("signed out goes to sign-in and back; an account that did not resolve gets nothing", async () => {
  open.openClosed("signed-out");
  await assert.rejects(page(), (error: { digest?: string }) => /^NEXT_REDIRECT;.*\/login\?cb=\/dashboard\/meeting-minutes;/.test(error.digest ?? ""));
  open.openClosed("account-unresolved");
  assert.equal(await page(), null);
});
