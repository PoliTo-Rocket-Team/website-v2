import assert from "node:assert/strict";
import { test } from "node:test";
import { faqs as record } from "@/lib/apply/page";
import { editorVersion, statusOf } from "@/lib/content/versioned";
import { faqEditor } from "@/lib/faq/editor";
import { publicFaqs, updatedLabel } from "@/lib/faq/faq";
import { dummyApplyData } from "./apply";
import { NO_CONTENT_EDITS } from "./content-edits";
import { dummyFaqNow, dummyFaqStore, parseFaqEdits, serializeFaqEdits, type DummyFaqEdits, type DummyFaqEditsStore } from "./faqs";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// The questions on previews and in test-developer sessions (issue #258): the
// dummy side, with a test developer's changes in their own cookie, never a
// database, and /apply on the published versions.

const recruitment = { current: dummyRecruitmentOf(undefined), save: async () => {} };
const changes = { current: EMPTY_DUMMY_STATE, save: async () => {} };
const admin = { kind: "operations-lead", seat: "team-leader", siteContent: false } as const;

/** A cookie that keeps what was saved, as the browser does between requests. */
function cookie(): DummyFaqEditsStore & { value: string | undefined } {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyFaqEdits {
      return parseFaqEdits(jar.value);
    },
    save: async (next: DummyFaqEdits) => {
      jar.value = serializeFaqEdits(next);
    },
  };
  return jar;
}

test("the dummy dashboard lists the eleven questions as board 79 does, and /apply shows their published text", async () => {
  const list = await dummyDashboardData("operations-lead", recruitment, changes).faqs.list();
  assert.ok(list !== null);
  assert.deepEqual(
    list.items.map((item) => [statusOf(item.version), updatedLabel(editorVersion(item.version).updatedAt, list.now)]),
    record.map((_, i) => (i === 2 ? ["draft-changes", "Today"] : ["published", "12 Sep"])),
  );
  assert.deepEqual(publicFaqs(list.items), record);
  assert.deepEqual(await dummyApplyData(null, null).faqs(), record);
  assert.equal(await dummyDashboardData("division-lead", recruitment, changes).faqs.list(), null);
});

test("a test developer's changes stay in their cookie across requests, and a cookie this code did not write reads as none", async () => {
  const jar = cookie();
  const editor = faqEditor(admin, dummyFaqStore(jar), dummyFaqNow);
  assert.ok((await editor.save(1, "publish", { question: "Edited?", answer: ["Yes."] })).ok);
  assert.ok((await editor.remove(11)).ok);

  const next = await dummyFaqStore(jar).list();
  assert.equal(publicFaqs(next)[0].question, "Edited?");
  assert.equal(next.length, 10);

  const forged = { saved: [{ id: 1, siteOrder: 1, version: { state: "published", published: { question: "Q?", answer: [], updatedAt: "2026-10-09" }, draft: null } }], removed: [], order: [] };
  assert.deepEqual(parseFaqEdits(encodeURIComponent(JSON.stringify(forged))), NO_CONTENT_EDITS);
  assert.deepEqual(parseFaqEdits("not json"), NO_CONTENT_EDITS);
});
