import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContentItem } from "@/lib/content/versioned";
import { projectRows } from "./dashboard-list";
import { importedProjects, importedRecords } from "./import";
import type { ProjectRecord, VehicleRecord } from "./record";

// The dashboard Projects list (board 91, issue #506): newest first by the
// rule the public Projects row uses, drafts included.

const [cavour, ves, efesto] = importedProjects();
const rocket = importedRecords.find((record): record is VehicleRecord => record.kind === "vehicle")!;

/** A draft-only project named `name`, its card starting at `year`. */
function draft(id: number, siteOrder: number, name: string, year: string): ContentItem<ProjectRecord> {
  const record: ProjectRecord = { ...rocket, slug: name.toLowerCase(), name, card: { ...rocket.card, year: { text: year } } };
  return { id, siteOrder, version: { state: "draft", draft: record } };
}

const names = (items: readonly ContentItem<ProjectRecord>[]) => projectRows(items).map((row) => row.name);

test("the dashboard Projects list puts the newest start year first, drafts included", () => {
  // Cavour "2023", VES "2024–25", Efesto "2023–", Galileo "2026–".
  assert.deepEqual(names([cavour, ves, efesto, draft(4, 4, "Galileo", "2026–")]), ["Galileo", "VES", "Efesto", "Cavour"]);
});

test("a tie in start year goes to the higher site-order number", () => {
  // Cavour and Efesto both start in 2023: whichever sits later in the site order comes first.
  assert.deepEqual(names([{ ...cavour, siteOrder: 5 }, ves, efesto]), ["VES", "Cavour", "Efesto"]);
});

test("a project naming no year goes last", () => {
  assert.equal(names([draft(9, 0, "No year", ""), cavour, ves, efesto]).at(-1), "No year");
});

test("only a project with a published version links to its page on the site", () => {
  const rows = projectRows([ves, draft(4, 4, "Galileo", "2026–")]);
  assert.deepEqual(
    rows.map((row) => [row.name, row.onSite, row.content]),
    [
      ["Galileo", null, "draft"],
      ["VES", "/projects/ves", "published"],
    ],
  );
});
