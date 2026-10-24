import assert from "node:assert/strict";
import { test } from "node:test";
import { config as proxyConfig } from "@/proxy";

// /apply is prerendered (issue #163) and reads the database alone (issue
// #609), so no request to it needs the proxy: no query value or cookie
// changes its list any more.
test("no request to /apply reaches the proxy", () => {
  for (const source of proxyConfig.matcher) {
    assert.ok(!source.startsWith("/apply"), `the proxy matches ${source}`);
  }
});
