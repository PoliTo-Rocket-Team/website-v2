import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { robotsTxt, rootRobots, siteIndexable } from "./site-indexing";

describe("siteIndexable", () => {
  test("unset keeps the site out of search engines", () => {
    assert.equal(siteIndexable({}), false);
  });

  test("exactly \"true\" turns indexing on", () => {
    assert.equal(siteIndexable({ SITE_INDEXABLE: "true" }), true);
  });

  for (const value of ["false", "TRUE", "1", "yes", " true", ""]) {
    test(`${JSON.stringify(value)} keeps the site out of search engines`, () => {
      assert.equal(siteIndexable({ SITE_INDEXABLE: value }), false);
    });
  }
});

describe("what pages and robots.txt say", () => {
  test("not indexable: pages say noindex, nofollow and robots.txt disallows every path", () => {
    assert.deepEqual(rootRobots(false), { index: false, follow: false });
    assert.deepEqual(robotsTxt(false), { rules: { userAgent: "*", disallow: "/" } });
  });

  test("indexable: pages may be indexed and robots.txt allows every path", () => {
    assert.deepEqual(rootRobots(true), { index: true, follow: true });
    assert.deepEqual(robotsTxt(true), { rules: { userAgent: "*", allow: "/" } });
  });
});
