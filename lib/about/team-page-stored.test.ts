import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_DATA, publishedTeamPageOf, teamRolesOf } from "@/db/seed/cases";
import { seededRecordLayout } from "@/db/seed/team-page";
import { memoryContentStore } from "@/lib/content/memory";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { advisorRowsOf } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { team } from "./team";
import { NO_TEAM_LAYER, NO_UPLOADS, textOf } from "./team-layer";
import { firstLayout, isGroupedLayout, layoutPageOf, parseTeamLayout, teamPageFromRoles, type KindLayout, type TeamLayout } from "./team-layout";
import { photosInUse, publicTeamPage, teamPageEditor, type TeamPageEditor, type TeamPagePhotos, type TeamPageStore } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import {
  bindsStoredTeamSeat,
  contentOf,
  layoutOf,
  storedTeamPageOfRow,
  teamSeatHandedOver,
  type StoredTeamPage,
  type TeamPageContent,
} from "./team-page-stored";
import { emptySectionOf, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// The Team page stored with its layout (issues #850, #855): a version draws
// its own layout, a database with nothing saved draws the team record's
// places, a save from the editor stores its layout with the layer's text
// (issue #851), the layout's photos are in use, and the seed draws a layout
// the editor could have saved.

const roles = teamRolesOf(SEED_DATA);
const seeded = publishedTeamPageOf(SEED_DATA)!;
const layer = seeded.layer;
const seededLayout = layoutOf(roles, seeded);
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

test("the public page and the editor's opening page draw the stored layout, and the team record's places while nothing is saved", async () => {
  const moved = divisionMoved(seededLayout);
  const before = seatsOf(publicTeamPage(roles, team, published(seeded)));

  // A stored version: the Team tree change leaves the seats as they were.
  assert.deepEqual(seatsOf(publicTeamPage(moved, team, published(seeded))), before);
  const withLayout = teamPageEditor(siteContent, memoryTeamPageStore(memoryContentStore(published(seeded)), memoryContentStore(importedAdvisors())), async () => moved, team, NO_PHOTOS);
  assert.deepEqual(seatsOf(await openedPage(withLayout)), before);

  // Nothing saved: the team record's places now, which follow the change.
  const unsaved = seatsOf(publicTeamPage(moved, team, []));
  assert.deepEqual(unsaved, seatsOf(teamPageFromRoles(moved, team)!));
  assert.notDeepEqual(unsaved, seatsOf(publicTeamPage(roles, team, [])), "the record's places follow the moved division");
  const nothingSaved = teamPageEditor(siteContent, memoryTeamPageStore(memoryContentStore<StoredTeamPage>([]), memoryContentStore(importedAdvisors())), async () => moved, team, NO_PHOTOS);
  assert.deepEqual((await nothingSaved.open())?.content.layout, firstLayout(moved));
  assert.deepEqual(seatsOf(await openedPage(nothingSaved)), unsaved);
});

test("a save stores the layout the editor sends and the layer's text in one write; Reset to team rebuilds the layout from the roles", async () => {
  const store = memoryTeamPageStore(memoryContentStore<StoredTeamPage>(published(seeded)), memoryContentStore(importedAdvisors()));
  const writes: Versioned<StoredTeamPage>[] = [];
  const spied: TeamPageStore = { ...store, save: (version, advisors, expected) => (writes.push(version), store.save(version, advisors, expected)) };
  const editor = teamPageEditor(siteContent, spied, async () => roles, team, NO_PHOTOS);

  const opened = await editor.open();
  assert.deepEqual(opened?.content, contentOf(roles, seeded), "the editor opens on the stored layout and the layer's text");
  const content: TeamPageContent = { layout: { ...seededLayout, arc: seededLayout.arc.slice(1) }, text: { ...textOf(layer), intro: "Edited intro." } };
  const saved = await editor.save("publish", content, advisorRowsOf(await store.advisors()));
  assert.ok(saved.ok, JSON.stringify(saved));
  assert.deepEqual(writes, [{ state: "published", published: { layer: { ...layer, intro: "Edited intro." }, layout: content.layout }, draft: null }]);
  assert.deepEqual(saved.value.content, { state: "published", published: content, draft: null }, "the editor answers the content as stored");

  const reset = await editor.reset();
  assert.ok(reset.ok);
  const [item] = await store.layer.list();
  const draft = item.version.state === "published" ? item.version.draft : null;
  assert.deepEqual(draft, { layer: { ...layer, intro: "Edited intro." }, layout: seededRecordLayout(roles) });
});

test("a version stored before groups opens with each department found, a save writes them, and Reset to team keeps the group of an Operations department whose head was swapped to a person", async () => {
  const layout = seededRecordLayout(roles);
  const operations = layout.groups[1].id;
  const swapped = layout.departments.find((b) => b.group === operations);
  assert.ok(swapped, "the seed has an Operations department");
  const someone = roles.people.find((p) => p.placement.role !== "head")!;
  const kindLayout: KindLayout = {
    leader: layout.leader,
    arc: layout.arc,
    departments: layout.departments.map(({ department: _d, group, leadsDrawn: _l, ...b }) => ({
      ...b,
      head: b.id === swapped.id ? { ...b.head, binding: { kind: "person", memberId: someone.id } } : b.head,
      kind: group === operations ? "operations" : "technical",
    })),
  };
  const stored = storedTeamPageOfRow({ layer, layout: JSON.parse(JSON.stringify(kindLayout)) }, NO_UPLOADS);
  assert.deepEqual(stored, { layer, layout: kindLayout }, "storage keeps the form before groups");
  const handedOver = teamSeatHandedOver({ state: "published", published: stored!, draft: null }, 27, 28);
  assert.ok(handedOver.state === "published" && !isGroupedLayout(handedOver.published.layout), "a hand-over writes it in the same form");
  const store = memoryTeamPageStore(memoryContentStore<StoredTeamPage>(published(stored!)), memoryContentStore(importedAdvisors()));
  const editor = teamPageEditor(siteContent, store, async () => roles, team, NO_PHOTOS);

  const opened = await editor.open();
  assert.ok(opened);
  const shown = (of: TeamLayout) => of.departments.map((b) => [b.id, b.department, b.group, b.leadsDrawn]);
  assert.deepEqual(shown(opened.content.layout), shown(layout), "each block shows its department, the swapped one too");

  // Saved, then held as storage reads it back: grouped, with each department.
  const saved = await editor.save("publish", opened.content, advisorRowsOf(await store.advisors()));
  assert.ok(saved.ok, JSON.stringify(saved));
  const [item] = await store.layer.list();
  const savedLayout = item.version.state === "published" ? item.version.published.layout : null;
  const reread = storedTeamPageOfRow({ layer, layout: JSON.parse(JSON.stringify(savedLayout)) }, NO_UPLOADS);
  assert.ok(reread && isGroupedLayout(reread.layout));
  assert.deepEqual(shown(reread.layout), shown(layout));

  const reset = await editor.reset();
  assert.ok(reset.ok);
  const [after] = await store.layer.list();
  const draft = after.version.state === "published" ? after.version.draft : null;
  assert.deepEqual(draft?.layout, layout, "Reset keeps the swapped department in Operations, its leads beside its head");
});

test("a hand-over of a team-level seat row binds every stored page seat on it to the successor's row, in each version, and leaves the rest", () => {
  const layout = firstLayout(roles);
  const onSeat: TeamLayout = {
    ...layout,
    arc: [...layout.arc, { id: 900, binding: { kind: "team-seat", roleId: 27 }, overrides: { photo: "/team/seat.jpg" } }, { id: 901, binding: { kind: "person", memberId: 27 }, overrides: {} }],
  };
  const version: Versioned<StoredTeamPage> = { state: "published", published: { layer, layout: onSeat }, draft: { layer, layout } };
  assert.ok(bindsStoredTeamSeat(version, 27));
  assert.ok(!bindsStoredTeamSeat(version, 28), "no page seat is bound to another row");
  assert.ok(!bindsStoredTeamSeat({ state: "draft", draft: { layer, layout } }, 27), "a version whose layout names no such row binds none");

  const handed = teamSeatHandedOver(version, 27, 28);
  assert.deepEqual(handed, {
    state: "published",
    published: {
      layer,
      layout: { ...onSeat, arc: [...layout.arc, { id: 900, binding: { kind: "team-seat", roleId: 28 }, overrides: { photo: "/team/seat.jpg" } }, onSeat.arc.at(-1)] },
    },
    draft: { layer, layout },
  });
  assert.ok(!bindsStoredTeamSeat(handed, 27));
});

test("a photo only a stored layout shows is in use, and so is the layer's group photo", () => {
  const layout = firstLayout(roles);
  const photo = "/team/only-in-the-layout.jpg";
  const shown: TeamLayout = { ...layout, leader: { ...layout.leader!, overrides: { photo } } };
  assert.ok(photosInUse(published({ layer: NO_TEAM_LAYER, layout: shown }), []).has(photo));
  assert.ok(!photosInUse(published({ layer: NO_TEAM_LAYER, layout }), []).has(photo));
  assert.ok(photosInUse(published({ layer, layout }), []).has(layer.groupPhoto!.src));
});

test("a stored row reads back with its layout, and not at all when its layer or its layout is not one this code could have written", () => {
  const layout = firstLayout(roles);
  assert.deepEqual(storedTeamPageOfRow({ layer, layout }, NO_UPLOADS), { layer, layout });
  assert.equal(storedTeamPageOfRow({ layer, layout: null }, NO_UPLOADS), null);
  assert.equal(storedTeamPageOfRow({ layer, layout: { leader: null } }, NO_UPLOADS), null);
  assert.equal(storedTeamPageOfRow({ layer: { intro: 1 }, layout }, NO_UPLOADS), null);
  assert.equal(storedTeamPageOfRow({ layer: { ...layer, spots: {} }, layout }, NO_UPLOADS), null, "a layer still holding a people field is not one");
});

test("the seeded published version holds a grouped layout the editor could have saved, in today's two groups, and fills every section of the page", () => {
  const rows = SEED_DATA.teamPageLayerVersions;
  assert.deepEqual(rows.map((r) => r.version), ["published"]);
  assert.ok(parseTeamLayout(JSON.parse(JSON.stringify(rows[0].layout))), "the seed writes a layout the editor could save");
  assert.deepEqual(seededLayout.groups.map((g) => g.name), ["Technical Departments", "Operations"]);
  assert.equal(emptySectionOf(publicTeamPage(roles, team, published(seeded))), null);
});

test("the seeded public page draws the same seats and core members as when a page seat read only the seat each person is drawn in (#852)", () => {
  // Before #852 a page seat bound to a team-level seat read each person's placement alone: the team with no further seats.
  const drawnInOnly: TeamRoles = { ...roles, people: roles.people.map((p) => ({ ...p, furtherSeats: [] })) };
  const now = publicTeamPage(roles, team, published(seeded));
  const before = publicTeamPage(drawnInOnly, team, published(seeded));
  assert.deepEqual(seatsOf(now), seatsOf(before));
  assert.deepEqual(now.coreMembers, before.coreMembers);
  assert.deepEqual(now, before, "nothing else on the page moves either");
});
