import assert from "node:assert/strict";
import { test } from "node:test";
import { viewAsBannerLine, viewAsFailureLine } from "./view-as";

// Both banners say how the session's changes show: the acting account's title
// beside the person's full name, as every write records both (boards 96b, 96c).
test("the live and preview banners name both people, as the session's writes record them", () => {
  const banner = { name: "Elif Kaya", role: "Member", actingTitle: "IT lead" };
  assert.equal(viewAsBannerLine({ ...banner, site: "live" }), "Viewing as Elif Kaya · Member · changes show as “IT lead as Elif Kaya”");
  assert.equal(viewAsBannerLine({ ...banner, site: "test" }), "Preview · editing as Elif Kaya · Member · changes show as “IT lead as Elif Kaya”");
});

// A failed Stop names what the server answered (issue #899): its message when
// it sent one, else the status, and says so when no answer came at all.
test("a failed Stop names the server's reason, else its status", () => {
  const reason = "Your own session has ended, so View as cannot return you to it.";
  assert.ok(viewAsFailureLine("stop", { kind: "answered", status: 401, statusText: "Unauthorized", message: reason }).includes(reason));
  const statusOnly = viewAsFailureLine("stop", { kind: "answered", status: 401, statusText: "Unauthorized", message: null });
  assert.ok(statusOnly.includes("401 Unauthorized"), statusOnly);
  assert.ok(viewAsFailureLine("stop", { kind: "answered", status: 500, statusText: "", message: "  " }).includes("500"));
  assert.notEqual(viewAsFailureLine("stop", { kind: "unreached" }), viewAsFailureLine("sign-out", { kind: "unreached" }));
});
