import assert from "node:assert/strict";
import { test } from "node:test";
import { importedRecords } from "@/lib/project-content/import";
import { listingOf } from "@/lib/project-content/record";
import { panelRocketOf, type Project } from "./projects";

// Which rocket a /projects panel draws (issue #381).

const listing = (slug: string): Project => {
  const position = importedRecords.findIndex((r) => r.slug === slug);
  return listingOf(importedRecords[position], position);
};

test("an engine's /projects panel draws no stage: no rocket and no placeholder", () => {
  const efesto = listing("efesto");
  assert.equal(efesto.kind, "engine");
  assert.equal(panelRocketOf(efesto), null);
});

test("a rocket's /projects panel draws its own model, or the placeholder when it has none", () => {
  assert.equal(panelRocketOf(listing("cavour")), "cavour");
  assert.equal(panelRocketOf(listing("ves")), "ves");
  const cavour = listing("cavour");
  assert.ok(cavour.kind === "vehicle");
  assert.equal(panelRocketOf({ ...cavour, rocket: undefined }), "placeholder");
});
