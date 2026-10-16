import assert from "node:assert/strict";
import { test } from "node:test";
import { CAVOUR_CARD_POSTER, CAVOUR_STAGE_POSTER } from "@/components/landing/cavour-assets";
import { PLACEHOLDER_CARD_POSTER, PLACEHOLDER_STAGE_POSTER } from "@/components/landing/placeholder-assets";
import { pageRecord } from "@/lib/project-pages";
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

test("Cavour's page keeps its own rocket, VES keeps the texture alone and Efesto keeps no panel", () => {
  assert.deepEqual(pageRecord("cavour").hero.visual?.rocket?.own?.model, "cavour");
  assert.equal(pageRecord("ves").hero.visual?.rocket, undefined);
  assert.equal(pageRecord("efesto").hero.visual, undefined);
});
