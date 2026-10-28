import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import type { PhotoFiles } from "@/lib/outreach-photos";
import type { LogEntry, PageBlock } from "@/lib/project-pages";
import { launchCounts } from "@/lib/projects";
import type { BlockFields } from "./block-fields";
import { removeBlock } from "./block-list";
import { projectEditor } from "./editor";
import { checkProjectFields, fieldProblems, fieldsOf, heldPhotos, readProjectFields, type ProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import {
  blankLaunch,
  GALLERY_KEEPS_A_PHOTO,
  HISTORY_KEEPS_A_LAUNCH,
  highlightVersion,
  launchOf,
  PLAN_KEEPS_A_STEP_UNDER_WAY,
  removeGalleryItem,
  removeLaunch,
  removeStep,
  removeVersion,
  setOutcome,
  setStepStatus,
  VERSION_KEEPS_HIGHLIGHT,
  type LaunchFields,
} from "./list-fields";
import { homeCardOf, listingOf, logEntry, pageRecordOf, type ProjectRecord, type VehicleRecord } from "./record";

// The list blocks of the Edit <project> panel (issue #299, epic #522):
// Versions, Launch history, Timeline and Gallery, their shape rules, and a
// launch added from the panel reaching the page, the home card and the
// /projects counts.

/** The page's launch cards, as it draws them. */
const launchCards = (record: ProjectRecord): readonly LogEntry[] | undefined =>
  pageRecordOf(record).blocks.find((b): b is Extract<PageBlock, { kind: "launches" }> => b.kind === "launches")?.entries;

const [cavour, ves, efesto] = importedRecords as [VehicleRecord, VehicleRecord, (typeof importedRecords)[2]];
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

const UPLOADED = "https://abc.public.blob.vercel-storage.com/project-photos/new.jpg" as const;
const files: PhotoFiles = { put: async () => UPLOADED, owns: (src): src is typeof UPLOADED => src === UPLOADED, drop: async () => {}, gone: async () => [] };

type Of<K extends BlockFields["kind"]> = Extract<BlockFields, { kind: K }>;

/** The panel's first block of `kind`. */
const blockIn = <K extends BlockFields["kind"]>(fields: ProjectFields, kind: K): Of<K> => fields.blocks.find((b) => b.kind === kind) as Of<K>;

/** The fields with their first block of `kind` changed. */
function withBlock<K extends BlockFields["kind"]>(fields: ProjectFields, kind: K, change: (block: Of<K>) => Of<K>): ProjectFields {
  const target = blockIn(fields, kind);
  return { ...fields, blocks: fields.blocks.map((b) => (b === target ? change(target) : b)) };
}

const newLaunch: LaunchFields = {
  ...blankLaunch(),
  title: "Launch Week 2026",
  date: "10 Oct 2026",
  place: { text: "Ponte de Sor, Portugal", phone: "Ponte de Sor" },
  version: "VES MARK II",
  motor: "Aerotech O5500X",
  outcome: "nominal",
  summary: { text: "A clean flight to apogee and a soft landing.", phone: "Clean flight, soft landing." },
  numbers: [
    { value: "8 900 m", label: "APOGEE", phoneLabel: "" },
    { value: "520 m/s", label: "MAX SPEED", phoneLabel: "" },
    { value: "12 G", label: "BOOST ACCEL", phoneLabel: "BOOST" },
    { value: "1 / 30", label: "OVERALL RANK", phoneLabel: "RANK" },
  ],
  phoneDrops: 2,
  where: "Launch Week, Ponte de Sor, Portugal · Mark II",
  result: "Nominal flight, both halves recovered.",
  country: "Spain",
  award: { name: "BEST FLIGHT", short: "", citation: "" },
  photos: [{ src: UPLOADED, alt: "VES on the rail at dawn" }],
};

test("a launch card holds date, place, version, motor, outcome, what happened, four numbers (three on the phone), award and a cover photo", () => {
  const entry = logEntry(launchOf(newLaunch));
  assert.equal(entry.date, "10 Oct 2026");
  assert.deepEqual(entry.place, { text: "Ponte de Sor, Portugal", phone: "Ponte de Sor" });
  assert.equal(entry.version, "VES MARK II");
  assert.equal(entry.motor, "Aerotech O5500X");
  assert.equal(entry.outcome, "nominal");
  assert.deepEqual(entry.summary, { text: "A clean flight to apogee and a soft landing.", phone: "Clean flight, soft landing." });
  assert.deepEqual(
    entry.stats.map((s) => `${s.value} ${s.label}`),
    ["8 900 m APOGEE", "520 m/s MAX SPEED", "12 G BOOST ACCEL", "1 / 30 OVERALL RANK"],
  );
  assert.deepEqual(
    entry.phoneStats.map((s) => `${s.value} ${s.label}`),
    ["8 900 m APOGEE", "520 m/s MAX SPEED", "1 / 30 RANK"],
    "the phone leaves out the third number and uses the shorter label",
  );
  assert.deepEqual(entry.award, { name: "BEST FLIGHT" });
  assert.deepEqual(entry.cover, { src: UPLOADED, alt: "VES on the rail at dawn" });

  const grounded = logEntry(launchOf({ ...newLaunch, outcome: "did-not-fly", phoneDrops: 0, award: { name: "", short: "", citation: "" }, photos: [] }));
  assert.deepEqual(grounded.phoneStats.map((s) => s.value), ["520 m/s", "12 G", "1 / 30"], "a launch that did not fly gives its own four");
  assert.equal(grounded.award, undefined);
  assert.equal(grounded.cover, undefined, "no cover is no key, and the page shows the background in its slot");
});

test("turning a launch into a flight keeps apogee and max speed on the phone", () => {
  const [, b, c, d] = newLaunch.numbers;
  const grounded: LaunchFields = { ...newLaunch, outcome: "did-not-fly", phoneDrops: 1, numbers: [{ value: "9 000 m", label: "TARGET APOGEE", phoneLabel: "" }, b, c, d] };
  const flown = setOutcome(grounded, "recovery-failed");
  assert.equal(flown.phoneDrops, 3);
  assert.deepEqual(flown.numbers.slice(0, 2).map((n) => n.label), ["APOGEE", "MAX SPEED"]);
});

test("adding a launch and publishing it changes the project page, the home card and the /projects counts", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, files);
  const shown = async () => {
    const records = publicItems((await editor.list())!);
    return {
      counts: launchCounts(records.map(listingOf)).map((s) => `${s.value} ${s.label}`),
      card: homeCardOf(records[0], 0).status,
      page: launchCards(records[0])?.map((e) => e.title),
    };
  };
  const before = await shown();
  assert.deepEqual(before.counts, ["4 FLIGHTS", "3 COUNTRIES", "3 AWARDS"]);
  assert.equal(before.card, "FLOWN ×3", "Cavour's card counts its flights");

  const fields = fieldsOf(cavour);
  const version = blockIn(fields, "versions").items[0].pill;
  const added = withBlock(fields, "launches", (l) => ({ ...l, items: [...l.items, { ...newLaunch, version }] }));

  assert.ok((await editor.saveFields(1, "save-draft", added)).ok);
  assert.deepEqual(await shown(), before, "a draft launch changes nothing on the public site");

  assert.ok((await editor.saveFields(1, "publish", added)).ok);
  const after = await shown();
  assert.deepEqual(after.counts, ["5 FLIGHTS", "4 COUNTRIES", "4 AWARDS"]);
  assert.equal(after.card, "FLOWN ×4");
  assert.equal(after.page?.at(-1), "Launch Week 2026");
});

test("an edit that would break a shape rule is refused with a message", () => {
  const vesFields = fieldsOf(ves);
  const versions = blockIn(vesFields, "versions");
  const highlighted = versions.items.findIndex((v) => v.highlighted);
  assert.deepEqual(removeVersion(versions, highlighted), { ok: false, error: VERSION_KEEPS_HIGHLIGHT }, "no highlighted version");
  const other = highlighted === 0 ? 1 : 0;
  assert.ok(removeVersion(highlightVersion(versions, other), highlighted).ok, "once another is highlighted, it can go");

  const launches = blockIn(vesFields, "launches");
  assert.deepEqual(removeLaunch({ ...launches, items: launches.items.slice(0, 1) }, 0), { ok: false, error: HISTORY_KEEPS_A_LAUNCH }, "no launch in a history");

  const plan = blockIn(fieldsOf(efesto), "timeline");
  const now = plan.steps.findIndex((s) => s.status === "now");
  assert.deepEqual(setStepStatus(plan, now, "done"), { ok: false, error: PLAN_KEEPS_A_STEP_UNDER_WAY }, "no step under way");
  assert.deepEqual(removeStep(plan, now), { ok: false, error: PLAN_KEEPS_A_STEP_UNDER_WAY });
  const next = plan.steps.findIndex((s) => s.status === "next");
  const advanced = setStepStatus(plan, next, "now");
  assert.ok(advanced.ok);
  assert.deepEqual([advanced.value.steps[now].status, advanced.value.steps[next].status], ["done", "now"], "marking another step under way marks the old one done");

  const gallery = blockIn(vesFields, "gallery");
  assert.deepEqual(removeGalleryItem({ ...gallery, items: gallery.items.slice(0, 1) }, 0), { ok: false, error: GALLERY_KEEPS_A_PHOTO });
});

test("a save whose fields break a shape rule is refused with a message, whatever the browser checked", async () => {
  const fields = fieldsOf(ves);
  const plan = fieldsOf(efesto);
  const broken = [
    {
      rule: "no highlighted version",
      id: 2,
      opened: ves,
      sent: withBlock(fields, "versions", (v) => ({ ...v, items: v.items.map((x) => ({ ...x, highlighted: false })) })),
      error: "Highlight one version.",
    },
    { rule: "no launch in a history", id: 2, opened: ves, sent: withBlock(fields, "launches", (l) => ({ ...l, items: [] })), error: HISTORY_KEEPS_A_LAUNCH },
    {
      rule: "no launch in a hidden history",
      id: 2,
      opened: ves,
      sent: withBlock(fields, "launches", (l) => ({ ...l, hidden: true, items: [] })),
      error: HISTORY_KEEPS_A_LAUNCH,
    },
    {
      rule: "no step under way",
      id: 3,
      opened: efesto,
      sent: withBlock(plan, "timeline", (p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, status: "done" as const })) })),
      error: "Mark one step under way.",
    },
  ];
  for (const { rule, id, opened, sent, error } of broken) {
    assert.deepEqual(checkProjectFields(sent, opened), { ok: false, error }, rule);
    const store = memoryContentStore(importedProjects());
    const result = await projectEditor(admin, store).saveFields(id, "publish", sent);
    assert.deepEqual(result, { ok: false, error }, rule);
    assert.deepEqual(await store.list(), importedProjects(), `${rule}: nothing changes`);
  }
});

test("a launch photo and a gallery photo with no description pass the checks and publish with an empty alt", async () => {
  const fields = fieldsOf(ves);
  const version = blockIn(fields, "versions").items[0].pill;
  const sent = withBlock(
    withBlock(fields, "launches", (l) => ({ ...l, items: [...l.items, { ...newLaunch, version, photos: [{ src: UPLOADED, alt: "  " }] }] })),
    "gallery",
    (g) => ({ ...g, items: [...g.items, { src: UPLOADED, alt: "", caption: "" }] }),
  );
  assert.deepEqual(fieldProblems(sent), []);
  const saved = await projectEditor(admin, memoryContentStore(importedProjects()), undefined, files).saveFields(2, "publish", sent);
  assert.ok(saved.ok);
  const stored = editorVersion(saved.value.version);
  assert.deepEqual(launchCards(stored)?.at(-1)?.cover, { src: UPLOADED, alt: "" });
  const gallery = stored.blocks.find((b) => b.kind === "gallery");
  assert.equal(gallery?.kind === "gallery" ? gallery.items.at(-1)?.alt : null, "");
});

test("a save carries only photos the version had or this side uploaded; uploads pass the site-content gate", async () => {
  const fields = fieldsOf(ves);
  const withPhoto = (src: string) => withBlock(fields, "gallery", (g) => ({ ...g, items: [...g.items, { src, alt: "The team at the pad", caption: "" }] }));
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, files);
  assert.deepEqual(await editor.saveFields(2, "save-draft", withPhoto("https://elsewhere.example/a.jpg")), {
    ok: false,
    error: "A photo was not uploaded. Add it again.",
  });
  assert.ok((await editor.saveFields(2, "save-draft", withPhoto(UPLOADED))).ok);

  const jpeg = { name: "a.jpg", contentType: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) };
  assert.deepEqual(await editor.uploadPhoto(jpeg), { ok: true, value: UPLOADED });
  const member: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false };
  assert.equal((await projectEditor(member, memoryContentStore(importedProjects()), undefined, files).uploadPhoto(jpeg)).ok, false);
});

test("a photo file stays while the panel can still put it on the page, and goes once nothing can", async () => {
  const dropped: string[] = [];
  const recording: PhotoFiles = { ...files, drop: async (srcs) => void dropped.push(...srcs.filter((src) => src === UPLOADED)) };
  const editor = projectEditor(admin, memoryContentStore(importedProjects()), undefined, recording);
  const on = withBlock(fieldsOf(ves), "gallery", (g) => ({ ...g, items: [...g.items, { src: UPLOADED, alt: "The pad", caption: "" }] }));
  assert.ok((await editor.saveFields(2, "publish", on)).ok);

  const off = withBlock(on, "gallery", (g) => ({ ...g, hidden: true }));
  assert.ok((await editor.saveFields(2, "publish", off)).ok);
  assert.deepEqual(dropped, [], "a save with the gallery hidden keeps the file the panel holds");
  assert.ok((await editor.saveFields(2, "publish", on)).ok, "shown again, the photo publishes again");

  const gallery = blockIn(on, "gallery");
  const removed = removeGalleryItem(gallery, gallery.items.length - 1);
  assert.ok(removed.ok);
  assert.deepEqual(removed.value.letGo, [UPLOADED]);
  await editor.discardPhoto(UPLOADED);
  assert.deepEqual(dropped, [], "a published version still shows it");
  assert.ok((await editor.saveFields(2, "publish", withBlock(on, "gallery", (g) => ({ ...g, ...removed.value.fields })))).ok);
  assert.deepEqual(dropped, [UPLOADED], "once nothing shows or holds it, the file goes");

  dropped.length = 0;
  const launches = blockIn(fieldsOf(ves), "launches");
  const gone = removeLaunch({ ...launches, items: [...launches.items, newLaunch] }, launches.items.length);
  assert.ok(gone.ok);
  assert.deepEqual(gone.value.letGo, [UPLOADED], "removing a launch lets its unsaved photos go");
  await editor.discardPhoto(UPLOADED);
  assert.deepEqual(dropped, [UPLOADED]);
});

test("removing a block lets go only the photos no other block holds", () => {
  const fields = withBlock(fieldsOf(ves), "gallery", (g) => ({ ...g, items: [...g.items, { src: UPLOADED, alt: "", caption: "" }] }));
  const gallery = blockIn(fields, "gallery");
  const copy = { ...gallery, id: "gallery-2" };
  assert.deepEqual(removeBlock([...fields.blocks, copy], gallery.id).letGo, [], "a copy still holds the upload");
  assert.ok(removeBlock(fields.blocks, gallery.id).letGo.includes(UPLOADED));
  assert.ok(heldPhotos(fields).includes(UPLOADED), "the panel's fields hold it until then");
});

test("a request is read as the list blocks only in their shape", () => {
  const fields = fieldsOf(ves);
  assert.deepEqual(readProjectFields(JSON.parse(JSON.stringify(fields))), fields);
  const broken = [
    withBlock(fields, "launches", (l) => ({ ...l, items: [{ ...l.items[0], outcome: "exploded" as never }] })),
    withBlock(fields, "launches", (l) => ({ ...l, items: [{ ...l.items[0], numbers: l.items[0].numbers.slice(0, 3) as never }] })),
    withBlock(fields, "launches", (l) => ({ ...l, items: [{ ...l.items[0], photos: [{ src: "javascript:alert(1)" as never, alt: "" }] }] })),
    withBlock(fields, "versions", (v) => ({ ...v, items: [{ ...v.items[0], highlighted: "yes" as never }] })),
  ];
  for (const sent of broken) assert.equal(readProjectFields(JSON.parse(JSON.stringify(sent))), null);
});
