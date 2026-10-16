import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { projectEditor } from "./editor";
import { fieldsOf, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import { homeCardOf, lineupWith, listingOf, placeOf } from "./record";

// The Card section and the page switch (board 75d, issue #300): the card's
// copy edited in the panel reaches Home and the Projects list once published,
// and the switch draws the project in its place among the published ones.

const [cavour, ves, efesto] = importedRecords;
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** VES's card with every part of its copy changed. */
function editedCard(): ProjectFields {
  const fields = fieldsOf(ves);
  return {
    ...fields,
    card: {
      ...fields.card,
      name: "VES Mark III",
      year: { text: "2024–26", phone: "" },
      status: "IN BUILD",
      statusTone: "light",
      desc: { text: "A new line for the card.", phone: "Shorter." },
      specs: [
        { label: { text: "APOGEE", phone: "" }, value: { text: "9 000 m", phone: "" } },
        fields.card.specs[1],
        { label: { text: "MARKS", phone: "" }, value: { text: "Mk I · III", phone: "" } },
      ],
    },
  };
}

test("a card change saved as a draft leaves Home and /projects; published, it reaches both", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const fields = editedCard();

  assert.ok((await editor.saveFields(2, "save-draft", fields)).ok);
  let shown = publicItems((await editor.list())!);
  assert.deepEqual(homeCardOf(shown[1], 1), homeCardOf(ves, 1), "a draft never reaches Home");
  assert.equal(listingOf(shown[1], 1).name, "VES");

  assert.ok((await editor.saveFields(2, "publish", fields)).ok);
  shown = publicItems((await editor.list())!);
  const card = homeCardOf(shown[1], 1);
  assert.equal(card.name, "VES Mark III");
  assert.deepEqual(card.year, { text: "2024–26" });
  assert.equal(card.status, "IN BUILD");
  assert.equal(card.statusTone, "light");
  assert.deepEqual(card.desc, { text: "A new line for the card.", phone: "Shorter." });
  assert.deepEqual(card.specs[0], { label: { text: "APOGEE" }, value: { text: "9 000 m" } });
  assert.deepEqual(card.specs[2], { label: { text: "MARKS" }, value: { text: "Mk I · III" } });
  assert.equal(card.num, "02", "the number stays the card's place");
  assert.equal(listingOf(shown[1], 1).name, "VES Mark III", "the Projects list shows the new name");
});

test("a rocket's pill counts its flights or reads its own text; an engine's is always its text", async () => {
  const fields = fieldsOf(cavour);
  assert.equal(fields.card.countsFlights, true);
  assert.equal(homeCardOf(projectViewOf(fields, cavour), 0).status, "FLOWN ×3");
  const text = { ...fields, card: { ...fields.card, countsFlights: false, status: "RETIRED" } };
  assert.equal(homeCardOf(projectViewOf(text, cavour), 0).status, "RETIRED");

  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const counting = fieldsOf(efesto);
  const refused = await editor.saveFields(3, "save-draft", { ...counting, card: { ...counting.card, countsFlights: true } });
  assert.equal(refused.ok, false, "an engine has no flights to count");
  const blank = await editor.saveFields(1, "save-draft", { ...text, card: { ...text.card, status: " " } });
  assert.deepEqual(blank, { ok: false, error: "Fill in the card's status." });
});

test("the page switch draws the project in its place among the published ones", () => {
  const items = importedProjects();
  const place = placeOf(items, 2)!;
  const view = projectViewOf(editedCard(), ves);
  assert.deepEqual(
    lineupWith(place, view).map((r) => r.name),
    ["Cavour", "VES Mark III", "Efesto"],
  );
});

test("a request carries the card's fields in their shape only", () => {
  const fields = editedCard();
  assert.deepEqual(readProjectFields(JSON.parse(JSON.stringify(fields))), fields);
  for (const card of [null, { ...fields.card, specs: fields.card.specs.slice(0, 2) }, { ...fields.card, statusTone: "grey" }, { ...fields.card, countsFlights: "no" }]) {
    assert.equal(readProjectFields({ ...fields, card }), null);
  }
});
