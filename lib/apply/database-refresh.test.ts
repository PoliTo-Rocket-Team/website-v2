import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyPositions } from "@/db/schema/public";
import { PUBLIC_POSITIONS_CACHE_TAG, refreshAfter, type CacheTag } from "@/lib/cache-tags";
import { DEFAULT_RECRUITMENT, isPublic } from "./positions";

// The database path of /apply (issue #463). The prerendered /apply reads the
// cached public read in app/actions/get-apply-positions.ts, and the position
// writes in lib/dashboard/database-recruitment.ts refresh it. Both files are
// server-only and query a live database, so these tests pin their contract
// from the source text and the schema, with the shared tag mapping
// (lib/cache-tags.ts) run for real.

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
const WRITES = read("../dashboard/database-recruitment.ts");
const PUBLIC_READ = read("../../app/actions/get-apply-positions.ts");

/** The text of one top-level function, from its signature to its closing brace. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} is defined`);
  const end = source.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `${name} ends`);
  return source.slice(start, end);
}

/** Every tag a `cacheTag(…)` call in the public read carries, as written. */
const carriedTags = [...PUBLIC_READ.matchAll(/cacheTag\(([^)]*)\)/g)].map((m) => m[1].trim());

test("the public read and the position page read carry the public positions tag, and nothing else", () => {
  assert.deepEqual(carriedTags, ["PUBLIC_POSITIONS_CACHE_TAG", "PUBLIC_POSITIONS_CACHE_TAG"]);
  assert.match(PUBLIC_READ, /import \{ PUBLIC_POSITIONS_CACHE_TAG \} from "@\/lib\/cache-tags";/);
});

test("a position write refreshes every tag the /apply public read carries", () => {
  const refreshed: CacheTag[] = [];
  refreshAfter("positions", (tag) => refreshed.push(tag));
  assert.ok(refreshed.includes(PUBLIC_POSITIONS_CACHE_TAG));
});

for (const name of ["createPosition", "setPositionOpen", "editPosition", "deletePosition"]) {
  test(`${name} refreshes the public positions after its write`, () => {
    const body = functionBody(WRITES, name);
    const write = body.indexOf("runAuditQuery(");
    const refresh = body.indexOf('refreshAfter("positions", updateTag)');
    assert.notEqual(write, -1, `${name} writes`);
    assert.notEqual(refresh, -1, `${name} refreshes the positions tags`);
    assert.ok(write < refresh, `${name} refreshes after the write, not before`);
  });
}

test("updateTag is Next's, so a dashboard server action expires the tag for the next request", () => {
  assert.match(WRITES, /import \{[^}]*\bupdateTag\b[^}]*\} from "next\/cache";/);
});

test("a newly created open position passes the public read's filter and isPublic with recruitment on", () => {
  // createPosition stores the drawer's open state and a division it may post in; it never sets is_deleted.
  const create = functionBody(WRITES, "createPosition");
  assert.match(create, /status: position\.open,/);
  assert.match(create, /divisionId: division\.id,/);
  assert.doesNotMatch(create, /isDeleted/);
  assert.equal(applyPositions.isDeleted.default, false, "a new row is not deleted");
  assert.equal(applyPositions.isDeleted.notNull, true);

  // The public read keeps every row that is not deleted, in an open division and department; it reads no
  // created_at, id or status bound, so a new row is not dropped for being new.
  const snapshot = functionBody(PUBLIC_READ, "queryPositionSnapshot");
  const clauses = /const whereClauses = \[([\s\S]*?)\];/.exec(snapshot)?.[1];
  assert.ok(clauses, "the filter is one list");
  assert.deepEqual(
    clauses.split(",").map((c) => c.trim()).filter((c) => c !== ""),
    ["eq(applyPositions.isDeleted", "false)", "isNull(divisions.closedAt)", "isNull(departments.closedAt)"],
  );
  assert.match(snapshot, /\.innerJoin\(divisions, eq\(applyPositions\.divisionId, divisions\.id\)\)/);
  assert.match(snapshot, /\.innerJoin\(departments, eq\(divisions\.deptId, departments\.id\)\)/);

  // Then getPublicPositions keeps the rows isPublic passes.
  assert.match(PUBLIC_READ, /\.filter\(\(position\) => isPublic\(position, recruitment\)\)/);
  assert.equal(isPublic({ status: true, is_deleted: false }, DEFAULT_RECRUITMENT), true);
  assert.equal(isPublic({ status: false, is_deleted: false }, DEFAULT_RECRUITMENT), false, "a role left closed is not listed");
});
