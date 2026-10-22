import assert from "node:assert/strict";
import { test } from "node:test";
import { samplePagesOn } from "./sample-pages";

test("sample pages show on every preview and under next dev, never in production", () => {
  assert.equal(samplePagesOn({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
  assert.equal(samplePagesOn({ NODE_ENV: "development" }), true);
  assert.equal(samplePagesOn({ NODE_ENV: "production", VERCEL_ENV: "production" }), false);
  assert.equal(samplePagesOn({ NODE_ENV: "production" }), false, "local production build");
});
