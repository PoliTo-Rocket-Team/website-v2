import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { memoryContentStore } from "@/lib/content/memory";
import { statusOf, type ContentItem } from "@/lib/content/versioned";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { refused } from "@/lib/dashboard/write";
import { dummyTeamPagePhotos, dummyTeamRoles } from "@/lib/dummy-data/team-page";
import { publicStoreHost } from "@/lib/storage/pathname";
import { advisorRowsOf, publicAdvisors, withAdvisors, type AdvisorRow, type AdvisorVersion } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { addLeader, applyLayer, NO_TEAM_LAYER, type AddedDepartment, type TeamPageLayer } from "./team-layer";
import { hideHead } from "./team-page-add";
import { HEADS_FULL, publishedLayer, publicTeamPage, SECTION_EMPTY, teamPageEditor, type TeamPageStore } from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import { publicStoreTeamPagePhotos } from "./team-page-photos";
import { team } from "./team";
import { HEADS_SHOWN_MAX, headsShown, teamBuildOf, teamPageFromRoles } from "./team-roles";
import type { PersonPhoto } from "./types";

// The Team page's visual layer and advisors as the editor saves them (issues
// #283 and #321): Save draft never reaches the public page, Publish does,
// Reset to team is a draft, every write passes the site-content gate, the
// layer and the advisors land together or not at all, and a layer the page
// cannot draw as edited is refused.

const roles = dummyTeamRoles();
const build = teamBuildOf(roles);
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const siteContent: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };

const renamed: TeamPageLayer = { ...NO_TEAM_LAYER, leader: { role: "President" }, intro: "Edited intro." };

function editorOver(viewer: ViewerStanding, seed: ContentItem<TeamPageLayer>[] = []) {
  const layer = memoryContentStore(seed);
  const advisors = memoryContentStore<AdvisorVersion>(importedAdvisors());
  const store = memoryTeamPageStore(layer, advisors);
  return { layer, advisors, store, editor: teamPageEditor(viewer, store, async () => roles, team, dummyTeamPagePhotos) };
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
  const failing = teamPageEditor(admin, memoryTeamPageStore(layer, full), async () => roles, team, dummyTeamPagePhotos);
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
  const editor = teamPageEditor(admin, store, async () => roles, team, dummyTeamPagePhotos);
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

// Replace photo's upload (issue #323): stored only past the site-content
// gate, and answered as a src the layer and the advisor rows both keep.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const STORED = "https://abc123.public.blob.vercel-storage.com/photos/team-page-1.jpg";

function recordingPhotos() {
  const put: string[] = [];
  return {
    put,
    photos: {
      put: async (photo: { contentType: string }) => {
        put.push(photo.contentType);
        return STORED as `https://${string}`;
      },
      owns: (src: string) => src === STORED,
      drop: async () => {},
    },
  };
}

test("an uploaded photo is refused without the site-content permission, and stores no file", async () => {
  const files = recordingPhotos();
  const viewer: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false };
  const editor = teamPageEditor(viewer, editorOver(viewer).store, async () => roles, team, files.photos);
  assert.deepEqual(await editor.uploadPhoto({ name: "photo.jpg", contentType: "image/jpeg", bytes: JPEG }), refused(SITE_CONTENT_REFUSAL));
  assert.deepEqual(files.put, []);
});

test("an uploaded photo is stored and saved on a person and an advisor, and shows on the page after Publish", async () => {
  const files = recordingPhotos();
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(siteContent, store, async () => roles, team, files.photos);

  const notPhoto = await editor.uploadPhoto({ name: "notes.txt", contentType: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) });
  assert.equal(notPhoto.ok, false, "bytes that are no photo are refused");
  assert.deepEqual(files.put, []);

  const uploaded = await editor.uploadPhoto({ name: "photo.jpg", contentType: "image/jpeg", bytes: JPEG });
  assert.ok(uploaded.ok);
  assert.equal(uploaded.value, STORED);
  assert.deepEqual(files.put, ["image/jpeg"]);

  const [first, ...rest] = await rowsOf(store);
  const rows = [{ ...first, fields: { ...first.fields, photo: uploaded.value } }, ...rest];
  const published = await editor.save("publish", { ...NO_TEAM_LAYER, leader: { photo: uploaded.value } }, rows);
  assert.ok(published.ok, "the layer and the advisor rows take the uploaded src");
  // As /about/the-team reads it (./team-data.ts): the published layer, then the published advisors.
  const live = withAdvisors(await publicPage(store), publicAdvisors(await store.advisors()));
  assert.equal(live.orgChart.leader.photo, STORED);
  assert.equal(live.advisors.people[0]?.photo, STORED);
});

// A replaced upload's file (issue #323): deleted once the write lands and no
// stored layer version or advisor row uses it, through deleteBestEffort, so a
// failed delete never fails the save.

const OWN_HOST = publicStoreHost("store_Own123");
const ownUrl = (pathname: string) => `https://own123.public.blob.vercel-storage.com/${pathname}` as `https://${string}`;
const MEMBER_PICTURE = ownUrl("photos/member-7.jpg");

function storePhotos(remove: (pathname: string) => Promise<void>) {
  let n = 0;
  return publicStoreTeamPagePhotos(OWN_HOST, { upload: async (pathname) => ({ url: ownUrl(pathname) }), remove }, () => String(++n));
}

async function uploaded(editor: ReturnType<typeof teamPageEditor>) {
  const result = await editor.uploadPhoto({ name: "photo.jpg", contentType: "image/jpeg", bytes: JPEG });
  assert.ok(result.ok);
  return result.value;
}

test("a replaced uploaded photo's file is deleted after the write lands, once no stored version or advisor row uses it", async () => {
  const removed: string[] = [];
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(siteContent, store, async () => roles, team, storePhotos(async (pathname) => {
    removed.push(pathname);
    assert.notEqual(publishedLayer(await store.layer.list()).leader.photo, ownUrl(pathname), "deleted only after the write landed");
  }));
  const [a, b, c, d] = [await uploaded(editor), await uploaded(editor), await uploaded(editor), await uploaded(editor)];
  const withAdvisorPhoto = async (photo: PersonPhoto) => {
    const [first, ...rest] = await rowsOf(store);
    return [{ ...first, fields: { ...first.fields, photo } }, ...rest];
  };

  assert.ok((await editor.save("publish", { ...NO_TEAM_LAYER, leader: { photo: a } }, await withAdvisorPhoto(MEMBER_PICTURE))).ok);
  assert.deepEqual(removed, []);

  // A draft replaces both, but the published version still shows them.
  assert.ok((await editor.save("save-draft", { ...NO_TEAM_LAYER, leader: { photo: b } }, await withAdvisorPhoto(c))).ok);
  assert.deepEqual(removed, [], "the published version still uses them");

  // Publish: the leader's upload goes; the member's own picture is never this editor's to delete.
  assert.ok((await editor.save("publish", { ...NO_TEAM_LAYER, leader: { photo: b } }, await withAdvisorPhoto(c))).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg"]);

  // Reset to team drops a draft's upload the published version never showed.
  assert.ok((await editor.save("save-draft", { ...NO_TEAM_LAYER, leader: { photo: d } }, await rowsOf(store))).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg"], "the published version still shows b");
  assert.ok((await editor.reset()).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg", "photos/team-page-4.jpg"]);
});

test("an uploaded group photo is in use while any stored version shows it, and its file goes once none does", async () => {
  const removed: string[] = [];
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(siteContent, store, async () => roles, team, storePhotos(async (pathname) => void removed.push(pathname)));
  const [a, b] = [await uploaded(editor), await uploaded(editor)];
  const withGroup = (src: PersonPhoto): TeamPageLayer => ({ ...NO_TEAM_LAYER, groupPhoto: { src, alt: "The team" } });

  assert.ok((await editor.save("publish", withGroup(a), await rowsOf(store))).ok);
  assert.equal((await publicPage(store)).coreMembers.groupPhoto.src, a);

  // A draft replaces it, but the published version still shows it, and Reset to team keeps the group photo.
  assert.ok((await editor.save("save-draft", withGroup(b), await rowsOf(store))).ok);
  assert.ok((await editor.reset()).ok);
  assert.deepEqual(removed, []);

  // Published again: the first upload is in no version now.
  assert.ok((await editor.save("publish", withGroup(b), await rowsOf(store))).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg"]);
});

test("a failed delete of a replaced photo never fails the save, and logs one line naming the Team page's area", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(siteContent, store, async () => roles, team, storePhotos(async (pathname) => {
    throw new Error(`Blob is down for ${pathname}`);
  }));
  const [a, b] = [await uploaded(editor), await uploaded(editor)];
  assert.ok((await editor.save("publish", { ...NO_TEAM_LAYER, leader: { photo: a } }, await rowsOf(store))).ok);

  const replaced = await editor.save("publish", { ...NO_TEAM_LAYER, leader: { photo: b } }, await rowsOf(store));
  assert.ok(replaced.ok, "the save stands");
  assert.equal(publishedLayer(await store.layer.list()).leader.photo, b);
  assert.deepEqual(
    log.mock.calls.map((call) => call.arguments),
    [["Blob delete failed (store: public, area: team-photo): Blob is down for [file]"]],
  );
});
