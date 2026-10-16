import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { faqs as record } from "@/lib/apply/page";
import { memoryContentStore } from "@/lib/content/memory";
import { canReach } from "@/lib/dashboard/access";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { faqEditor } from "./editor";
import { FAQ_QUESTION_MAX, publicFaqs, updatedLabel } from "./faq";
import { faqImportSql, importedFaqs } from "./import";

// The FAQ page's rules (issue #258) over an in-memory store: the same editor
// both sides of the dashboard data interface build. The draft and publish
// step and the site order themselves are lib/content/content.test.ts's.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false };
const NOW = new Date("2026-10-16T09:00:00.000Z");
const SEEDED = "2026-09-12T10:00:00.000Z";

function editorOver(viewer: ViewerStanding = admin) {
  const store = memoryContentStore(importedFaqs(SEEDED));
  return { store, editor: faqEditor(viewer, store, () => NOW) };
}

const questions = (faqs: readonly { question: string }[]) => faqs.map((f) => f.question);

test("migration 0025 holds exactly the import of the eleven questions, each one within the database's limits", () => {
  const migration = readFileSync(join(__dirname, "..", "..", "drizzle", "0025_faqs_audit_and_import.sql"), "utf8");
  assert.ok(migration.trimEnd().endsWith(faqImportSql()), "regenerate the migration's import from faqImportSql()");
  assert.equal(faqImportSql().split("--> statement-breakpoint").length, 11);
  assert.equal(record.length, 11);
  for (const faq of record) assert.ok([...faq.question].length <= FAQ_QUESTION_MAX, faq.question);
  assert.deepEqual(publicFaqs(importedFaqs(SEEDED)), record, "/apply shows the record until anything changes");
});

test("/apply shows only published questions, in order, and the published text of a question with draft changes", async () => {
  const { store, editor } = editorOver();
  const third = record[2];
  const drafted = await editor.save(3, "save-draft", { question: "Edited?", answer: ["New answer."] });
  assert.ok(drafted.ok);
  assert.equal(drafted.value.version.state === "published" && drafted.value.version.draft?.updatedAt, NOW.toISOString(), "the draft is dated now");
  assert.ok((await editor.save(null, "save-draft", { question: "Never published?", answer: ["No."] })).ok);

  const shown = publicFaqs(await store.list());
  assert.deepEqual(shown[2], third);
  assert.ok(!questions(shown).includes("Never published?"));

  assert.ok((await editor.save(3, "publish", { question: "Edited?", answer: ["New answer."] })).ok);
  assert.deepEqual(publicFaqs(await store.list())[2], { question: "Edited?", answer: ["New answer."] });
});

test("the server refuses a question over 120 characters and an answer with no paragraph, and keeps blank boxes out", async () => {
  const { editor } = editorOver();
  const long = await editor.save(1, "publish", { question: "a".repeat(FAQ_QUESTION_MAX + 1), answer: ["Fine."] });
  assert.equal(long.ok, false);
  const atLimit = await editor.save(1, "publish", { question: "ò".repeat(FAQ_QUESTION_MAX), answer: ["Fine."] });
  assert.ok(atLimit.ok, "the limit counts characters, so ò is one");

  for (const answer of [[], [""], ["  ", "\n"]]) {
    const empty = await editor.save(2, "publish", { question: "Fine?", answer });
    assert.equal(empty.ok, false, JSON.stringify(answer));
  }
  const blanks = await editor.save(null, "publish", { question: " Spaced? ", answer: ["", " One. ", "  ", "Two."] });
  assert.ok(blanks.ok);
  assert.deepEqual(blanks.value.version.state === "published" && blanks.value.version.published.answer, ["One.", "Two."]);
});

test("reordering saves the new order, and /apply shows it, a question published later included", async () => {
  const { store, editor } = editorOver();
  const created = await editor.save(null, "save-draft", { question: "Last?", answer: ["Yes."] });
  assert.ok(created.ok);
  const ids = (await store.list()).map((item) => item.id);
  const order = [created.value.id, ...ids.filter((id) => id !== created.value.id).reverse()];
  assert.ok((await editor.reorder(order)).ok);
  assert.deepEqual(questions(publicFaqs(await store.list())), questions([...record].reverse()));

  assert.ok((await editor.save(created.value.id, "publish", { question: "Last?", answer: ["Yes."] })).ok);
  assert.equal(publicFaqs(await store.list())[0].question, "Last?");
  assert.equal((await editor.reorder(ids.slice(1))).ok, false, "a list missing a question is stale");
});

test("the FAQ page reaches full access and site-content access only, and the server refuses everyone else", async () => {
  const reaches: readonly [ViewerStanding, boolean][] = [
    [admin, true],
    [{ kind: "operations-lead", seat: "it-lead", siteContent: false }, true],
    [{ kind: "member", siteContent: true }, true],
    [{ kind: "division-lead", siteContent: false }, false],
    [{ kind: "department-head", siteContent: false }, false],
    [{ kind: "member", siteContent: false }, false],
    [{ kind: "non-member", siteContent: false }, false],
  ];
  for (const [viewer, allowed] of reaches) {
    const { store, editor } = editorOver(viewer);
    const label = JSON.stringify(viewer);
    assert.equal(canReach(viewer, "faq"), allowed, label);
    assert.equal((await editor.list()) !== null, allowed, label);
    assert.equal((await editor.save(1, "publish", { question: "Changed?", answer: ["Yes."] })).ok, allowed, label);
    assert.equal((await editor.remove(2)).ok, allowed, label);
    if (!allowed) assert.deepEqual(publicFaqs(await store.list()), record, label);
  }
});

test("Updated reads Today for a version written on the day it is seen, in Turin, else the day", () => {
  assert.equal(updatedLabel("2026-10-16T05:00:00.000Z", "2026-10-16T21:30:00.000Z"), "Today");
  // 23:30 in Turin on the 15th, seen at 00:30 on the 16th.
  assert.equal(updatedLabel("2026-10-15T21:30:00.000Z", "2026-10-15T22:30:00.000Z"), "15 Oct");
  assert.equal(updatedLabel(SEEDED, NOW.toISOString()), "12 Sep");
});
