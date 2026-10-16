import assert from "node:assert/strict";
import { test } from "node:test";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import { partnerEditor } from "@/lib/partners-editor";
import { fieldsOf } from "@/lib/partners-fields";
import { partners as record } from "@/lib/partners";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import {
  dummyLogoFiles,
  dummyPartnerStore,
  NO_PARTNER_EDITS,
  parsePartnerEdits,
  PREVIEW_FULL,
  serializePartnerEdits,
  UNKEPT_LOGO_SRC,
  type DummyPartnerEdits,
  type DummyPartnerEditsStore,
} from "./partners";

// Partners on previews and in test-developer sessions (issue #256): the
// dummy side, with a test developer's changes in their cookie, never a
// database.

const recruitment = { current: dummyRecruitmentOf(undefined), save: async () => {} };
const changes = { current: EMPTY_DUMMY_STATE, save: async () => {} };

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie(): DummyPartnerEditsStore & { value: string | undefined } {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyPartnerEdits {
      return parsePartnerEdits(jar.value);
    },
    save: async (next: DummyPartnerEdits) => {
      jar.value = serializePartnerEdits(next);
    },
  };
  return jar;
}

const admin = { kind: "operations-lead", seat: "operations-lead", siteContent: false, approveOrders: false } as const;
const tinyPng = { name: "logo.png", contentType: "image/png", bytes: new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")) };

test("the test developer's dashboard lists the dummy partners, with EvoMisure holding draft changes as on board 76", async () => {
  const data = dummyDashboardData("operations-lead", recruitment, changes);
  const items = await data.partners.list();
  assert.ok(items !== null);
  assert.deepEqual(publicItems(items), record, "the public versions are the record's");
  assert.equal(statusOf(items.find((i) => editorVersion(i.version).name === "EvoMisure")!.version), "draft-changes");

  for (const kind of ["department-head", "division-lead", "member", "non-member"] as const) {
    assert.equal(await dummyDashboardData(kind, recruitment, changes).partners.list(), null, kind);
  }
});

test("a test developer's changes stay in their cookie, across requests", async () => {
  const jar = cookie();
  const first = partnerEditor(admin, dummyPartnerStore(jar), dummyLogoFiles);
  assert.ok((await first.save(1, "save-draft", { ...fieldsOf(record[0]), oneLiner: "Edited." }, null)).ok);
  assert.ok((await first.remove(13)).ok);
  assert.ok((await first.reorder("main", [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).ok);

  // The next request reads the cookie again.
  const next = await dummyPartnerStore(jar).list();
  assert.equal(editorVersion(next.find((i) => i.id === 1)!.version).oneLiner, "Edited.");
  assert.ok(!next.some((i) => i.id === 13));
  assert.deepEqual(publicItems(next).slice(0, 2).map((p) => p.name), ["Siemens", "Sòphia High Tech"]);
});

test("a logo uploaded on a preview shows in the answer, and the cookie keeps no file", async () => {
  const jar = cookie();
  const editor = partnerEditor(admin, dummyPartnerStore(jar), dummyLogoFiles);
  const saved = await editor.save(null, "publish", { ...fieldsOf(null), name: "Newco", oneLiner: "Parts." }, tinyPng);
  assert.ok(saved.ok);
  assert.match(editorVersion(saved.value.version).logo.src, /^data:image\/png;base64,/);
  const kept = (await dummyPartnerStore(jar).list()).find((i) => i.id === saved.value.id)!;
  assert.equal(editorVersion(kept.version).logo.src, UNKEPT_LOGO_SRC);
});

test("a write the cookie cannot hold is refused, and a cookie this code did not write reads as no changes", async () => {
  const jar = cookie();
  const editor = partnerEditor(admin, dummyPartnerStore(jar), dummyLogoFiles);
  const long = { about: "a".repeat(220), support: "s".repeat(160) };
  let refusal: string | null = null;
  for (let id = 1; id <= 12 && refusal === null; id++) {
    const result = await editor.save(id, "save-draft", { ...fieldsOf(record[id - 1]), ...long }, null);
    if (!result.ok) refusal = result.error;
  }
  assert.equal(refusal, PREVIEW_FULL);
  assert.deepEqual(parsePartnerEdits("not json"), NO_PARTNER_EDITS);
  assert.deepEqual(parsePartnerEdits(encodeURIComponent(JSON.stringify({ saved: [{ id: 1, siteOrder: 1, version: { state: "draft" } }] }))), NO_PARTNER_EDITS);
});
