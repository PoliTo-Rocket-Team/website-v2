import assert from "node:assert/strict";
import { test } from "node:test";
import { contentEditor } from "@/lib/content/editor";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { importedRecords } from "@/lib/project-content/import";
import { pageRecordOf, type ProjectRecord, type StoredLaunch, type VehicleRecord } from "@/lib/project-content/record";
import { PREVIEW_FULL } from "./content-edits";
import {
  dummyProjectSeed,
  dummyProjectStore,
  NO_PROJECT_EDITS,
  parseProjectEdits,
  serializeProjectEdits,
  type DummyProjectEdits,
  type DummyProjectEditsStore,
} from "./projects";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// The projects on previews and in test-developer sessions (issue #295): the
// seed is the import, and a test developer's changes are kept per section in
// their cookie, never in a database.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie(): DummyProjectEditsStore & { value: string | undefined } {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyProjectEdits {
      return parseProjectEdits(jar.value);
    },
    save: async (next: DummyProjectEdits) => {
      jar.value = serializeProjectEdits(next);
    },
  };
  return jar;
}

const save = (record: ProjectRecord) => async () => ({ ok: true as const, value: record });

const [cavour, ves] = importedRecords as [VehicleRecord, VehicleRecord, ProjectRecord];

const newLaunch: StoredLaunch = {
  date: "10 Oct 2026",
  where: "EuRoC, Santa Margarida, Portugal",
  result: "Nominal. Recovered intact.",
  title: "European Rocketry Challenge",
  place: { text: "Santa Margarida, Portugal" },
  version: "CVR 100-75-4",
  motor: "CTI L1350",
  summary: { text: "A fourth flight, nominal from boost to landing.", phone: "Nominal from boost to landing." },
  outcome: "nominal",
  flight: { apogee: "3 000 m", maxSpeed: "290 m/s", country: "Portugal" },
  stats: [
    { value: "15 G", label: "BOOST ACCEL" },
    { value: "5 / 25", label: "OVERALL RANK", phoneLabel: "OVERALL" },
  ],
  phoneStat: 1,
};

test("previews start from the import: the public versions are the imported records, with VES holding draft changes", () => {
  const seed = dummyProjectSeed();
  assert.deepEqual(publicItems(seed), importedRecords);
  assert.deepEqual(seed.map((item) => statusOf(item.version)), ["published", "draft-changes", "published"]);
});

test("a test developer's edit keeps only the sections it changed, fits the cookie, and is read back on the next request", async () => {
  const jar = cookie();
  const editor = contentEditor(admin, dummyProjectStore(jar));
  const withLaunch: VehicleRecord = { ...cavour, launches: { ...cavour.launches!, entries: [...cavour.launches!.entries, newLaunch] } };
  assert.ok((await editor.save(1, "publish", save(withLaunch))).ok);
  assert.ok((await editor.save(3, "save-draft", save({ ...importedRecords[2], teaser: "Edited." }))).ok);

  const kept = parseProjectEdits(jar.value);
  assert.deepEqual(kept.saved.map((item) => [item.id, Object.keys(editorVersion(item.version))]), [
    [1, ["launches"]],
    [3, ["teaser"]],
  ]);
  assert.ok(jar.value!.length <= DUMMY_STATE_COOKIE_BYTES, `${jar.value!.length} bytes`);

  // The next request reads the cookie again.
  const next = await dummyProjectStore(jar).list();
  const shown = publicItems(next);
  assert.equal(pageRecordOf(shown[0]).launches?.entries.length, 4);
  assert.equal(shown[2].teaser, importedRecords[2].teaser, "a draft is not published");
  assert.equal(editorVersion(next[2].version).teaser, "Edited.");
  assert.equal(editorVersion(next[1].version).teaser, editorVersion(dummyProjectSeed()[1].version).teaser, "VES keeps its seeded draft");
});

test("an optional section switched off is kept as left out, and comes back when switched on", async () => {
  const jar = cookie();
  const editor = contentEditor(admin, dummyProjectStore(jar));
  const { gallery: _, ...noGallery } = ves;
  assert.ok((await editor.save(2, "save-draft", save(noGallery))).ok);
  assert.equal(editorVersion((await dummyProjectStore(jar).list())[1].version).gallery, undefined);
  assert.ok((await editor.save(2, "save-draft", save(ves))).ok);
  assert.deepEqual(editorVersion((await dummyProjectStore(jar).list())[1].version), ves);
});

/** Text that does not compress: each character drawn from a fixed pseudo-random sequence. */
function noise(length: number, seed: number): string {
  let state = seed;
  let text = "";
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    text += "abcdefghijklmnopqrstuvwxyz0123456789"[state % 36];
  }
  return text;
}

test("an edit the cookie cannot hold is refused with a message, and nothing changes", async () => {
  const jar = cookie();
  const editor = contentEditor(admin, dummyProjectStore(jar));
  const bloated: VehicleRecord = { ...cavour, description: noise(3000, 1), teaser: noise(3000, 2) };
  const result = await editor.save(1, "save-draft", save(bloated));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, PREVIEW_FULL);
  assert.equal(jar.value, undefined, "the cookie is untouched");
  assert.equal(statusOf((await dummyProjectStore(jar).list())[0].version), "published");
});

test("a cookie this code did not write, or a change that no longer reads as a record, reads as no change", async () => {
  assert.deepEqual(parseProjectEdits("not a cookie"), NO_PROJECT_EDITS);
  const strange = { saved: [{ id: 1, siteOrder: 1, version: { state: "published", published: { colour: "red" }, draft: null } }], removed: [], order: [] };
  assert.deepEqual(parseProjectEdits(serializeProjectEdits(strange as never)), NO_PROJECT_EDITS, "not a section");

  const broken: DummyProjectEdits = { saved: [{ id: 1, siteOrder: 1, version: { state: "published", published: { hero: null }, draft: null } }], removed: [], order: [] };
  const jar = { current: parseProjectEdits(serializeProjectEdits(broken)), save: async () => {} };
  assert.equal(jar.current.saved.length, 1);
  assert.deepEqual(publicItems(await dummyProjectStore(jar).list()), importedRecords, "a record with no hero is dropped");
});
