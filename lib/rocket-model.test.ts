import assert from "node:assert/strict";
import { test } from "node:test";
import { CAVOUR_CARD_POSTER, CAVOUR_STAGE_POSTER } from "@/components/landing/cavour-assets";
import { EFESTO_CARD_POSTER, EFESTO_STAGE_POSTER } from "@/components/landing/efesto-assets";
import { PLACEHOLDER_CARD_POSTER, PLACEHOLDER_STAGE_POSTER } from "@/components/landing/placeholder-assets";
import { VES_CARD_POSTER, VES_STAGE_POSTER } from "@/components/landing/ves-assets";
import { importedRecords } from "@/lib/project-content/import";
import { homeCardOf, pageRecordOf } from "@/lib/project-content/record";
import { cardPosterOf, ENGINE_STAGE_TEXTURE, rocketModelOf, stageStillOf, stageTextureOf } from "./rocket-model";

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

test("Cavour and VES draw their own rockets on their cards and pages; Efesto draws its engine", () => {
  // The pages read the stored records (issue #295); these are the imported ones.
  const record = (slug: string) => importedRecords.find((r) => r.slug === slug)!;
  /** The model the page's top visual names, with its alt text. */
  const own = (slug: string) => {
    const { visual } = pageRecordOf(record(slug)).hero;
    return visual.kind === "model" ? visual.own : undefined;
  };
  assert.deepEqual(own("cavour")?.model, "cavour");

  // Efesto (issue #382): its home card and its page slot draw the engine and its stills.
  const engine = rocketModelOf(homeCardOf(record("efesto"), 2).rocket);
  assert.equal(engine, "efesto");
  assert.equal(cardPosterOf(engine), EFESTO_CARD_POSTER);
  const engineStill = stageStillOf(own("efesto"));
  assert.equal(engineStill.src, EFESTO_STAGE_POSTER);
  assert.notEqual(engineStill.alt, "");
  // Its page panel lays the engine on the orange streak in place of the brand texture it kept;
  // the rockets keep their own texture, and an engine whose editor picked a preset lies on it (epic #522).
  const kept = "/textures/project-efesto.webp";
  assert.equal(stageTextureOf(own("efesto"), kept), ENGINE_STAGE_TEXTURE);
  assert.equal(stageTextureOf(own("efesto"), "/backgrounds/ember-wide.webp"), "/backgrounds/ember-wide.webp");
  assert.equal(stageTextureOf(own("cavour"), kept), kept);
  assert.equal(stageTextureOf(own("ves"), kept), kept);
  assert.equal(stageTextureOf(undefined, kept), kept);

  // VES Mark I (issue #361): its home card and its page slot draw the VES model and its stills.
  const card = rocketModelOf(homeCardOf(record("ves"), 1).rocket);
  assert.equal(card, "ves");
  assert.equal(cardPosterOf(card), VES_CARD_POSTER);
  const still = stageStillOf(own("ves"));
  assert.equal(still.src, VES_STAGE_POSTER);
  assert.notEqual(still.alt, "");
});
