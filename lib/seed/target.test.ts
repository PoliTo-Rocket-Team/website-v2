import assert from "node:assert/strict";
import { test } from "node:test";
import { guardSeedTarget, parseTarget, type NeonBranchFacts, type NeonBranchLookup } from "./target";

const PREVIEW_HOST = "ep-cool-darkness-123456.eu-central-1.aws.neon.tech";
const PREVIEW_URL = `postgresql://app:secret@${PREVIEW_HOST}/neondb?sslmode=require`;

function lookupOf(facts: NeonBranchFacts | undefined, seen: string[] = []): NeonBranchLookup {
  return async (endpointId) => {
    seen.push(endpointId);
    return facts;
  };
}

const neverLooked: NeonBranchLookup = async () => {
  throw new Error("a non-Neon target must not reach the Neon lookup");
};

async function refusal(url: string | undefined, lookup: NeonBranchLookup, env = {}) {
  const verdict = await guardSeedTarget(url, lookup, env);
  assert.equal(verdict.ok, false, `expected a refusal for ${url}`);
  return verdict.ok ? undefined : verdict.refusal.reason;
}

test("a local database passes, and the approved target is the exact URL checked", async () => {
  for (const url of [
    "postgres://dev@localhost:5432/prt",
    "postgresql://dev:pw@127.0.0.1/prt",
    "postgres://dev@[::1]:5432/prt",
  ]) {
    const verdict = await guardSeedTarget(url, neverLooked);
    assert.ok(verdict.ok, url);
    assert.equal(verdict.target.kind, "local");
    assert.equal(verdict.target.connectionString, url);
  }
});

test("a Neon preview branch that is not the default branch passes", async () => {
  const seen: string[] = [];
  const verdict = await guardSeedTarget(
    PREVIEW_URL,
    lookupOf({ name: "preview/huey/seed-runner", isDefault: false, isProtected: false }, seen),
  );
  assert.ok(verdict.ok);
  assert.equal(verdict.target.kind, "preview");
  assert.equal(verdict.target.label, "preview/huey/seed-runner");
  assert.deepEqual(seen, ["ep-cool-darkness-123456"]);
});

test("the pooled host names the same endpoint as the direct one", () => {
  const pooled = parseTarget("postgresql://app@ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech/neondb");
  assert.equal(pooled.kind === "neon" && pooled.endpointId, "ep-cool-darkness-123456");
});

test("production is refused: the default branch, a protected branch, or a production build", async () => {
  assert.equal(
    await refusal(PREVIEW_URL, lookupOf({ name: "main", isDefault: true, isProtected: false })),
    "production",
  );
  // The default branch is production even when it is named like a preview.
  assert.equal(
    await refusal(PREVIEW_URL, lookupOf({ name: "preview/main", isDefault: true, isProtected: false })),
    "production",
  );
  assert.equal(
    await refusal(PREVIEW_URL, lookupOf({ name: "preview/x", isDefault: false, isProtected: true })),
    "production",
  );
  assert.equal(await refusal("postgres://dev@localhost/prt", neverLooked, { VERCEL_ENV: "production" }), "production");
});

test("a target the guard cannot classify is refused", async () => {
  for (const url of [
    undefined,
    "",
    "not a url",
    "mysql://root@localhost/prt",
    "postgres://app@db.example.com/prt",
    "postgres://app@10.0.0.5/prt",
    `postgres://app@${PREVIEW_HOST}.evil.example/prt`,
    "postgres://app@aws-0-eu-central-1.pooler.supabase.com/postgres",
  ]) {
    assert.equal(await refusal(url, neverLooked), "unclassifiable", String(url));
  }
});

test("a Neon target is refused unless its branch is read and is a preview branch", async () => {
  assert.equal(await refusal(PREVIEW_URL, lookupOf(undefined)), "unproven-preview");
  const failing: NeonBranchLookup = async () => {
    throw new Error("network down");
  };
  assert.equal(await refusal(PREVIEW_URL, failing), "unproven-preview");
  assert.equal(
    await refusal(PREVIEW_URL, lookupOf({ name: "dev/shared", isDefault: false, isProtected: false })),
    "unproven-preview",
  );
});

test("no environment flag turns a refusal into a pass", async () => {
  for (const VERCEL_ENV of ["preview", "development", ""]) {
    assert.equal(await refusal("postgres://app@db.example.com/prt", neverLooked, { VERCEL_ENV }), "unclassifiable");
    assert.equal(
      await refusal(PREVIEW_URL, lookupOf({ name: "main", isDefault: true, isProtected: false }), { VERCEL_ENV }),
      "production",
    );
  }
});
