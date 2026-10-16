import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import type { ContentItem } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { written } from "@/lib/dashboard/write";
import {
  ADVISORS_CHANGED,
  advisorEditor,
  advisorRowsOf,
  publicAdvisors,
  teamPageStatus,
  type AdvisorRow,
  type AdvisorStore,
  type AdvisorVersion,
  type AlumniAdvisor,
} from "./advisors";
import { advisorImportSql, importedAdvisors } from "./advisors-import";
import { team } from "./team";

// The Team page's advisors (issue #286): seeded with today's advisors as
// published, every change the panel makes a draft until Publish, and End
// advising the one change made at once, into the Alumni page's Advisors
// group. Every write passes the site-content gate.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const lead: ViewerStanding = { kind: "member", siteContent: false, approveOrders: false };
const THIS_YEAR = 2026;

/** An advisor store in memory, and the Alumni entries End advising added. */
function storeOver(seed: readonly ContentItem<AdvisorVersion>[] = importedAdvisors()) {
  const content = memoryContentStore(seed);
  const alumni: AlumniAdvisor[] = [];
  const store: AdvisorStore = {
    ...content,
    async endAdvising(id, entry) {
      const removed = await content.remove(id);
      if (!removed.ok) return removed;
      alumni.push(entry);
      return written(null);
    },
  };
  return { store, alumni, editor: advisorEditor(admin, store, async () => THIS_YEAR) };
}

const today = team.advisors.people;
const rowsOf = async (store: AdvisorStore) => advisorRowsOf(await store.list());
const shown = async (store: AdvisorStore) => publicAdvisors(await store.list());

test("the store starts with today's advisors, published, in today's order and standing, and the public section shows exactly them", async () => {
  const items = importedAdvisors();
  assert.equal(items.length, today.length);
  for (const item of items) assert.equal(item.version.state === "published" && item.version.draft, null);
  const { store } = storeOver();
  assert.deepEqual(await shown(store), today);
  assert.deepEqual(
    (await shown(store)).map((a) => a.standing),
    today.map((a) => a.standing),
  );
});

test("migration 0035 imports exactly the seed and is numbered after the trunk's latest, 0033, and the epic's 0034", () => {
  const migration = readFileSync(new URL("../../drizzle/0035_team_page_advisors.sql", import.meta.url), "utf8");
  assert.ok(migration.trimEnd().endsWith(advisorImportSql()), "regenerate the migration's import from advisorImportSql()");
  const journal = JSON.parse(readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8")) as { entries: { idx: number; tag: string }[] };
  const last = journal.entries.at(-1)!;
  assert.deepEqual(last, { ...last, idx: 35, tag: "0035_team_page_advisors" });
});

test("add, edit, reorder and Principal / Specialist changes are drafts: the public page changes only on Publish", async () => {
  const { store, editor } = storeOver();
  const rows = await rowsOf(store);
  const [pagani, zappino, meloni, ...specialists] = rows;
  const edited: AdvisorRow[] = [
    // Reordered: Meloni first among the principals.
    meloni,
    pagani,
    // Edited: a new role.
    { ...zappino, fields: { ...zappino.fields, role: "Faculty Advisor, Structures" } },
    // Principal to Specialist.
    { ...specialists[0], fields: { ...specialists[0].fields, standing: "principal" } },
    ...specialists.slice(1),
    // Added.
    { id: null, fields: { name: "Prof. Ada Rossi", role: "Propulsion", standing: "specialist", photo: null, linkedin: "", email: "" } },
  ];

  const draft = await editor.save("save-draft", edited);
  assert.ok(draft.ok);
  assert.deepEqual(await shown(store), today, "nothing reaches the public page on Save draft");
  assert.equal(teamPageStatus("published", draft.value), "draft-changes");
  // The editor reads the draft back in its order.
  const reopened = await rowsOf(store);
  assert.deepEqual(
    reopened.map((r) => r.fields.name),
    ["Fabio Meloni", "Prof. Alfonso Pagani", "Prof. Enrico Zappino", "Salvatore Lagrasta", ...specialists.slice(1).map((r) => r.fields.name), "Prof. Ada Rossi"],
  );

  const published = await editor.save("publish", reopened);
  assert.ok(published.ok);
  assert.equal(teamPageStatus("published", published.value), "published");
  const live = await shown(store);
  assert.deepEqual(
    live.map((a) => a.name),
    reopened.map((r) => r.fields.name),
  );
  assert.equal(live[2].role, "Faculty Advisor, Structures");
  assert.equal(live[3].standing, "principal");
  assert.deepEqual(live.at(-1), { name: "Prof. Ada Rossi", role: "Propulsion", standing: "specialist" });
});

test("Save draft with nothing changed writes nothing, and a list that misses or invents an advisor is refused", async () => {
  const { store, editor } = storeOver();
  const before = await store.list();
  const rows = await rowsOf(store);
  assert.ok((await editor.save("save-draft", rows)).ok);
  assert.deepEqual(await store.list(), before);

  assert.deepEqual(await editor.save("save-draft", rows.slice(1)), { ok: false, error: ADVISORS_CHANGED });
  assert.deepEqual(await editor.save("save-draft", [...rows, { ...rows[0], id: 999 }]), { ok: false, error: ADVISORS_CHANGED });
  const unnamed = await editor.save("publish", [{ ...rows[0], fields: { ...rows[0].fields, name: " " } }, ...rows.slice(1)]);
  assert.equal(unnamed.ok, false);
  assert.deepEqual(await store.list(), before);
});

test("End advising takes the advisor off the Team page at once and adds their Alumni entry with role, years and photo", async () => {
  const { store, editor, alumni } = storeOver();
  const flora = (await rowsOf(store)).find((r) => r.fields.name === "Flora Punzi")!;
  assert.ok((await editor.end(flora.id!, { from: 2023, to: 2026 })).ok);
  assert.ok(!(await shown(store)).some((a) => a.name === "Flora Punzi"));
  assert.equal((await store.list()).length, today.length - 1);
  assert.deepEqual(alumni, [{ name: "Flora Punzi", role: "Senior FEA Analyst & Counselor", from: 2023, to: 2026, photo: "/team/flora-punzi.jpg" }]);

  // Years outside the team's or the wrong way round are refused, and nothing changes.
  const pagani = (await rowsOf(store))[0];
  assert.equal((await editor.end(pagani.id!, { from: 2026, to: 2023 })).ok, false);
  assert.equal((await editor.end(pagani.id!, { from: 2019, to: 2020 })).ok, false);
  assert.equal(alumni.length, 1);
});

test("a viewer without site-content access reads nothing and writes nothing", async () => {
  const { store } = storeOver();
  const editor = advisorEditor(lead, store, async () => THIS_YEAR);
  const before = await store.list();
  assert.equal(await editor.list(), null);
  assert.equal((await editor.save("publish", await rowsOf(store))).ok, false);
  assert.equal((await editor.end(1, { from: 2024, to: 2026 })).ok, false);
  assert.deepEqual(await store.list(), before);
});

test("the database side writes the advisor tables, and End advising one Alumni entry: never roles, divisions, departments, scopes or members", () => {
  const source = readFileSync(new URL("../dashboard/database-team-advisors.ts", import.meta.url), "utf8");
  const schemaImports = [...source.matchAll(/import \{([^}]*)\} from "@\/db\/schema[^"]*";/g)].flatMap((m) => m[1].split(",").map((name) => name.trim()));
  assert.deepEqual(schemaImports, ["alumniEntries", "teamPageAdvisors", "teamPageAdvisorVersions"]);
  // Its one raw statement names its tables through the schema it imports.
  for (const raw of source.matchAll(/sql`([^`]*)`/g)) assert.doesNotMatch(raw[1], /\b(INSERT INTO|UPDATE|DELETE FROM) "/);
  for (const table of ["roles", "divisions", "departments", "scopes", "members"]) {
    assert.doesNotMatch(source, new RegExp(`\\.(insert|update|delete)\\(${table}\\b`), table);
  }
});
