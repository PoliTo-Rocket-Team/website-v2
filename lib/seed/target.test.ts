import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { guardSeedTarget, isPreviewDatabase, parseTarget, PREVIEW_ENDPOINT } from "./target";

const DIRECT_HOST = `${PREVIEW_ENDPOINT}.c-2.eu-central-1.aws.neon.tech`;
const POOLED_HOST = `${PREVIEW_ENDPOINT}-pooler.c-2.eu-central-1.aws.neon.tech`;
const DIRECT_URL = `postgresql://app:secret@${DIRECT_HOST}/neondb?sslmode=require`;
const POOLED_URL = `postgresql://app:secret@${POOLED_HOST}/neondb?sslmode=require`;
/** Another Neon endpoint in the same region: production's, or any other branch's. */
const OTHER_URL = "postgresql://app:secret@ep-cool-darkness-123456-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const ON_PREVIEW = { VERCEL_ENV: "preview" };

function refusal(url: string | undefined, env = {}) {
  const verdict = guardSeedTarget(url, env);
  assert.equal(verdict.ok, false, `expected a refusal for ${url}`);
  return verdict.ok ? undefined : verdict.refusal.reason;
}

test("a local database passes, and the approved target is the exact URL checked", () => {
  for (const url of [
    "postgres://dev@localhost:5432/prt",
    "postgresql://dev:pw@127.0.0.1/prt",
    "postgres://dev@[::1]:5432/prt",
  ]) {
    const verdict = guardSeedTarget(url);
    assert.ok(verdict.ok, url);
    assert.equal(verdict.target.kind, "local");
    assert.equal(verdict.target.connectionString, url);
  }
});

test("the preview branch's endpoint passes on a Vercel preview build, by its direct and its pooled host", () => {
  for (const url of [DIRECT_URL, POOLED_URL]) {
    const verdict = guardSeedTarget(url, ON_PREVIEW);
    assert.ok(verdict.ok, url);
    assert.equal(verdict.target.kind, "preview");
    assert.equal(verdict.target.label, "preview");
    assert.equal(verdict.target.connectionString, url);
  }
});

test("the pooled host names the same endpoint as the direct one", () => {
  const direct = parseTarget(DIRECT_URL);
  const pooled = parseTarget(POOLED_URL);
  assert.equal(direct.kind === "neon" && direct.endpointId, PREVIEW_ENDPOINT);
  assert.equal(pooled.kind === "neon" && pooled.endpointId, PREVIEW_ENDPOINT);
});

test("the shared check names the preview branch by its direct and its pooled host, and nothing else (#364)", () => {
  assert.equal(isPreviewDatabase(DIRECT_URL), true);
  assert.equal(isPreviewDatabase(POOLED_URL), true);
  for (const url of [
    OTHER_URL,
    `postgresql://app@${PREVIEW_ENDPOINT}x.c-2.eu-central-1.aws.neon.tech/neondb`,
    "postgres://dev@localhost:5432/prt",
    "https://example.com",
    "not a url",
    "",
    undefined,
  ]) {
    assert.equal(isPreviewDatabase(url), false, String(url));
  }
});

test("the preview branch's endpoint is refused outside a Vercel preview build", () => {
  for (const VERCEL_ENV of [undefined, "", "development"]) {
    assert.equal(refusal(DIRECT_URL, { VERCEL_ENV }), "unproven-preview", String(VERCEL_ENV));
    assert.equal(refusal(POOLED_URL, { VERCEL_ENV }), "unproven-preview", String(VERCEL_ENV));
  }
  assert.equal(refusal(DIRECT_URL, { VERCEL_ENV: "production" }), "production");
});

test("every other Neon endpoint is refused, on every build", () => {
  for (const VERCEL_ENV of [undefined, "", "development", "preview"]) {
    for (const url of [
      OTHER_URL,
      // Only the whole endpoint id matches: a longer or shorter one is another endpoint.
      `postgresql://app@${PREVIEW_ENDPOINT}x.c-2.eu-central-1.aws.neon.tech/neondb`,
      `postgresql://app@${PREVIEW_ENDPOINT.slice(0, -1)}.c-2.eu-central-1.aws.neon.tech/neondb`,
      `postgresql://app@${PREVIEW_ENDPOINT}-other.c-2.eu-central-1.aws.neon.tech/neondb`,
    ]) {
      assert.equal(refusal(url, { VERCEL_ENV }), "unproven-preview", `${url} on ${VERCEL_ENV}`);
    }
  }
});

test("production is refused on a production build, whatever the target", () => {
  for (const url of ["postgres://dev@localhost/prt", DIRECT_URL, POOLED_URL, OTHER_URL]) {
    assert.equal(refusal(url, { VERCEL_ENV: "production" }), "production", url);
  }
});

test("a target the guard cannot classify is refused", () => {
  for (const url of [
    undefined,
    "",
    "not a url",
    "mysql://root@localhost/prt",
    "postgres://app@db.example.com/prt",
    "postgres://app@10.0.0.5/prt",
    `postgres://app@${DIRECT_HOST}.evil.example/prt`,
    "postgres://app@aws-0-eu-central-1.pooler.supabase.com/postgres",
  ]) {
    assert.equal(refusal(url, ON_PREVIEW), "unclassifiable", String(url));
  }
});

// Nothing reads the two Neon API variables the guard used to need (issue #311).

const SOURCE_ROOTS = ["app", "components", "db", "lib", "scripts", "tools"];
const ROOT_FILES = ["next.config.ts", "drizzle.config.ts", "proxy.ts", "package.json", "vercel.json"];
const RETIRED = new RegExp(["NEON", "API", "KEY"].join("_") + "|" + ["NEON", "PROJECT", "ID"].join("_"));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    return /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name) ? [path] : [];
  });
}

test("no source file reads the Neon API key or project id", () => {
  const root = process.cwd();
  const files = [
    ...SOURCE_ROOTS.flatMap((dir) => {
      try {
        return sourceFiles(resolve(root, dir));
      } catch {
        return [];
      }
    }),
    ...ROOT_FILES.map((file) => resolve(root, file)),
  ];
  assert.ok(files.some((file) => file.endsWith(join("lib", "seed", "target.ts"))), "the scan reached the guard");
  const readers = files.filter((file) => {
    try {
      return RETIRED.test(readFileSync(file, "utf8"));
    } catch {
      return false;
    }
  });
  assert.deepEqual(readers.map((file) => relative(root, file)), []);
});
