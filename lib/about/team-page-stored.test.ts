import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_DATA, publishedTeamPageLayerOf, teamRolesOf } from "@/db/seed/cases";
import { memoryContentStore } from "@/lib/content/memory";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { advisorRowsOf } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { team } from "./team";
import { NO_TEAM_LAYER, NO_UPLOADS, textOf } from "./team-layer";
import { layoutPageOf, snapshot, type TeamLayout } from "./team-layout";
import { photosInUse, publicTeamPage, teamPageEditor, type TeamPageEditor, type TeamPagePhotos, type TeamPageStore } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import { contentOf, layoutOf, storedTeamPage, storedTeamPageOfRow, type StoredTeamPage, type TeamPageContent } from "./team-page-stored";
import { teamPageFromRoles, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// The Team page stored with its layout (issue #850): a version with a layout
// draws it, one with none draws the layout its layer snapshots to, a save
// from the editor stores its layout with the layer's text (issue #851), the
// layout's photos are in use, and the seed draws the seats the page drew
// before.

const roles = teamRolesOf(SEED_DATA);
const layer = publishedTeamPageLayerOf(SEED_DATA)!;
const siteContent: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };
const NO_PHOTOS: TeamPagePhotos = { put: async () => "/team/stand-in.webp", owns: NO_UPLOADS, adopt: async (photo) => photo, drop: async () => {}, gone: async () => [] };

/** The seats a page draws: the leader, the arc and every department block. */
function seatsOf(page: TeamPage) {
  return { leader: page.orgChart.leader, leaders: page.orgChart.leaders, groups: page.departments.groups };
}

const published = (stored: StoredTeamPage): ContentItem<StoredTeamPage>[] => [{ id: 1, siteOrder: 1, version: { state: "published", published: stored, draft: null } }];

/** The page the editor draws as it opens. */
async function openedPage(editor: TeamPageEditor): Promise<TeamPage> {
  const opened = await editor.open();
  assert.ok(opened);
  return layoutPageOf(opened.roles, opened.content.layout, opened.content.text, opened.base);
}

/**
 * The seeded team with the division of the layout's first drawn lead moved
 * under another drawn department: a Team tree change the roles build follows
 * and the stored layout does not.
 */
function divisionMoved(layout: TeamLayout): TeamRoles {
  const [from, to] = layout.departments.filter((b) => b.head.binding.kind === "department-head" && b.leads.some((l) => l.binding.kind === "division-lead"));
  assert.ok(from && to, "two seeded blocks hold a lead");
  const lead = from.leads.find((l) => l.binding.kind === "division-lead")!;
  const divisionId = lead.binding.kind === "division-lead" ? lead.binding.divisionId : -1;
  const departmentId = to.head.binding.kind === "department-head" ? to.head.binding.departmentId : -1;
  return { ...roles, org: { ...roles.org, divisions: roles.org.divisions.map((d) => (d.id === divisionId ? { ...d, departmentId } : d)) } };
}

test("the public page and the editor's opening page draw the stored layout when a version has one, and the derived one when it has none", async () => {
  const stored = storedTeamPage(roles, layer);
  assert.ok(stored.layout);
  const moved = divisionMoved(stored.layout);
  const before = seatsOf(publicTeamPage(roles, team, published(stored)));

  // A version with a layout: the Team tree change leaves the seats as they were.
  assert.deepEqual(seatsOf(publicTeamPage(moved, team, published(stored))), before);
  const withLayout = teamPageEditor(siteContent, memoryTeamPageStore(memoryContentStore(published(stored)), memoryContentStore(importedAdvisors())), async () => moved, team, NO_PHOTOS);
  assert.deepEqual(seatsOf(await openedPage(withLayout)), before);

  // A version with none: the layout its layer snapshots to on the team now, which follows the change.
  const unfilled: StoredTeamPage = { layer, layout: null };
  const derived = seatsOf(publicTeamPage(moved, team, published(unfilled)));
  assert.notDeepEqual(derived, before, "the derived layout follows the moved division");
  assert.deepEqual(derived, seatsOf(publicTeamPage(moved, team, published(storedTeamPage(moved, layer)))));
  assert.deepEqual(layoutOf(moved, unfilled), snapshot(moved, layer).layout);
  const withoutLayout = teamPageEditor(siteContent, memoryTeamPageStore(memoryContentStore(published(unfilled)), memoryContentStore(importedAdvisors())), async () => moved, team, NO_PHOTOS);
  assert.deepEqual(seatsOf(await openedPage(withoutLayout)), derived);
});

test("a save stores the layout the editor sends and the layer's text in one write, leaving the layer's people fields; Reset to team rebuilds the layout from the roles", async () => {
  const stored = storedTeamPage(roles, layer);
  const store = memoryTeamPageStore(memoryContentStore<StoredTeamPage>(published(stored)), memoryContentStore(importedAdvisors()));
  const writes: Versioned<StoredTeamPage>[] = [];
  const spied: TeamPageStore = { ...store, save: (version, advisors, expected) => (writes.push(version), store.save(version, advisors, expected)) };
  const editor = teamPageEditor(siteContent, spied, async () => roles, team, NO_PHOTOS);

  const opened = await editor.open();
  assert.deepEqual(opened?.content, contentOf(roles, stored), "the editor opens on the stored layout and the layer's text");
  const content: TeamPageContent = { layout: { ...stored.layout!, arc: stored.layout!.arc.slice(1) }, text: { ...textOf(layer), intro: "Edited intro." } };
  const saved = await editor.save("publish", content, advisorRowsOf(await store.advisors()));
  assert.ok(saved.ok, JSON.stringify(saved));
  assert.deepEqual(writes, [{ state: "published", published: { layer: { ...layer, intro: "Edited intro." }, layout: content.layout }, draft: null }]);
  assert.deepEqual(saved.value.content, { state: "published", published: content, draft: null }, "the editor answers the content as stored");

  const reset = await editor.reset();
  assert.ok(reset.ok);
  const [item] = await store.layer.list();
  const draft = item.version.state === "published" ? item.version.draft : null;
  assert.deepEqual(draft, { layer: { ...layer, intro: "Edited intro." }, layout: snapshot(roles, NO_TEAM_LAYER).layout });
});

test("a photo only a stored layout shows is in use", () => {
  const layout = snapshot(roles, NO_TEAM_LAYER).layout;
  const photo = "/team/only-in-the-layout.jpg";
  const shown: TeamLayout = { ...layout, leader: { ...layout.leader!, overrides: { photo } } };
  assert.ok(photosInUse(published({ layer: NO_TEAM_LAYER, layout: shown }), []).has(photo));
  assert.ok(!photosInUse(published({ layer: NO_TEAM_LAYER, layout: null }), []).has(photo));
});

test("a stored row reads back with its layout, with none when it holds none or one this code could not have written, and not at all when its layer is not one", () => {
  const layout = snapshot(roles, layer).layout;
  assert.deepEqual(storedTeamPageOfRow({ layer, layout }, NO_UPLOADS), { layer, layout });
  assert.deepEqual(storedTeamPageOfRow({ layer, layout: null }, NO_UPLOADS), { layer, layout: null });
  assert.deepEqual(storedTeamPageOfRow({ layer, layout: { leader: null } }, NO_UPLOADS), { layer, layout: null });
  assert.equal(storedTeamPageOfRow({ layer: { intro: 1 }, layout }, NO_UPLOADS), null);
});

test("the seeded published version holds the layout its layer snapshots to, and draws the seats the page drew before the change", () => {
  const rows = SEED_DATA.teamPageLayerVersions;
  assert.deepEqual(rows.map((r) => r.version), ["published"]);
  const stored = storedTeamPageOfRow({ layer: rows[0].layer, layout: rows[0].layout ?? null }, NO_UPLOADS);
  assert.ok(stored?.layout, "the seed writes a layout beside its layer");
  assert.deepEqual(stored.layout, snapshot(roles, layer).layout);
  const today = teamPageFromRoles(roles, team, layer);
  assert.ok(today);
  assert.deepEqual(seatsOf(publicTeamPage(roles, team, published(stored))), seatsOf(today));
});
