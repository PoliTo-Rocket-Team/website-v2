import assert from "node:assert/strict";
import { test } from "node:test";
import { viewAsBannerLine } from "./view-as";

// Both banners say how the session's changes show: the acting account's title
// beside the person's full name, as every write records both (boards 96b, 96c).
test("the live and preview banners name both people, as the session's writes record them", () => {
  const banner = { name: "Elif Kaya", role: "Member", actingTitle: "IT lead" };
  assert.equal(viewAsBannerLine({ ...banner, site: "live" }), "Viewing as Elif Kaya · Member · changes show as “IT lead as Elif Kaya”");
  assert.equal(viewAsBannerLine({ ...banner, site: "test" }), "Preview · editing as Elif Kaya · Member · changes show as “IT lead as Elif Kaya”");
});
