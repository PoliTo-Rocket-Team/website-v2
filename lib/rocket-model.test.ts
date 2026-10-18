import assert from "node:assert/strict";
import { test } from "node:test";
import { CAVOUR_CARD_POSTER, CAVOUR_STAGE_POSTER } from "@/components/landing/cavour-assets";
import { PLACEHOLDER_CARD_POSTER, PLACEHOLDER_STAGE_POSTER } from "@/components/landing/placeholder-assets";
import { VES_CARD_POSTER, VES_STAGE_POSTER } from "@/components/landing/ves-assets";
import { importedRecords } from "@/lib/project-content/import";
import { homeCardOf, pageRecordOf } from "@/lib/project-content/record";
import { cardPosterOf, rocketModelOf, stageStillOf } from "./rocket-model";

// Which rocket a card stage and a page's rocket slot draw (issue #296).

test("a project with a model of its own draws it; one with none draws the placeholder", () => {
  assert.equal(rocketModelOf("cavour"), "cavour");
  assert.equal(rocketModelOf(undefined), "placeholder");
});

test("each model's card poster is its own still", () => {
  assert.equal(cardPosterOf("cavour"), CAVOUR_CARD_POSTER);
  assert.equal(cardPosterOf("placeholder"), PLACEHOLDER_CARD_POSTER);
});

test("a page slot with no model of its own draws the placeholder's still, with no alt text", () => {
  assert.deepEqual(stageStillOf(undefined), { src: PLACEHOLDER_STAGE_POSTER, alt: "" });
  assert.deepEqual(stageStillOf({ model: "cavour", alt: "Cavour" }), { src: CAVOUR_STAGE_POSTER, alt: "Cavour" });
});

test("Cavour and VES draw their own rockets on their cards and pages; Efesto keeps no panel", () => {
  // The pages read the stored records (issue #295); these are the imported ones.
  const record = (slug: string) => importedRecords.find((r) => r.slug === slug)!;
  const pageRecord = (slug: string) => pageRecordOf(record(slug));
  assert.deepEqual(pageRecord("cavour").hero.visual?.rocket?.own?.model, "cavour");
  assert.equal(pageRecord("efesto").hero.visual, undefined);

  // VES Mark I (issue #361): its home card and its page slot draw the VES model and its stills.
  const card = rocketModelOf(homeCardOf(record("ves"), 1).rocket);
  assert.equal(card, "ves");
  assert.equal(cardPosterOf(card), VES_CARD_POSTER);
  const still = stageStillOf(pageRecord("ves").hero.visual?.rocket?.own);
  assert.equal(still.src, VES_STAGE_POSTER);
  assert.notEqual(still.alt, "");
});
