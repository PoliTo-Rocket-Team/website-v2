import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { canReach } from "@/lib/dashboard/access";
import { mayOpenApplication } from "@/lib/dashboard/application-documents";
import { DashboardRefused, type DashboardData } from "@/lib/dashboard/data";
import { placeKey, placesOf } from "@/lib/dashboard/division-access";
import { ledDivisionsOf } from "@/lib/dashboard/team";
import { showsTreeEdit } from "@/lib/dashboard/team-structure";
import { isOffTeam, readsArea, TEST_VIEWERS, type DashboardViewer, type TestViewer } from "@/lib/dashboard/viewer";
import { maySiteContent } from "@/lib/content/gate";
import type { Upload } from "@/lib/dashboard/write";
import { fieldsOf } from "@/lib/project-content/fields";
import { importedRecords } from "@/lib/project-content/import";
import { NO_CONTENT_EDITS_STORE } from "./content-edits";
import { NO_TEAM_EDITS } from "./edits";
import { dummyDashboardData } from "./index";
import { NO_OUTREACH_EDITS_STORE } from "./outreach";
import { NO_OWN_STORE } from "./own";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { divisions, personFor } from "./team";
import { TEST_GRANTS, type TestGrant } from "./test-grant";

// The test-developer path against the access matrix (issue #477,
// lib/dashboard/access-matrix.test.ts): every loader and write of the dummy
// data interface, called as each test viewer, answers what the domain rules
// say that viewer reaches. Where the viewer is out of scope, a read answers a
// refusal or nothing, and a write is refused and saves nothing: every store
// below records each save, and an out-of-scope write must leave it empty.

type Session = { readonly data: DashboardData; readonly viewer: DashboardViewer; readonly saved: string[] };

function session(viewer: TestViewer, grant: TestGrant | null = null): Session {
  const saved: string[] = [];
  const spy = <T extends { current: unknown }>(name: string, store: T): T => ({ ...store, save: async () => void saved.push(name) });
  const data = dummyDashboardData(
    viewer,
    spy("recruitment", { current: dummyRecruitmentOf(undefined), save: async () => {} }),
    spy("positions and applications", { current: EMPTY_DUMMY_STATE, save: async () => {} }),
    spy("team", NO_TEAM_EDITS),
    spy("own pages", NO_OWN_STORE),
    "sample",
    spy("partners", NO_CONTENT_EDITS_STORE),
    spy("faq", NO_CONTENT_EDITS_STORE),
    spy("outreach", NO_OUTREACH_EDITS_STORE),
    spy("team page", NO_CONTENT_EDITS_STORE),
    spy("advisors", NO_CONTENT_EDITS_STORE),
    spy("projects", NO_CONTENT_EDITS_STORE),
    grant,
  );
  return { data, viewer: data.viewer, saved };
}

/** Every test viewer, and the member holding each test grant. */
const SESSIONS: readonly { readonly name: string; readonly open: () => Session }[] = [
  ...TEST_VIEWERS.map((viewer) => ({ name: viewer, open: () => session(viewer) })),
  ...TEST_GRANTS.map((grant) => ({ name: `member with ${grant}`, open: () => session("member", grant) })),
];

const PHOTO: Upload = { name: "photo.jpg", contentType: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff]) };

async function refusedWith(run: () => Promise<unknown>): Promise<"refused" | "allowed"> {
  try {
    const result = await run();
    if (result === false || result === null) return "refused";
    if (typeof result === "object" && result !== null && "ok" in result) return result.ok ? "allowed" : "refused";
    if (typeof result === "object" && result !== null && "status" in result) return result.status === "refused" ? "refused" : "allowed";
    if (typeof result === "object" && result !== null && "kind" in result && result.kind === "none") return "refused";
    return "allowed";
  } catch (error) {
    if (error instanceof DashboardRefused) return "refused";
    throw error;
  }
}

/** Every position and application on the team, as full access reads them. */
async function wholeTeam() {
  const { data } = session("team-leader");
  const [positions, applications] = await Promise.all([data.positions(), data.applications()]);
  return { positions: positions.positions, applications: applications.applications };
}

describe("the test-developer path follows the access matrix", () => {
  for (const { name, open } of SESSIONS) {
    test(`${name}: reads`, async () => {
      const { data, viewer } = open();
      const offTeam = isOffTeam(viewer.kind);

      // Overview: built from the viewer's own pages off the team, so the team's Overview refuses them.
      assert.equal(await refusedWith(() => data.overview()), offTeam ? "refused" : "allowed", "overview");

      // Positions and Applications, the badge, and every CV and letter link.
      for (const area of ["positions", "applications"] as const) {
        assert.equal(await refusedWith(() => data[area]()), readsArea(viewer, area) ? "allowed" : "refused", area);
      }
      if (!readsArea(viewer, "applications")) assert.deepEqual(await data.navCounts(), {}, "badge");
      // A role's application counts are Applications data: only on a role the viewer's Applications page lists (issue #477).
      if (readsArea(viewer, "positions")) {
        const tallied = readsArea(viewer, "applications") ? new Set((await data.applications()).positions.map((p) => p.ref)) : new Set<string>();
        for (const row of (await data.positions()).positions) assert.equal(row.applications !== null, tallied.has(row.ref), `counts on ${row.ref}`);
      }
      const team = await wholeTeam();
      const listed = readsArea(viewer, "applications") ? new Set((await data.applications()).applications.map((a) => a.id)) : new Set<number>();
      for (const application of team.applications) {
        for (const kind of ["cv", "motivation-letter"] as const) {
          const opened = await refusedWith(async () => (await data.applicationDocument(application.id, kind)) ?? "no file");
          assert.equal(opened, listed.has(application.id) ? "allowed" : "refused", `${kind} of application ${application.id}`);
        }
      }

      // Members, its pickers, the Team tree's edit view, Access and Orders.
      const members = await data.members();
      assert.equal(members.scope === "none", !canReach(viewer, "members"), "members");
      if (members.scope === "division" && !readsArea(viewer, "applications")) assert.deepEqual(members.joining, [], "applicants joining, without Applications");
      if (!showsTreeEdit(viewer)) {
        assert.equal(await data.teamStructure(), null, "team structure");
        assert.deepEqual(await data.findPeople("a"), { kind: "none" }, "people picker");
      }
      if (!canReach(viewer, "members")) assert.deepEqual(await data.findForAdd(1, "a"), { kind: "none" }, "add member");
      assert.equal((await data.divisionAccess()) === null, !canReach(viewer, "division-access"), "access");
      const orders = await data.orders();
      if (orders !== null) assert.ok(canReach(viewer, "orders"), "an Orders page the viewer does not reach");
      if (!canReach(viewer, "orders")) assert.equal(orders, null, "orders");

      // The Alumni page, the Team tree, and the site's content.
      const alumni = await data.alumni();
      assert.equal(alumni.rows.length === 0, !canReach(viewer, "alumni"), "alumni");
      // Off the team, the Team tree lists nobody: not even the division lead.
      if (offTeam) assert.equal(JSON.stringify(await data.teamTree()).includes(personFor["division-lead"].name), false, "team tree people");
      const content = await Promise.all([
        data.partners.list(),
        data.faqs.list(),
        data.teamPage.open(),
        data.teamAdvisors.list(),
        data.outreach.posts.list(),
        data.outreach.summit(),
        data.outreach.tags(),
        data.projects.board(),
        data.projects.list(),
      ]);
      for (const [i, read] of content.entries()) assert.equal(read === null, !maySiteContent(viewer), `content read ${i}`);

      // The viewer's own pages.
      assert.equal((await data.myAlumni()) === null, viewer.kind !== "alumni", "my alumni");
      assert.equal((await data.myProfile()) === null, offTeam, "my profile");
      assert.equal((await data.myAccount()) === null, !offTeam, "my account");
    });

    test(`${name}: out-of-scope writes are refused and save nothing`, async () => {
      const { data, viewer, saved } = open();
      const team = await wholeTeam();
      const writes: [string, () => Promise<unknown>][] = [];

      // Positions and applications the viewer does not list.
      const ownPositions = readsArea(viewer, "positions") ? new Set((await data.positions()).positions.map((p) => p.id)) : new Set<number>();
      const ownApplications = readsArea(viewer, "applications") ? new Set((await data.applications()).applications.map((a) => a.id)) : new Set<number>();
      for (const position of team.positions.filter((p) => !ownPositions.has(p.id))) {
        writes.push([`open position ${position.id}`, () => data.setPositionOpen(position.id, !position.open)]);
        writes.push([`edit position ${position.id}`, () => data.editPosition(position.id, { title: "x" })]);
      }
      for (const application of team.applications.filter((a) => !ownApplications.has(a.id))) {
        writes.push([`move application ${application.id}`, () => data.moveApplication(application.id, { kind: "reject" })]);
      }
      if (!readsArea(viewer, "positions")) writes.push(["new position", () => data.createPosition({ divisionId: 1, title: "x", description: "x", required: ["x"] })]);
      if (!(await data.recruitment()).canSwitch) writes.push(["recruitment switch", () => data.setRecruitment({ isOpen: false })]);

      // Access and Orders.
      if (!canReach(viewer, "division-access")) {
        writes.push(["give access", () => data.saveAccess({ personId: 1, areas: { positions: "edit" } })]);
        writes.push(["remove access", () => data.removeAllAccess(1)]);
        writes.push(["remove one grant", () => data.removeGrant({ personId: 1, where: 1, target: "positions" })]);
      }
      if ((await data.orders()) === null) {
        writes.push(["new order", () => data.placeOrder({ item: "x", link: "https://example.com", price: "1", quantity: "1", reason: "x", division: "1" }, null)]);
        writes.push(["edit order", () => data.editOrder(1, { item: "x", link: "https://example.com", price: "1", quantity: "1", reason: "x" }, null)]);
        writes.push(["cancel order", () => data.cancelOrder(1)]);
        writes.push(["decide order", () => data.decideOrder(1, { kind: "approve" })]);
        writes.push(["mark ordered", () => data.markOrdered(1)]);
      }
      if (viewer.kind !== "operations-lead") writes.push(["Approve orders", () => data.setApproveOrders({ personId: 1, holds: true })]);

      // The Members page, the Team tree's edit view and the Alumni page.
      const writesTeam = data.teamWrites!;
      if (!canReach(viewer, "members")) {
        writes.push(["save member", () => writesTeam.saveMember(2, { role: null, pageTitle: "x" })]);
        writes.push(["promote", () => writesTeam.promote(2, { mode: "together" } as never)]);
        writes.push(["move to alumni", () => writesTeam.moveToAlumni(2, { from: 2024, to: 2025, reason: null })]);
        writes.push(["confirm join", () => writesTeam.confirmJoin(team.applications[0].id)]);
        writes.push(["add member", () => writesTeam.addMember({ divisionId: 1, kind: "email", email: "new@example.com" })]);
        writes.push(["confirm NDA", () => writesTeam.confirmNda(100)]);
        writes.push(["cancel add", () => writesTeam.cancelAdd(100)]);
        writes.push(["remove from division", () => writesTeam.removeFromDivision(2, 1)]);
        writes.push(["member details", () => writesTeam.saveMemberDetails({ kind: "member", personId: 2 } as never, 1, {})]);
        writes.push(["member photo", () => writesTeam.setMemberPhoto(2, 1, null)]);
      }
      if (!showsTreeEdit(viewer)) {
        writes.push(["new division", () => writesTeam.createDivision(1, { name: "X", code: "X", leads: [], members: [] })]);
        writes.push(["edit division", () => writesTeam.saveDivision(1, { name: "X", code: "X", leads: [], members: [] })]);
        writes.push(["close division", () => writesTeam.closeDivision(1)]);
        writes.push(["new department", () => writesTeam.createDepartment({ name: "X", code: "X", kind: "technical", headId: 2 })]);
        writes.push(["edit department", () => writesTeam.saveDepartment(1, { name: "X", code: "X" })]);
        writes.push(["close department", () => writesTeam.closeDepartment(1, {})]);
        writes.push(["hand over team leader", () => writesTeam.handOverTeamLeader({ to: 2, then: "leave" })]);
      }
      if (!canReach(viewer, "alumni")) {
        writes.push(["alumnus shown", () => writesTeam.setAlumnusShown("m1" as never, false)]);
        writes.push(["fix alumnus", () => writesTeam.fixAlumnus("m1" as never, {})]);
        writes.push(["alumnus photo", () => writesTeam.setAlumnusPhoto("m1" as never, null)]);
        writes.push(["add advisor", () => writesTeam.addAdvisor({ name: "X" }, null)]);
      }

      // The site's content: every write behind the site-content gate answers its refusal.
      if (!maySiteContent(viewer)) {
        const content: [string, () => Promise<unknown>][] = [
          ["partner save", () => data.partners.save(null, "save-draft", {} as never, null, undefined)],
          ["partner remove", () => data.partners.remove(1)],
          ["partner reorder", () => data.partners.reorder("main", [])],
          ["partner logo", () => data.partners.measure(PHOTO)],
          ["faq save", () => data.faqs.save(null, "save-draft", { question: "q", answer: ["a"] })],
          ["faq remove", () => data.faqs.remove(1)],
          ["faq reorder", () => data.faqs.reorder([])],
          ["team page save", () => data.teamPage.save("save-draft", {}, [])],
          ["team page reset", () => data.teamPage.reset()],
          ["team page photo", () => data.teamPage.uploadPhoto(PHOTO)],
          ["advisors save", () => data.teamAdvisors.save("save-draft", [])],
          ["end advising", () => data.teamAdvisors.end(1, 1)],
          ["outreach post", () => data.outreach.savePost(null, "save-draft", {} as never)],
          ["outreach unpublish", () => data.outreach.posts.unpublish(1)],
          ["outreach delete", () => data.outreach.posts.remove(1)],
          ["outreach tag", () => data.outreach.addTag("x")],
          ["outreach photo", () => data.outreach.uploadPhoto(PHOTO)],
          ["outreach discard", () => data.outreach.discardPhoto("x")],
          ["outreach summit", () => data.outreach.saveSummit("save-draft", async () => ({ ok: false, error: "never asked" }))],
          ["outreach pin", () => data.outreach.pin(1)],
          ["outreach unpin", () => data.outreach.unpin()],
          ["project save", () => data.projects.saveFields(1, "save-draft", fieldsOf(importedRecords[0]))],
          ["project new", () => data.projects.create({} as never)],
          ["project order", () => data.projects.setSiteOrder([])],
          ["project photo", () => data.projects.uploadPhoto(PHOTO)],
          ["project discard", () => data.projects.discardPhoto("x")],
        ];
        for (const [what, run] of content) assert.deepEqual(await run(), { ok: false, error: SITE_CONTENT_REFUSAL }, what);
      }

      // The viewer's own pages: an alumnus's entry, and the team's own profile.
      if (viewer.kind !== "alumni") {
        writes.push(["my alumni shown", () => data.setMyAlumniShown(false)]);
        writes.push(["my alumni photo", () => data.setMyAlumniPhoto(null)]);
      }
      if (isOffTeam(viewer.kind)) {
        writes.push(["LinkedIn", () => data.saveLinkedin("https://www.linkedin.com/in/x")]);
        writes.push(["photo", () => data.setPhoto(null)]);
        writes.push(["leave the team", () => data.leaveTeam("", false)]);
        writes.push(["hand over", () => data.sendHandOver({})]);
      }
      writes.push(["someone else's notice", () => data.dismissNotice(999_999)]);
      writes.push(["someone else's hand-over", () => data.answerHandOver(999_999, "confirm")]);
      writes.push(["someone else's application", () => data.withdrawApplication(999_999)]);
      writes.push(["someone else's interview", () => data.chooseInterviewSlot(999_999, 1)]);

      for (const [what, run] of writes) assert.equal(await refusedWith(run), "refused", `${name}: ${what}`);
      assert.deepEqual(saved, [], `${name}: an out-of-scope write saved something`);
    });
  }

  test("the page and the CV link agree on the test-developer path, as on the database side", async () => {
    const { applications } = await wholeTeam();
    for (const { open } of SESSIONS) {
      const { data, viewer } = open();
      if (!readsArea(viewer, "applications")) continue;
      const listed = new Set((await data.applications()).applications.map((a) => a.id));
      for (const a of applications) {
        const opened = await refusedWith(async () => (await data.applicationDocument(a.id, "cv")) ?? "no file");
        assert.equal(opened === "allowed", listed.has(a.id));
      }
    }
    assert.equal(mayOpenApplication({ kind: "member", grantedAreas: ["members"], siteContent: false, approveOrders: false, roles: [], grants: [] }, null), false);
  });

  test("a lead's Access page covers only the divisions they lead by role, and a Save naming another is refused (Owner decision, #478; #488)", async () => {
    const lead = personFor["division-lead"];
    const led = ledDivisionsOf(lead.placement);
    const { data, saved } = session("division-lead");
    const page = await data.divisionAccess();
    assert.ok(page !== null && page.unit.kind === "division", "the lead has a division Access page");
    assert.deepEqual(placesOf(page.unit).map(placeKey), led, "the unit is the led divisions, home first");
    const others = divisions.filter((d) => !led.includes(d.id));
    assert.ok(others.length > 0, "a division the lead does not lead, so the check below is not empty");
    const someone = page.people[0];
    assert.ok(someone !== undefined, "someone the lead may give access to");
    for (const other of others) {
      assert.equal(await refusedWith(() => data.saveAccess({ personId: someone.id, where: other.id, areas: { positions: "view" } })), "refused", `give access in ${other.name}`);
    }
    assert.deepEqual(saved, [], "a refused Save saved something");
  });

  test("a Members grant lists no applicant joining: that is Applications data (issue #477)", async () => {
    const lead = await session("division-lead").data.members();
    assert.equal(lead.scope, "division");
    if (lead.scope === "division") assert.ok(lead.joining.length > 0, "the lead's page lists someone joining, so the check below is not empty");
    for (const grant of TEST_GRANTS) {
      const page = await session("member", grant).data.members();
      assert.notEqual(page.scope, "none", grant);
      if (page.scope === "division") assert.deepEqual(page.joining, [], grant);
    }
  });
});
