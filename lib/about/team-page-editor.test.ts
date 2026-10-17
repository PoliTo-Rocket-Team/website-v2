import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { statusOf, type ContentItem } from "@/lib/content/versioned";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { refused } from "@/lib/dashboard/write";
import { dummyTeamRoles } from "@/lib/dummy-data/team-page";
import { advisorRowsOf, type AdvisorRow, type AdvisorVersion } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { addLeader, applyLayer, NO_TEAM_LAYER, type AddedDepartment, type TeamPageLayer } from "./team-layer";
import { hideHead } from "./team-page-add";
import { HEADS_FULL, publicTeamPage, SECTION_EMPTY, teamPageEditor, type TeamPageStore } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import { team } from "./team";
import { HEADS_SHOWN_MAX, headsShown, teamBuildOf, teamPageFromRoles } from "./team-roles";

// The Team page's visual layer and advisors as the editor saves them (issues
// #283 and #321): Save draft never reaches the public page, Publish does,
// Reset to team is a draft, every write passes the site-content gate, the
// layer and the advisors land together or not at all, and a layer the page
// cannot draw as edited is refused.

const roles = dummyTeamRoles();
const build = teamBuildOf(roles);
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const siteContent: ViewerStanding = { kind: "member", siteContent: true, approveOrders: false };

const renamed: TeamPageLayer = { ...NO_TEAM_LAYER, leader: { role: "President" }, intro: "Edited intro." };

function editorOver(viewer: ViewerStanding, seed: ContentItem<TeamPageLayer>[] = []) {
  const layer = memoryContentStore(seed);
  const advisors = memoryContentStore<AdvisorVersion>(importedAdvisors());
  const store = memoryTeamPageStore(layer, advisors);
  return { layer, advisors, store, editor: teamPageEditor(viewer, store, async () => roles, team) };
}

/** The advisors as the panel holds them, unchanged. */
const rowsOf = async (store: TeamPageStore): Promise<AdvisorRow[]> => advisorRowsOf(await store.advisors());

const publicPage = async (store: TeamPageStore) => publicTeamPage(roles, team, await store.layer.list());

test("with no layer saved, the public page is the roles build", async () => {
  const { store } = editorOver(admin);
  assert.deepEqual(await publicPage(store), teamPageFromRoles(roles, team));
});

test("Save draft never changes the public page; Publish does; the public page reads only the published layer", async () => {
  const { store, editor } = editorOver(siteContent);
  const before = await publicPage(store);

  const drafted = await editor.save("save-draft", renamed, await rowsOf(store));
  assert.ok(drafted.ok);
  assert.equal(statusOf(drafted.value.layer), "draft");
  assert.deepEqual(await publicPage(store), before, "a draft never reaches the public page");
  // The editor opens on the draft, laid on the roles build.
  const opened = await editor.open();
  assert.equal(opened?.status, "draft");
  assert.equal(opened?.page.orgChart.leader.role, "President");

  const published = await editor.save("publish", renamed, await rowsOf(store));
  assert.ok(published.ok);
  const after = await publicPage(store);
  assert.equal(after.orgChart.leader.role, "President");
  assert.equal(after.header.intro, "Edited intro.");

  // A new draft over the published layer leaves the public page on the published one.
  const again = await editor.save("save-draft", { ...renamed, leader: { role: "Chair" } }, await rowsOf(store));
  assert.ok(again.ok);
  assert.equal(statusOf(again.value.layer), "draft-changes");
  assert.equal((await publicPage(store)).orgChart.leader.role, "President");
  assert.equal((await editor.open())?.page.orgChart.leader.role, "Chair");
});

test("Save draft and Publish write the layer and the advisors together, and answer both as stored", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const added: AdvisorRow = { id: null, fields: { name: "Prof. Ada Rossi", role: "Propulsion", standing: "specialist", photo: null, linkedin: "", email: "" } };
  const saved = await editor.save("publish", renamed, [...rows, added]);
  assert.ok(saved.ok);
  assert.equal(statusOf(saved.value.layer), "published");
  assert.deepEqual(saved.value.advisors, await store.advisors());
  assert.ok(saved.value.advisors.some((a) => a.version.state === "published" && a.version.published.name === "Prof. Ada Rossi"));
  assert.equal((await publicPage(store)).orgChart.leader.role, "President");
});

test("Reset to team is a draft with only the intro text and the group photo kept; the public page changes on Publish", async () => {
  const { store, editor } = editorOver(admin);
  const layer: TeamPageLayer = { ...renamed, groupPhoto: { src: "/team/team-2026.jpg", alt: "The team" } };
  assert.ok((await editor.save("publish", layer, await rowsOf(store))).ok);
  const advisorsBefore = await store.advisors();

  const reset = await editor.reset();
  assert.ok(reset.ok);
  assert.equal(statusOf(reset.value), "draft-changes");
  assert.equal((await publicPage(store)).orgChart.leader.role, "President", "the live page keeps the published layer");
  assert.deepEqual(await store.advisors(), advisorsBefore, "Reset to team never reaches the advisors");
  const opened = await editor.open();
  assert.deepEqual(opened?.layer, { ...NO_TEAM_LAYER, intro: "Edited intro.", groupPhoto: layer.groupPhoto });

  assert.ok((await editor.save("publish", opened!.layer, await rowsOf(store))).ok);
  const live = await publicPage(store);
  assert.equal(live.orgChart.leader.role, teamPageFromRoles(roles, team)?.orgChart.leader.role);
  assert.equal(live.header.intro, "Edited intro.");
  assert.deepEqual(live.coreMembers.groupPhoto, layer.groupPhoto);
});

test("every write path is refused without the site-content permission, and stores nothing", async () => {
  const published: ContentItem<TeamPageLayer>[] = [{ id: 1, siteOrder: 1, version: { state: "published", published: renamed, draft: null } }];
  const refusedViewers: ViewerStanding[] = [
    { kind: "non-member", siteContent: false, approveOrders: false },
    ...VIEWER_KINDS.filter((kind) => kind !== "operations-lead" && kind !== "non-member").map(
      (kind) => ({ kind, siteContent: false, approveOrders: false }) as ViewerStanding,
    ),
  ];
  for (const viewer of refusedViewers) {
    const { store, editor } = editorOver(viewer, published);
    const rows = await rowsOf(store);
    const advisors = await store.advisors();
    assert.equal(await editor.open(), null, viewer.kind);
    assert.equal((await editor.save("save-draft", NO_TEAM_LAYER, rows)).ok, false, viewer.kind);
    assert.equal((await editor.save("publish", NO_TEAM_LAYER, rows)).ok, false, viewer.kind);
    assert.equal((await editor.reset()).ok, false, viewer.kind);
    assert.deepEqual(await store.layer.list(), published, `${viewer.kind}: no layer stored`);
    assert.deepEqual(await store.advisors(), advisors, `${viewer.kind}: no advisor stored`);
  }
});

test("a save is refused when it is not a layer, or when it puts more than eight on the arc", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  assert.equal((await editor.save("publish", { leader: {} }, rows)).ok, false);
  assert.equal((await editor.save("publish", { ...renamed, spots: { "arc:project-manager:0": { email: "x@y.z" } } }, rows)).ok, false);

  let layer = NO_TEAM_LAYER;
  for (const person of roles.people.slice(10, 16)) {
    const added = addLeader(build, layer, { person: person.id, place: { at: "end" }, role: "Lead" });
    assert.ok(added.ok);
    layer = added.value;
  }
  assert.ok((await editor.save("save-draft", layer, rows)).ok, "eight on the arc");
  const ninth = { ...layer, addedLeaders: [...layer.addedLeaders, { id: 99, person: roles.people[20].id, place: { at: "start" as const }, role: "Lead" }] };
  assert.equal((await editor.save("save-draft", ninth, rows)).ok, false, "nine on the arc");
  assert.deepEqual((await editor.open())?.layer, layer);
  assert.equal((await store.layer.list()).length, 1);
});

test("hiding every department head is refused on Save draft and Publish, naming the section, and writes nothing", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const everyHeadHidden = build.departments.flatMap((d) => d.heads).reduce((layer, head) => hideHead(layer, head.spot), NO_TEAM_LAYER);
  assert.equal(headsShown(applyLayer(build, everyHeadHidden)), 0);
  assert.equal(teamPageFromRoles(roles, team, everyHeadHidden), null, "the page cannot be drawn without a department head");
  // An advisor change rides along, so a refusal must leave it unwritten too.
  const edited = [{ ...rows[0], fields: { ...rows[0].fields, role: "Faculty Advisor, Structures" } }, ...rows.slice(1)];
  const advisors = await store.advisors();
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.save(step, everyHeadHidden, edited), refused(SECTION_EMPTY.departments), step);
  }
  assert.equal(SECTION_EMPTY.departments, "Keep at least one department head on the page.");
  assert.deepEqual(await store.layer.list(), [], "no layer written");
  assert.deepEqual(await store.advisors(), advisors, "no advisor written");
});

test("hiding every leader on the arc is refused, naming the arc", async () => {
  const { store, editor } = editorOver(admin);
  const spots = Object.fromEntries(build.arc.map((l) => [l.spot, { hidden: true as const }]));
  const result = await editor.save("publish", { ...NO_TEAM_LAYER, spots }, await rowsOf(store));
  assert.deepEqual(result, refused(SECTION_EMPTY.arc));
  assert.deepEqual(await store.layer.list(), []);
});

test("a layer showing more department heads than the carousel holds is refused on Save draft and Publish, and writes nothing", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const person = roles.people[0].id;
  const addedDepartments: AddedDepartment[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Added ${i + 1}`, head: { person }, leads: [] }));
  const crowded: TeamPageLayer = { ...NO_TEAM_LAYER, addedDepartments };
  assert.ok(headsShown(applyLayer(build, crowded)) > HEADS_SHOWN_MAX, "more heads than five slides of ten");
  assert.ok(headsShown(applyLayer(build, NO_TEAM_LAYER)) <= HEADS_SHOWN_MAX, "the roles alone fit");
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.save(step, crowded, rows), refused(HEADS_FULL), step);
  }
  assert.equal(HEADS_FULL, "The departments area shows up to 50 heads.");
  assert.deepEqual(await store.layer.list(), []);

  // Just at the limit, the layer is kept.
  const fits = { ...NO_TEAM_LAYER, addedDepartments: addedDepartments.slice(0, HEADS_SHOWN_MAX - headsShown(applyLayer(build, NO_TEAM_LAYER))) };
  assert.ok((await editor.save("save-draft", fits, rows)).ok);
});

test("when the advisors are refused, or the store fails, the stored layer and advisors are unchanged", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const advisors = await store.advisors();

  // Refused: an advisor row the panel would refuse.
  const unnamed = [{ ...rows[0], fields: { ...rows[0].fields, name: " " } }, ...rows.slice(1)];
  assert.equal((await editor.save("publish", renamed, unnamed)).ok, false);
  assert.deepEqual(await store.layer.list(), [], "the layer is not written when the advisors are refused");
  assert.deepEqual(await store.advisors(), advisors);

  // Failed partway: the advisors' store refuses the second of two new advisors, after the layer and the first could have landed.
  const layer = memoryContentStore<TeamPageLayer>([]);
  const seed = importedAdvisors();
  const full = memoryContentStore<AdvisorVersion>(seed, async (items) => (items.length > seed.length + 1 ? "The store failed." : null));
  const failing = teamPageEditor(admin, memoryTeamPageStore(layer, full), async () => roles, team);
  const newAdvisor = (name: string): AdvisorRow => ({ id: null, fields: { name, role: "Propulsion", standing: "specialist", photo: null, linkedin: "", email: "" } });
  const result = await failing.save("publish", renamed, [...advisorRowsOf(seed), newAdvisor("Prof. Ada Rossi"), newAdvisor("Prof. Bea Neri")]);
  assert.deepEqual(result, refused("The store failed."));
  assert.deepEqual(await layer.list(), [], "no layer written");
  assert.deepEqual(await full.list(), seed, "no advisor written, not even the first");
});

test("the editor writes through the store's one save: never the layer or advisors one by one", async () => {
  const fail = async (): Promise<never> => assert.fail("written outside the one save");
  const layer = { ...memoryContentStore<TeamPageLayer>([]), create: fail, update: fail, remove: fail, setOrder: fail };
  let saves = 0;
  const store: TeamPageStore = {
    layer,
    advisors: async () => importedAdvisors(),
    save: async () => (saves++, refused("The database is down.")),
  };
  const editor = teamPageEditor(admin, store, async () => roles, team);
  assert.deepEqual(await editor.save("publish", renamed, advisorRowsOf(importedAdvisors())), refused("The database is down."));
  assert.equal(saves, 1);
});

test("the database side of the layer writes the layer's own table alone: never roles, divisions, departments, scopes or members", () => {
  const source = readFileSync(new URL("../dashboard/database-team-page.ts", import.meta.url), "utf8");
  // The only table it can name is the one it imports, and it writes no raw SQL that could name another.
  const schemaImports = [...source.matchAll(/import \{([^}]*)\} from "@\/db\/schema[^"]*";/g)].flatMap((m) => m[1].split(",").map((name) => name.trim()));
  assert.deepEqual(schemaImports, ["teamPageLayerVersions"]);
  assert.doesNotMatch(source, /\bsql`|from "drizzle-orm"/);
  for (const table of ["roles", "divisions", "departments", "scopes", "members"]) {
    assert.doesNotMatch(source, new RegExp(`\\.(insert|update|delete)\\(${table}\\b`), table);
  }
});

test("the database side of Save draft and Publish sends the layer and the advisor writes in one batch, and names no table itself", () => {
  const source = readFileSync(new URL("../dashboard/database-team-page-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /@\/db\/schema|\bsql`|from "drizzle-orm"/);
  assert.equal([...source.matchAll(/runAuditBatch\(/g)].length, 1);
  assert.match(source, /runAuditBatch\(\(db\) => \[\.\.\.layerVersionWrites\(db, layer\), \.\.\.advisorWriteQueries\(db, advisors\)\]\)/);
});
