import assert from "node:assert/strict";
import { test } from "node:test";
import { importedRecords } from "@/lib/project-content/import";
import { listingOf } from "@/lib/project-content/record";
import { flightsOf, panelRocketOf, statusOf, type Project } from "./projects";

// Which rocket a /projects panel draws (issue #381).

const listing = (slug: string): Project => {
  const position = importedRecords.findIndex((r) => r.slug === slug);
  return listingOf(importedRecords[position], position);
};

test("an engine's /projects panel draws its own engine (issue #382), and with none no stage at all", () => {
  const efesto = listing("efesto");
  assert.ok(efesto.kind === "engine");
  assert.equal(panelRocketOf(efesto), "efesto");
  assert.equal(panelRocketOf({ ...efesto, engine: undefined }), null);
});

test("a rocket's /projects panel draws its own model, or the placeholder when it has none", () => {
  assert.equal(panelRocketOf(listing("cavour")), "cavour");
  assert.equal(panelRocketOf(listing("ves")), "ves");
  const cavour = listing("cavour");
  assert.ok(cavour.kind === "vehicle");
  assert.equal(panelRocketOf({ ...cavour, rocket: undefined }), "placeholder");
});

test("a rocket with no flight reads IN DESIGN on /projects, as its Home card does; one that flew counts its flights", () => {
  const cavour = listing("cavour");
  assert.ok(cavour.kind === "vehicle");
  assert.ok(flightsOf(cavour).length > 0);
  assert.deepEqual(statusOf(cavour), { kind: "flown", flights: flightsOf(cavour).length });
  assert.deepEqual(statusOf({ ...cavour, launches: [] }), { kind: "in-design" });
  const grounded = cavour.launches.map((launch) => ({ ...launch, flight: null }));
  assert.deepEqual(statusOf({ ...cavour, launches: grounded }), { kind: "in-design" }, "a campaign that never left the pad is no flight");
  assert.deepEqual(statusOf(listing("efesto")), { kind: "in-development" });
});
