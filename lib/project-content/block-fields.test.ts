import assert from "node:assert/strict";
import { test } from "node:test";
import { blankBlock, blockFieldsOf, blockOf, blockProblems, KEY_FACTS_LIMIT, POINTS_LIMIT, readBlockFields, type BlockFields } from "./block-fields";
import { importedRecords } from "./import";

// Each block kind's fields and limits (boards 93b and 93c, epic #522): Key
// facts hold 2 to 6 numbers, Numbered points 3 to 5, a Photo block its one
// photo, and every stored block opens and saves as it was.

const fact = (i: number) => ({ value: `${i}`, label: { text: `FACT ${i}`, phone: "" } });
const point = (i: number) => ({ title: `Point ${i}`, text: "Because." });
const counted = (block: BlockFields) => blockProblems(block).filter((p) => p.field.endsWith(".items")).map((p) => p.error);

test("every stored block opens in the panel and goes back unchanged", () => {
  for (const record of importedRecords) {
    for (const block of record.blocks) assert.deepEqual(blockOf(blockFieldsOf(block)), block, `${record.slug} ${block.id}`);
  }
});

test("a Key facts block holds 2 to 6 numbers", () => {
  const facts = (n: number) => ({ ...blankBlock("facts", "facts-1"), facts: Array.from({ length: n }, (_, i) => fact(i + 1)) });
  for (let n = KEY_FACTS_LIMIT.min; n <= KEY_FACTS_LIMIT.max; n++) {
    assert.deepEqual(counted(facts(n)), [], `${n} numbers`);
    assert.notEqual(blockOf(facts(n)), null);
  }
  for (const n of [KEY_FACTS_LIMIT.min - 1, KEY_FACTS_LIMIT.max + 1]) {
    assert.deepEqual(counted(facts(n)), ["Keep 2 to 6 key facts."], `${n} numbers`);
    assert.equal(blockOf(facts(n)), null, `${n} numbers make no block`);
  }
});

test("a Numbered points block holds 3 to 5 points, hidden or not", () => {
  const points = (n: number, hidden = false) => ({ ...blankBlock("points", "points-1"), hidden, items: Array.from({ length: n }, (_, i) => point(i + 1)) });
  for (let n = POINTS_LIMIT.min; n <= POINTS_LIMIT.max; n++) assert.deepEqual(counted(points(n)), [], `${n} points`);
  for (const n of [POINTS_LIMIT.min - 1, POINTS_LIMIT.max + 1]) {
    assert.deepEqual(counted(points(n)), ["Keep 3 to 5 points."], `${n} points`);
    assert.deepEqual(counted(points(n, true)), ["Keep 3 to 5 points."], `${n} points, hidden`);
    assert.equal(blockOf(points(n)), null);
  }
});

test("a Photo block saves only with its photo; a Text block only with a paragraph while it is on the page", () => {
  const photo = blankBlock("photo", "photo-1");
  assert.deepEqual(blockProblems({ ...photo, hidden: true }), [{ field: "photo.photo", error: "Add the photo." }]);
  const text = blankBlock("text", "text-1");
  assert.equal(text.width, "full", "a new text block takes the full width");
  assert.deepEqual(blockProblems(text), [{ field: "text.paragraphs", error: "Write one paragraph at least." }]);
  assert.deepEqual(blockProblems({ ...text, hidden: true }), []);
  assert.deepEqual(
    blockProblems({ ...text, heading: "A heading", paragraphs: ["One."] }),
    [{ field: "text.label", error: "Fill in the heading's label." }],
    "a heading takes its numbered label",
  );
});

test("a request's block is read only in its kind's shape", () => {
  const text = { ...blankBlock("text", "text-1"), paragraphs: ["One."] };
  assert.deepEqual(readBlockFields(JSON.parse(JSON.stringify({ ...text, facts: [fact(1)] }))), text, "fields of another kind are dropped");
  for (const broken of [
    { ...text, id: "Text 1" },
    { ...text, width: "wide" },
    { ...text, paragraphs: "One." },
    { ...blankBlock("photo", "photo-1"), photo: { src: "javascript:alert(1)", alt: "" } },
    { ...text, kind: "video" },
  ]) {
    assert.equal(readBlockFields(broken), null, JSON.stringify(broken));
  }
});
