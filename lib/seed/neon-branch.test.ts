import assert from "node:assert/strict";
import { test } from "node:test";
import { neonBranchLookup } from "./neon-branch";

function fakeFetch(routes: Record<string, unknown>, calls: string[] = []) {
  return async (url: string, init: { headers: Record<string, string> }) => {
    calls.push(url);
    assert.equal(init.headers.Authorization, "Bearer key");
    const body = routes[url.replace("https://console.neon.tech/api/v2/projects/proj-1", "")];
    return { ok: body !== undefined, json: async () => body };
  };
}

const env = { NEON_API_KEY: "key", NEON_PROJECT_ID: "proj-1" };

test("reads the branch behind an endpoint", async () => {
  const lookup = neonBranchLookup(
    env,
    fakeFetch({
      "/endpoints/ep-a-1": { endpoint: { branch_id: "br-9" } },
      "/branches/br-9": { branch: { name: "preview/x", default: false, protected: false } },
    }),
  );
  assert.deepEqual(await lookup("ep-a-1"), { name: "preview/x", isDefault: false, isProtected: false });
});

test("the older `primary` field marks the default branch too", async () => {
  const lookup = neonBranchLookup(
    env,
    fakeFetch({
      "/endpoints/ep-a-1": { endpoint: { branch_id: "br-1" } },
      "/branches/br-1": { branch: { name: "main", primary: true } },
    }),
  );
  assert.equal((await lookup("ep-a-1"))?.isDefault, true);
});

test("answers undefined with no credentials, an unknown endpoint, or a failed read", async () => {
  const calls: string[] = [];
  assert.equal(await neonBranchLookup({ NEON_API_KEY: "key" }, fakeFetch({}, calls))("ep-a-1"), undefined);
  assert.equal(await neonBranchLookup({ NEON_PROJECT_ID: "proj-1" }, fakeFetch({}, calls))("ep-a-1"), undefined);
  assert.deepEqual(calls, []);
  assert.equal(await neonBranchLookup(env, fakeFetch({}))("ep-a-1"), undefined);
  const noBranch = fakeFetch({ "/endpoints/ep-a-1": { endpoint: { branch_id: "br-1" } } });
  assert.equal(await neonBranchLookup(env, noBranch)("ep-a-1"), undefined);
});
