import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import type { PhotoFiles } from "@/lib/outreach-photos";
import { sectionsOf } from "@/lib/project-pages";
import { launchCounts } from "@/lib/projects";
import { projectEditor } from "./editor";
import { checkProjectFields, fieldProblems, fieldsAfterSave, fieldsOf, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
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
import { homeCardOf, listingOf, logEntry, pageRecordOf, type VehicleRecord } from "./record";

// The list sections of the Edit <project> panel (issue #299): Versions,
// Launch history, Plan and Gallery, their shape rules, and a launch added
// from the panel reaching the page, the home card and the /projects counts.

const [cavour, ves, efesto] = importedRecords as [VehicleRecord, VehicleRecord, (typeof importedRecords)[2]];
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

const UPLOADED = "https://abc.public.blob.vercel-storage.com/project-photos/new.jpg" as const;
const files: PhotoFiles = { put: async () => UPLOADED, owns: (src): src is typeof UPLOADED => src === UPLOADED, drop: async () => {} };

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

test("a launch card holds date, place, version, motor, outcome, what happened, four numbers (three on the phone), award and photos", () => {
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
  assert.deepEqual(entry.photos, [{ src: UPLOADED, alt: "VES on the rail at dawn" }]);

  const grounded = logEntry(launchOf({ ...newLaunch, outcome: "did-not-fly", phoneDrops: 0, award: { name: "", short: "", citation: "" }, photos: [] }));
  assert.deepEqual(grounded.phoneStats.map((s) => s.value), ["520 m/s", "12 G", "1 / 30"], "a launch that did not fly gives its own four");
  assert.equal(grounded.award, undefined);
  assert.equal(grounded.photos, undefined, "no photos is no key, and the page shows the texture slots");
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
      page: pageRecordOf(records[0]).launches?.entries.map((e) => e.title),
    };
  };
  const before = await shown();
  assert.deepEqual(before.counts, ["4 FLIGHTS", "3 COUNTRIES", "3 AWARDS"]);
  assert.equal(before.card, "FLOWN ×3", "Cavour's card counts its flights");

  const fields = fieldsOf(cavour);
  const added: ProjectFields = { ...fields, launches: { ...fields.launches, items: [...fields.launches.items, { ...newLaunch, version: fields.versions.items[0].pill }] } };

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
  const highlighted = vesFields.versions.items.findIndex((v) => v.highlighted);
  assert.deepEqual(removeVersion(vesFields.versions, highlighted), { ok: false, error: VERSION_KEEPS_HIGHLIGHT }, "no highlighted version");
  const other = highlighted === 0 ? 1 : 0;
  const moved = highlightVersion(vesFields.versions, other);
  assert.ok(removeVersion(moved, highlighted).ok, "once another is highlighted, it can go");

  const one = { ...vesFields.launches, items: vesFields.launches.items.slice(0, 1) };
  assert.deepEqual(removeLaunch(one, 0), { ok: false, error: HISTORY_KEEPS_A_LAUNCH }, "no launch in a shown history");
  assert.ok(removeLaunch({ ...one, shown: false }, 0).ok, "a history off the page may be emptied");

  const plan = fieldsOf(efesto).plan;
  const now = plan.steps.findIndex((s) => s.status === "now");
  assert.deepEqual(setStepStatus(plan, now, "done"), { ok: false, error: PLAN_KEEPS_A_STEP_UNDER_WAY }, "no plan step under way");
  assert.deepEqual(removeStep(plan, now), { ok: false, error: PLAN_KEEPS_A_STEP_UNDER_WAY });
  const next = plan.steps.findIndex((s) => s.status === "next");
  const advanced = setStepStatus(plan, next, "now");
  assert.ok(advanced.ok);
  assert.deepEqual(
    [advanced.value.steps[now].status, advanced.value.steps[next].status],
    ["done", "now"],
    "marking another step under way marks the old one done",
  );

  const gallery = { ...fieldsOf(ves).gallery, items: fieldsOf(ves).gallery.items.slice(0, 1) };
  assert.deepEqual(removeGalleryItem(gallery, 0), { ok: false, error: GALLERY_KEEPS_A_PHOTO });
});

test("a save whose fields break a shape rule is refused with a message, whatever the browser checked", async () => {
  const fields = fieldsOf(ves);
  const plan = fieldsOf(efesto);
  const broken = [
    {
      rule: "no highlighted version",
      id: 2,
      opened: ves,
      sent: { ...fields, versions: { ...fields.versions, items: fields.versions.items.map((v) => ({ ...v, highlighted: false })) } },
      error: "Highlight one version.",
    },
    { rule: "no launch in a shown history", id: 2, opened: ves, sent: { ...fields, launches: { ...fields.launches, items: [] } }, error: HISTORY_KEEPS_A_LAUNCH },
    {
      rule: "no plan step under way",
      id: 3,
      opened: efesto,
      sent: { ...plan, plan: { ...plan.plan, steps: plan.plan.steps.map((s) => ({ ...s, status: "done" as const })) } },
      error: "Mark one plan step under way.",
    },
  ];
  for (const { rule, id, opened, sent, error } of broken) {
    assert.deepEqual(checkProjectFields(sent, opened), { ok: false, error }, rule);
    const store = memoryContentStore(importedProjects());
    const result = await projectEditor(admin, store).saveFields(id, "publish", sent);
    assert.deepEqual(result, { ok: false, error }, rule);
    assert.deepEqual(await store.list(), importedProjects(), `${rule}: nothing changes`);
  }
  assert.deepEqual(fieldProblems({ ...fields, launches: { ...fields.launches, shown: false, items: [] } }), [], "a section off the page never stops a save");
});

test("a launch photo and a gallery photo with no description pass the checks and publish with an empty alt", async () => {
  const fields = fieldsOf(ves);
  const launch: LaunchFields = { ...newLaunch, version: fields.versions.items[0].pill, photos: [{ src: UPLOADED, alt: "  " }] };
  const sent: ProjectFields = {
    ...fields,
    launches: { ...fields.launches, items: [...fields.launches.items, launch] },
    gallery: { ...fields.gallery, items: [...fields.gallery.items, { src: UPLOADED, alt: "", caption: "" }] },
  };
  assert.deepEqual(fieldProblems(sent), []);
  const saved = await projectEditor(admin, memoryContentStore(importedProjects()), undefined, files).saveFields(2, "publish", sent);
  assert.ok(saved.ok);
  const page = pageRecordOf(editorVersion(saved.value.version) as VehicleRecord);
  assert.deepEqual(page.launches?.entries.at(-1)?.photos, [{ src: UPLOADED, alt: "" }]);
  assert.equal(page.gallery?.items.at(-1)?.alt, "");
});

test("switching a list section off drops it and closes up the numbers; its text survives a save", async () => {
  const fields = fieldsOf(cavour);
  const off: ProjectFields = { ...fields, launches: { ...fields.launches, shown: false } };
  assert.deepEqual(
    sectionsOf(pageRecordOf(projectViewOf(off, cavour))).map((s) => `${s.num} ${s.kind}`),
    ["03 versions", "04 gallery"],
  );
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const saved = await editor.saveFields(1, "save-draft", off);
  assert.ok(saved.ok);
  const stored = editorVersion(saved.value.version) as VehicleRecord;
  assert.equal(stored.launches, undefined);
  const after = fieldsAfterSave(stored, off);
  assert.deepEqual(projectViewOf({ ...after, launches: { ...after.launches, shown: true } }, stored), cavour, "switched back on, the same launches return");
});

test("a save carries only photos the version had or this side uploaded; uploads pass the site-content gate", async () => {
  const fields = fieldsOf(ves);
  const withPhoto = (src: string): ProjectFields => ({
    ...fields,
    gallery: { ...fields.gallery, items: [...fields.gallery.items, { src, alt: "The team at the pad", caption: "" }] },
  });
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
  const fields = fieldsOf(ves);
  const on: ProjectFields = { ...fields, gallery: { ...fields.gallery, items: [...fields.gallery.items, { src: UPLOADED, alt: "The pad", caption: "" }] } };
  assert.ok((await editor.saveFields(2, "publish", on)).ok);

  const off: ProjectFields = { ...on, gallery: { ...on.gallery, shown: false } };
  assert.ok((await editor.saveFields(2, "publish", off)).ok);
  assert.deepEqual(dropped, [], "a save with Gallery off keeps the file the panel holds");
  assert.ok((await editor.saveFields(2, "publish", on)).ok, "switched back on, the photo publishes again");

  const removed = removeGalleryItem(on.gallery, on.gallery.items.length - 1);
  assert.ok(removed.ok);
  assert.deepEqual(removed.value.letGo, [UPLOADED]);
  await editor.discardPhoto(UPLOADED);
  assert.deepEqual(dropped, [], "a published version still shows it");
  assert.ok((await editor.saveFields(2, "publish", { ...on, gallery: removed.value.fields })).ok);
  assert.deepEqual(dropped, [UPLOADED], "once nothing shows or holds it, the file goes");

  dropped.length = 0;
  const launches = { ...fields.launches, items: [...fields.launches.items, newLaunch] };
  const gone = removeLaunch(launches, launches.items.length - 1);
  assert.ok(gone.ok);
  assert.deepEqual(gone.value.letGo, [UPLOADED], "removing a launch lets its unsaved photos go");
  await editor.discardPhoto(UPLOADED);
  assert.deepEqual(dropped, [UPLOADED]);
});

test("a request is read as the list fields only in their shape", () => {
  const fields = fieldsOf(ves);
  assert.deepEqual(readProjectFields(JSON.parse(JSON.stringify(fields))), fields);
  const broken = [
    { ...fields, versions: { ...fields.versions, shown: "yes" } },
    { ...fields, launches: { ...fields.launches, items: [{ ...fields.launches.items[0], outcome: "exploded" }] } },
    { ...fields, launches: { ...fields.launches, items: [{ ...fields.launches.items[0], numbers: fields.launches.items[0].numbers.slice(0, 3) }] } },
    { ...fields, launches: { ...fields.launches, items: [{ ...fields.launches.items[0], photos: [{ src: "javascript:alert(1)", alt: "" }] }] } },
    { ...fields, plan: { ...fields.plan, steps: [{ status: "soon", date: "", title: "", text: { text: "", phone: "" } }] } },
  ];
  for (const sent of broken) assert.equal(readProjectFields(sent), null);
});
