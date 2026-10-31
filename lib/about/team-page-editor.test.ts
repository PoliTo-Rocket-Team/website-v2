import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { memoryContentStore } from "@/lib/content/memory";
import { statusOf, type ContentItem } from "@/lib/content/versioned";
import { VIEWER_KINDS, type ViewerStanding } from "@/lib/dashboard/viewer";
import { refused } from "@/lib/dashboard/write";
import { SEED_DATA, teamRolesOf } from "@/db/seed/cases";
import { publicStoreHost } from "@/lib/storage/pathname";
import { advisorRowsOf, publicAdvisors, withAdvisors, type AdvisorRow, type AdvisorVersion } from "./advisors";
import { importedAdvisors } from "./advisors-import";
import { NO_TEAM_LAYER, NO_UPLOADS, textOf } from "./team-layer";
import { holdingOf, layoutPageOf, nextSeatId, snapshot, type DepartmentBlock, type PageSeat, type SeatOverrides, type TeamLayout } from "./team-layout";
import { hideHead } from "./team-page-add";
import {
  HEADS_FULL,
  layoutHeadsShown,
  PICKED_PHOTO_GONE,
  publishedTeamPage,
  publicTeamPage,
  SECTION_EMPTY,
  teamPageEditor,
  type TeamPageEditor,
  type TeamPagePhotos,
  type TeamPageStore,
} from "./team-page-editor";
import { memoryTeamPageStore } from "./team-page-memory";
import { NO_STORED_TEAM_PAGE, savedTeamPage, storedTeamPage, type StoredTeamPage, type TeamPageContent } from "./team-page-stored";
import { publicStoreTeamPagePhotos, type TeamPageFileWrites } from "./team-page-photos";
import { CHANGED_SINCE_READ } from "@/lib/content/editor";
import { team } from "./team";
import { HEADS_SHOWN_MAX, teamPageFromRoles, type TeamRoles } from "./team-roles";
import type { PersonPhoto } from "./types";

// The Team page as the editor saves it, its layout of page seats with the
// intro text, figures and group photo, and the advisors (issues #283, #321
// and #851): Save draft never reaches the public page, Publish does, Reset to
// team is a draft, every write passes the site-content gate, the content and
// the advisors land together or not at all, and a layout the page cannot
// draw as edited is refused. The team is the seeded one, read as the Team
// page reads it.

const roles = teamRolesOf(SEED_DATA);
/** Photos that store nothing: the tests below that upload bring their own. */
const NO_PHOTOS: TeamPagePhotos = { put: async () => "/team/stand-in.webp", owns: NO_UPLOADS, adopt: async (photo) => photo, drop: async () => {}, gone: async () => [] };
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const siteContent: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };

/** The layout Reset to team writes, and the content the editor opens on before anything is saved. */
const record = snapshot(roles, NO_TEAM_LAYER).layout;
const plain: TeamPageContent = { layout: record, text: textOf(NO_TEAM_LAYER) };

/** The plain content with the team leader's page seat overriding `overrides`. */
const withLeader = (overrides: SeatOverrides, content: TeamPageContent = plain): TeamPageContent => ({
  ...content,
  layout: { ...content.layout, leader: { ...content.layout.leader!, overrides } },
});

const renamed: TeamPageContent = withLeader({ role: "President" }, { ...plain, text: { ...plain.text, intro: "Edited intro." } });

/** The page the editor draws as it opens. */
async function openedPage(editor: TeamPageEditor) {
  const opened = await editor.open();
  assert.ok(opened);
  return layoutPageOf(opened.roles, opened.content.layout, opened.content.text, opened.base);
}

/** The photo the published version's team leader seat sets, if any. */
const publishedLeaderPhoto = (items: Parameters<typeof publishedTeamPage>[0]) => publishedTeamPage(items).layout?.leader?.overrides.photo;

function editorOver(viewer: ViewerStanding, seed: ContentItem<StoredTeamPage>[] = []) {
  const layer = memoryContentStore(seed);
  const advisors = memoryContentStore<AdvisorVersion>(importedAdvisors());
  const store = memoryTeamPageStore(layer, advisors);
  return { layer, advisors, store, editor: teamPageEditor(viewer, store, async () => roles, team, NO_PHOTOS) };
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
  assert.equal(statusOf(drafted.value.content), "draft");
  assert.deepEqual(await publicPage(store), before, "a draft never reaches the public page");
  // The editor opens on the draft's layout.
  const opened = await editor.open();
  assert.equal(opened?.status, "draft");
  assert.equal((await openedPage(editor)).orgChart.leader?.role, "President");

  const published = await editor.save("publish", renamed, await rowsOf(store));
  assert.ok(published.ok);
  const after = await publicPage(store);
  assert.equal(after.orgChart.leader?.role, "President");
  assert.equal(after.header.intro, "Edited intro.");

  // A new draft over the published version leaves the public page on the published one.
  const again = await editor.save("save-draft", withLeader({ role: "Chair" }, renamed), await rowsOf(store));
  assert.ok(again.ok);
  assert.equal(statusOf(again.value.content), "draft-changes");
  assert.equal((await publicPage(store)).orgChart.leader?.role, "President");
  assert.equal((await openedPage(editor)).orgChart.leader?.role, "Chair");
});

test("a save stores the layout the editor sends, and the public page drawn from it equals the editor's page", async () => {
  const { store, editor } = editorOver(siteContent);
  const leaders = renamed.layout.arc;
  // The arc's first two places swapped, and a department block taken off.
  const content: TeamPageContent = {
    ...renamed,
    layout: { ...renamed.layout, arc: [leaders[1], leaders[0], ...leaders.slice(2)], departments: renamed.layout.departments.slice(1) },
  };
  assert.ok((await editor.save("publish", content, await rowsOf(store))).ok);
  assert.deepEqual(publishedTeamPage(await store.layer.list()).layout, content.layout);
  assert.deepEqual(await publicPage(store), layoutPageOf(roles, content.layout, content.text, team));
  assert.deepEqual(await publicPage(store), await openedPage(editor));
});

test("Save draft and Publish write the layer and the advisors together, and answer both as stored", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const added: AdvisorRow = { id: null, fields: { name: "Prof. Ada Rossi", role: "Propulsion", standing: "specialist", photo: null, linkedin: "", email: "" } };
  const saved = await editor.save("publish", renamed, [...rows, added]);
  assert.ok(saved.ok);
  assert.equal(statusOf(saved.value.content), "published");
  assert.deepEqual(saved.value.advisors, await store.advisors());
  assert.ok(saved.value.advisors.some((a) => a.version.state === "published" && a.version.published.name === "Prof. Ada Rossi"));
  assert.equal((await publicPage(store)).orgChart.leader?.role, "President");
});

test("Reset to team is a draft whose layout the team's roles rebuild, with only the intro text, figures and group photo kept; the public page changes on Publish", async () => {
  const { store, editor } = editorOver(admin);
  const leaders = record.arc;
  const edited: TeamPageContent = {
    layout: { ...renamed.layout, arc: [leaders[1], leaders[0], ...leaders.slice(2)], departments: record.departments.slice(1) },
    text: { ...renamed.text, groupPhoto: { src: "/team/team-2026.jpg", alt: "The team" } },
  };
  assert.ok((await editor.save("publish", edited, await rowsOf(store))).ok);
  const advisorsBefore = await store.advisors();

  const reset = await editor.reset();
  assert.ok(reset.ok);
  assert.equal(statusOf(reset.value), "draft-changes");
  assert.equal((await publicPage(store)).orgChart.leader?.role, "President", "the live page keeps the published version");
  assert.deepEqual(await store.advisors(), advisorsBefore, "Reset to team never reaches the advisors");
  const opened = await editor.open();
  assert.deepEqual(opened?.content, { layout: record, text: edited.text });

  assert.ok((await editor.save("publish", opened!.content, await rowsOf(store))).ok);
  const live = await publicPage(store);
  const fromRoles = teamPageFromRoles(roles, team)!;
  assert.deepEqual(live.orgChart, fromRoles.orgChart);
  assert.deepEqual(live.departments, fromRoles.departments);
  assert.equal(live.header.intro, "Edited intro.");
  assert.deepEqual(live.coreMembers.groupPhoto, edited.text.groupPhoto);
});

test("every write path is refused without the site-content permission, and stores nothing", async () => {
  const published: ContentItem<StoredTeamPage>[] = [{ id: 1, siteOrder: 1, version: { state: "published", published: savedTeamPage(NO_STORED_TEAM_PAGE, renamed), draft: null } }];
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
    assert.equal((await editor.save("save-draft", plain, rows)).ok, false, viewer.kind);
    assert.equal((await editor.save("publish", plain, rows)).ok, false, viewer.kind);
    assert.equal((await editor.reset()).ok, false, viewer.kind);
    assert.deepEqual(await store.layer.list(), published, `${viewer.kind}: no layer stored`);
    assert.deepEqual(await store.advisors(), advisors, `${viewer.kind}: no advisor stored`);
  }
});

test("a save is refused when it is not the editor's content, or when it puts more than eight on the arc", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  assert.equal((await editor.save("publish", { layout: {} }, rows)).ok, false);
  assert.equal((await editor.save("publish", { ...NO_TEAM_LAYER }, rows)).ok, false, "a layer is no longer what the editor sends");
  assert.equal((await editor.save("publish", withLeader({ email: "x@y.z" } as SeatOverrides), rows)).ok, false);

  let layout: TeamLayout = record;
  for (const person of roles.people.slice(10, 10 + 8 - record.arc.length)) {
    const seat: PageSeat = { id: nextSeatId(layout), binding: { kind: "person", memberId: person.id }, overrides: { role: "Lead" } };
    layout = { ...layout, arc: [...layout.arc, seat] };
  }
  assert.equal(layout.arc.length, 8);
  assert.ok((await editor.save("save-draft", { ...plain, layout }, rows)).ok, "eight on the arc");
  const ninth: PageSeat = { id: nextSeatId(layout), binding: { kind: "person", memberId: roles.people[20].id }, overrides: { role: "Lead" } };
  assert.equal((await editor.save("save-draft", { ...plain, layout: { ...layout, arc: [ninth, ...layout.arc] } }, rows)).ok, false, "nine on the arc");
  assert.deepEqual((await editor.open())?.content.layout, layout);
  assert.equal((await store.layer.list()).length, 1);
});

test("taking every department head off the page is refused on Save draft and Publish, naming the section, and writes nothing", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const everyHeadHidden = record.departments.reduce((layout, block) => hideHead(layout, block.id), record);
  assert.equal(layoutHeadsShown(roles, everyHeadHidden), 0);
  // An advisor change rides along, so a refusal must leave it unwritten too.
  const edited = [{ ...rows[0], fields: { ...rows[0].fields, role: "Faculty Advisor, Structures" } }, ...rows.slice(1)];
  const advisors = await store.advisors();
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.save(step, { ...plain, layout: everyHeadHidden }, edited), refused(SECTION_EMPTY.departments), step);
  }
  assert.equal(SECTION_EMPTY.departments, "Keep at least one department head on the page.");
  assert.deepEqual(await store.layer.list(), [], "nothing written");
  assert.deepEqual(await store.advisors(), advisors, "no advisor written");
});

test("taking every leader off the arc is refused, naming the arc", async () => {
  const { store, editor } = editorOver(admin);
  const result = await editor.save("publish", { ...plain, layout: { ...record, arc: [] } }, await rowsOf(store));
  assert.deepEqual(result, refused(SECTION_EMPTY.arc));
  assert.deepEqual(await store.layer.list(), []);
});

test("a layout showing more department heads than the carousel holds is refused on Save draft and Publish, and writes nothing", async () => {
  const { store, editor } = editorOver(admin);
  const rows = await rowsOf(store);
  const memberId = roles.people[0].id;
  const first = nextSeatId(record);
  const added: DepartmentBlock[] = Array.from({ length: 50 }, (_, i) => ({
    id: first + 2 * i,
    name: `Added ${i + 1}`,
    group: record.groups[0].id,
    leadsDrawn: "under",
    head: { id: first + 2 * i + 1, binding: { kind: "person", memberId }, overrides: {} },
    leads: [],
  }));
  const crowded: TeamLayout = { ...record, departments: [...record.departments, ...added] };
  assert.ok(layoutHeadsShown(roles, crowded) > HEADS_SHOWN_MAX, "more heads than five slides of ten");
  assert.ok(layoutHeadsShown(roles, record) <= HEADS_SHOWN_MAX, "the roles alone fit");
  for (const step of ["save-draft", "publish"] as const) {
    assert.deepEqual(await editor.save(step, { ...plain, layout: crowded }, rows), refused(HEADS_FULL), step);
  }
  assert.equal(HEADS_FULL, "The departments area shows up to 50 heads.");
  assert.deepEqual(await store.layer.list(), []);

  // Just at the limit, the layout is kept.
  const fits: TeamLayout = { ...record, departments: [...record.departments, ...added.slice(0, HEADS_SHOWN_MAX - layoutHeadsShown(roles, record))] };
  assert.ok((await editor.save("save-draft", { ...plain, layout: fits }, rows)).ok);
});

// Owner decisions of 2026-10-29 (grilling session #846, R2.1 and R2.2; ADR
// 0019 Decision 4): a page seat whose seat has no holder is not drawn and
// keeps its place; one whose team seat is gone leaves the layout on the next
// save.

/** The seeded team with `person` gone from it: no active role. */
const without = (personId: number) => ({ ...roles, people: roles.people.filter((p) => p.id !== personId) });

/** The plain content, published. */
const publishedPlain: ContentItem<StoredTeamPage>[] = [{ id: 1, siteOrder: 1, version: { state: "published", published: savedTeamPage(NO_STORED_TEAM_PAGE, plain), draft: null } }];

test("a page seat whose seat has no holder is not drawn in the editor, survives a save in its place, and shows again once the seat has a holder", async () => {
  const { store } = editorOver(siteContent, publishedPlain);
  // The Project Manager's seat: a flagged seat stays on the team record while nobody holds it.
  const index = record.arc.findIndex((s) => s.binding.kind === "full-access-seat" && s.binding.seat === "project-manager");
  assert.notEqual(index, -1);
  const seat = record.arc[index];
  const holder = roles.people.find((p) => p.placement.role === "board" && p.placement.seat.flag === "project-manager")!;
  const vacant = without(holder.id);

  let teamRoles: TeamRoles = vacant;
  const editor = teamPageEditor(siteContent, store, async () => teamRoles, team, NO_PHOTOS);
  const opened = await editor.open();
  assert.ok(opened);
  const page = await openedPage(editor);
  assert.ok(!page.orgChart.leaders.some((l) => l.name === holder.name), "not drawn in the editor");
  assert.equal(page.orgChart.leaders.length, record.arc.length - 1);
  assert.ok((await editor.save("publish", opened.content, await rowsOf(store))).ok);
  assert.deepEqual(publishedTeamPage(await store.layer.list()).layout?.arc[index], seat, "kept in its place");

  teamRoles = roles;
  assert.deepEqual((await publicPage(store)).orgChart.leaders, teamPageFromRoles(roles, team)!.orgChart.leaders, "shown again in the same place");
});

test("a page seat whose team seat was deleted is not drawn, and is gone from the layout after the next save", async () => {
  const { store } = editorOver(siteContent, publishedPlain);
  const block = record.departments.find((b) => b.head.binding.kind === "department-head")!;
  const departmentId = block.head.binding.kind === "department-head" ? block.head.binding.departmentId : -1;
  const head = holdingOf(block.head.binding, roles, block.name)!.person;
  const closed = { ...roles, org: { ...roles.org, departments: roles.org.departments.filter((d) => d.id !== departmentId) } };
  const editor = teamPageEditor(siteContent, store, async () => closed, team, NO_PHOTOS);
  const opened = await editor.open();
  assert.ok(opened);
  assert.ok(opened.content.layout.departments.some((b) => b.id === block.id), "still in the layout until a save");
  const heads = (await openedPage(editor)).departments.groups.flatMap((g) => g.members.filter((m) => m.kind === "head"));
  assert.ok(heads.length > 0 && !heads.some((m) => m.name === head.name), "not drawn");
  assert.ok((await editor.save("save-draft", opened.content, await rowsOf(store))).ok);
  const saved = await editor.open();
  assert.ok(!saved?.content.layout.departments.some((b) => b.id === block.id), "gone from the layout");
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
  const layer = memoryContentStore<StoredTeamPage>([]);
  const seed = importedAdvisors();
  const full = memoryContentStore<AdvisorVersion>(seed, async (items) => (items.length > seed.length + 1 ? "The store failed." : null));
  const failing = teamPageEditor(admin, memoryTeamPageStore(layer, full), async () => roles, team, NO_PHOTOS);
  const newAdvisor = (name: string): AdvisorRow => ({ id: null, fields: { name, role: "Propulsion", standing: "specialist", photo: null, linkedin: "", email: "" } });
  const result = await failing.save("publish", renamed, [...advisorRowsOf(seed), newAdvisor("Prof. Ada Rossi"), newAdvisor("Prof. Bea Neri")]);
  assert.deepEqual(result, refused("The store failed."));
  assert.deepEqual(await layer.list(), [], "no layer written");
  assert.deepEqual(await full.list(), seed, "no advisor written, not even the first");
});

test("the editor writes through the store's one save: never the layer or advisors one by one", async () => {
  const fail = async (): Promise<never> => assert.fail("written outside the one save");
  const layer = { ...memoryContentStore<StoredTeamPage>([]), create: fail, update: fail, remove: fail, setOrder: fail };
  let saves = 0;
  const store: TeamPageStore = {
    layer,
    advisors: async () => importedAdvisors(),
    save: async () => (saves++, refused("The database is down.")),
  };
  const editor = teamPageEditor(admin, store, async () => roles, team, NO_PHOTOS);
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
  // Behind the guards that refuse a save made on rows another save replaced (issue #831).
  assert.match(source, /runAuditBatch\(\(db\) => \[\.\.\.unchanged\(db\), \.\.\.layerVersionWrites\(db, layer\), \.\.\.advisorWriteQueries\(db, advisors\)\]\)/);
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
      adopt: async (photo: PersonPhoto) => photo,
      drop: async () => {},
      gone: async () => [],
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
  const published = await editor.save("publish", withLeader({ photo: uploaded.value }), rows);
  assert.ok(published.ok, "the layout and the advisor rows take the uploaded src");
  // As /about/the-team reads it (./team-data.ts): the published layer, then the published advisors.
  const live = withAdvisors(await publicPage(store), publicAdvisors(await store.advisors()));
  assert.equal(live.orgChart.leader?.photo, STORED);
  assert.equal(live.advisors.people[0]?.photo, STORED);
});

// A replaced upload's file (issue #323): deleted once the write lands and no
// stored layer version or advisor row uses it, through deleteBestEffort, so a
// failed delete never fails the save.

const OWN_HOST = publicStoreHost("store_Own123");
const ownUrl = (pathname: string) => `https://own123.public.blob.vercel-storage.com/${pathname}` as `https://${string}`;
const MEMBER_PICTURE = ownUrl("photos/member-7.jpg");

/** A store that keeps nothing, where every file is stored and no other row names one. */
const noWrites: TeamPageFileWrites = {
  upload: async (pathname) => ({ url: ownUrl(pathname) }),
  remove: async () => {},
  copy: async (_from, to) => ({ url: ownUrl(to) }),
  uploadedAt: async () => new Date(),
  unreferenced: async (pathnames) => pathnames,
};

/** The Team page's photos over a store that keeps nothing; `copied` records each copy, and `named` are files other rows name. */
function storePhotos(remove: (pathname: string) => Promise<void>, copied: string[] = [], named: readonly string[] = []) {
  let n = 0;
  return publicStoreTeamPagePhotos(
    OWN_HOST,
    {
      upload: async (pathname) => ({ url: ownUrl(pathname) }),
      remove,
      copy: async (from, to) => {
        copied.push(`${from} -> ${to}`);
        return { url: ownUrl(to) };
      },
      uploadedAt: async () => new Date(),
      unreferenced: async (pathnames) => pathnames.filter((p) => !named.includes(p)),
    },
    () => String(++n),
  );
}

async function uploaded(editor: ReturnType<typeof teamPageEditor>) {
  const result = await editor.uploadPhoto({ name: "photo.jpg", contentType: "image/jpeg", bytes: JPEG });
  assert.ok(result.ok);
  return result.value;
}

test("a replaced uploaded photo's file is deleted after the write lands, once no stored version or advisor row uses it", async () => {
  const removed: string[] = [];
  const copied: string[] = [];
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(
    siteContent,
    store,
    async () => roles,
    team,
    storePhotos(async (pathname) => {
      removed.push(pathname);
      assert.notEqual(publishedLeaderPhoto(await store.layer.list()), ownUrl(pathname), "deleted only after the write landed");
    }, copied),
  );
  const [a, b, c, d] = [await uploaded(editor), await uploaded(editor), await uploaded(editor), await uploaded(editor)];
  const withAdvisorPhoto = async (photo: PersonPhoto) => {
    const [first, ...rest] = await rowsOf(store);
    return [{ ...first, fields: { ...first.fields, photo } }, ...rest];
  };

  // The member's own picture is kept as a copy of its own (Owner decision, issue #831).
  assert.ok((await editor.save("publish", withLeader({ photo: a }), await withAdvisorPhoto(MEMBER_PICTURE))).ok);
  assert.deepEqual(copied, ["photos/member-7.jpg -> photos/team-page-5.jpg"]);
  assert.equal(publicAdvisors(await store.advisors())[0]?.photo, ownUrl("photos/team-page-5.jpg"), "the advisor row names the copy, not the member's file");
  assert.deepEqual(removed, []);

  // A draft replaces both, but the published version still shows them.
  assert.ok((await editor.save("save-draft", withLeader({ photo: b }), await withAdvisorPhoto(c))).ok);
  assert.deepEqual(removed, [], "the published version still uses them");

  // Publish: the leader's upload and the copy go; the member's own picture is never this editor's to delete.
  assert.ok((await editor.save("publish", withLeader({ photo: b }), await withAdvisorPhoto(c))).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg", "photos/team-page-5.jpg"]);

  // Reset to team drops a draft's upload the published version never showed.
  assert.ok((await editor.save("save-draft", withLeader({ photo: d }), await rowsOf(store))).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg", "photos/team-page-5.jpg"], "the published version still shows b");
  assert.ok((await editor.reset()).ok);
  assert.deepEqual(removed, ["photos/team-page-1.jpg", "photos/team-page-5.jpg", "photos/team-page-4.jpg"]);
});

test("a photo picked from a member is copied once for each row that shows it, and a save is refused when its file is gone", async () => {
  const copied: string[] = [];
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(siteContent, store, async () => roles, team, storePhotos(async () => {}, copied));
  const [first, ...rest] = await rowsOf(store);
  const rows = [{ ...first, fields: { ...first.fields, photo: MEMBER_PICTURE } }, ...rest];
  assert.ok((await editor.save("publish", withLeader({ photo: MEMBER_PICTURE }), rows)).ok);
  assert.deepEqual(
    copied,
    ["photos/member-7.jpg -> photos/team-page-1.jpg", "photos/member-7.jpg -> photos/team-page-2.jpg"],
    "one copy for the layout and one for the advisor row",
  );
  assert.equal(publishedLeaderPhoto(await store.layer.list()), ownUrl("photos/team-page-1.jpg"));
  assert.equal(publicAdvisors(await store.advisors())[0]?.photo, ownUrl("photos/team-page-2.jpg"), "the advisor row has a copy of its own");

  const gone = publicStoreTeamPagePhotos(OWN_HOST, { ...noWrites, copy: async () => null }, () => "x");
  const refusedEditor = teamPageEditor(siteContent, store, async () => roles, team, gone);
  assert.deepEqual(
    await refusedEditor.save("publish", withLeader({ photo: ownUrl("photos/member-8.jpg") }), await rowsOf(store)),
    refused(PICKED_PHOTO_GONE),
  );
});

test("a Team page save made on a layer another save replaced in the meantime is refused", async () => {
  const { store } = editorOver(siteContent);
  const racing: TeamPageStore = {
    ...store,
    async save(layer, advisors, expected) {
      // Another save lands between this one's read and its write.
      await store.save({ state: "published", published: storedTeamPage(roles, { ...NO_TEAM_LAYER, intro: "Theirs" }), draft: null }, [], expected);
      return store.save(layer, advisors, expected);
    },
  };
  const editor = teamPageEditor(siteContent, racing, async () => roles, team, NO_PHOTOS);
  assert.deepEqual(await editor.save("publish", { ...plain, text: { ...plain.text, intro: "Mine" } }, await rowsOf(store)), refused(CHANGED_SINCE_READ));
  assert.equal(publishedTeamPage(await store.layer.list()).layer.intro, "Theirs");
});

test("an uploaded group photo is in use while any stored version shows it, and its file goes once none does", async () => {
  const removed: string[] = [];
  const { store } = editorOver(siteContent);
  const editor = teamPageEditor(siteContent, store, async () => roles, team, storePhotos(async (pathname) => void removed.push(pathname)));
  const [a, b] = [await uploaded(editor), await uploaded(editor)];
  const withGroup = (src: PersonPhoto): TeamPageContent => ({ ...plain, text: { ...plain.text, groupPhoto: { src, alt: "The team" } } });

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
  assert.ok((await editor.save("publish", withLeader({ photo: a }), await rowsOf(store))).ok);

  const replaced = await editor.save("publish", withLeader({ photo: b }), await rowsOf(store));
  assert.ok(replaced.ok, "the save stands");
  assert.equal(publishedLeaderPhoto(await store.layer.list()), b);
  assert.deepEqual(
    log.mock.calls.map((call) => call.arguments),
    [["Blob delete failed (store: public, area: team-photo): Blob is down for [file]"]],
  );
});
