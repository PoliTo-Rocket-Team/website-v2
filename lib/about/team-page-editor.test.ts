import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { statusOf, type ContentItem } from "@/lib/content/versioned";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyTeamRoles } from "@/lib/dummy-data/team-page";
import { addLeader, NO_TEAM_LAYER, type TeamPageLayer } from "./team-layer";
import { publicTeamPage, teamPageEditor } from "./team-page-editor";
import { team } from "./team";
import { teamBuildOf, teamPageFromRoles } from "./team-roles";

// The Team page's visual layer as the editor saves it (issue #283): Save
// draft never reaches the public page, Publish does, Reset to team is a
// draft, and every write passes the site-content gate and writes the layer
// alone.

const roles = dummyTeamRoles();
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const siteContent: ViewerStanding = { kind: "member", siteContent: true, approveOrders: false };

const renamed: TeamPageLayer = { ...NO_TEAM_LAYER, leader: { role: "President" }, intro: "Edited intro." };

function editorOver(viewer: ViewerStanding, seed: ContentItem<TeamPageLayer>[] = []) {
  const store = memoryContentStore(seed);
  return { store, editor: teamPageEditor(viewer, store, async () => roles, team) };
}

const publicPage = async (store: ReturnType<typeof memoryContentStore<TeamPageLayer>>) => publicTeamPage(roles, team, await store.list());

test("with no layer saved, the public page is the roles build", async () => {
  const { store } = editorOver(admin);
  assert.deepEqual(await publicPage(store), teamPageFromRoles(roles, team));
});

test("Save draft never changes the public page; Publish does; the public page reads only the published layer", async () => {
  const { store, editor } = editorOver(siteContent);
  const before = await publicPage(store);

  const drafted = await editor.save("save-draft", renamed);
  assert.ok(drafted.ok);
  assert.equal(statusOf(drafted.value), "draft");
  assert.deepEqual(await publicPage(store), before, "a draft never reaches the public page");
  // The editor opens on the draft, laid on the roles build.
  const opened = await editor.open();
  assert.equal(opened?.status, "draft");
  assert.equal(opened?.page.orgChart.leader.role, "President");

  const published = await editor.save("publish", renamed);
  assert.ok(published.ok);
  const after = await publicPage(store);
  assert.equal(after.orgChart.leader.role, "President");
  assert.equal(after.header.intro, "Edited intro.");

  // A new draft over the published layer leaves the public page on the published one.
  const again = await editor.save("save-draft", { ...renamed, leader: { role: "Chair" } });
  assert.ok(again.ok);
  assert.equal(statusOf(again.value), "draft-changes");
  assert.equal((await publicPage(store)).orgChart.leader.role, "President");
  assert.equal((await editor.open())?.page.orgChart.leader.role, "Chair");
});

test("Reset to team is a draft with only the intro text and the group photo kept; the public page changes on Publish", async () => {
  const { store, editor } = editorOver(admin);
  const layer: TeamPageLayer = { ...renamed, groupPhoto: { src: "/team/team-2026.jpg", alt: "The team" } };
  assert.ok((await editor.save("publish", layer)).ok);

  const reset = await editor.reset();
  assert.ok(reset.ok);
  assert.equal(statusOf(reset.value), "draft-changes");
  assert.equal((await publicPage(store)).orgChart.leader.role, "President", "the live page keeps the published layer");
  const opened = await editor.open();
  assert.deepEqual(opened?.layer, { ...NO_TEAM_LAYER, intro: "Edited intro.", groupPhoto: layer.groupPhoto });

  assert.ok((await editor.save("publish", opened!.layer)).ok);
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
    assert.equal(await editor.open(), null, viewer.kind);
    assert.equal((await editor.save("save-draft", NO_TEAM_LAYER)).ok, false, viewer.kind);
    assert.equal((await editor.save("publish", NO_TEAM_LAYER)).ok, false, viewer.kind);
    assert.equal((await editor.reset()).ok, false, viewer.kind);
    assert.deepEqual(await store.list(), published, `${viewer.kind}: nothing stored`);
  }
});

test("a save is refused when it is not a layer, or when it puts more than eight on the arc", async () => {
  const { store, editor } = editorOver(admin);
  assert.equal((await editor.save("publish", { leader: {} })).ok, false);
  assert.equal((await editor.save("publish", { ...renamed, spots: { "arc:project-manager:0": { email: "x@y.z" } } })).ok, false);

  const build = teamBuildOf(roles);
  let layer = NO_TEAM_LAYER;
  for (const person of roles.people.slice(10, 16)) {
    const added = addLeader(build, layer, { person: person.id, place: { at: "end" }, role: "Lead" });
    assert.ok(added.ok);
    layer = added.value;
  }
  assert.ok((await editor.save("save-draft", layer)).ok, "eight on the arc");
  const ninth = { ...layer, addedLeaders: [...layer.addedLeaders, { id: 99, person: roles.people[20].id, place: { at: "start" as const }, role: "Lead" }] };
  assert.equal((await editor.save("save-draft", ninth)).ok, false, "nine on the arc");
  assert.deepEqual((await editor.open())?.layer, layer);
  assert.equal((await store.list()).length, 1);
});

test("the database side writes the layer's own table alone: never roles, divisions, departments, scopes or members", () => {
  const source = readFileSync(new URL("../dashboard/database-team-page.ts", import.meta.url), "utf8");
  // The only table it can name is the one it imports, and it writes no raw SQL that could name another.
  const schemaImports = [...source.matchAll(/import \{([^}]*)\} from "@\/db\/schema[^"]*";/g)].flatMap((m) => m[1].split(",").map((name) => name.trim()));
  assert.deepEqual(schemaImports, ["teamPageLayerVersions"]);
  assert.doesNotMatch(source, /\bsql`|from "drizzle-orm"/);
  for (const table of ["roles", "divisions", "departments", "scopes", "members"]) {
    assert.doesNotMatch(source, new RegExp(`\\.(insert|update|delete)\\(${table}\\b`), table);
  }
});
