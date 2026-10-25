import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cardLookFrom,
  checksAfterEdit,
  confirmPage,
  holdsPublish,
  markedTargets,
  pageToCheck,
  publishHoldOf,
  uncheckedFor,
  type CardLook,
  type PageChecks,
} from "./publish-hold";

// The shared Publish hold (board 93e, issues #530 and #581): every editor with
// a page switch holds Publish until each page that shows its card is ticked,
// whenever the card's look differs from the live one or there is no live one.

type Page = "own" | "a" | "b";
const PAGES: readonly ("a" | "b")[] = ["a", "b"];
const live = cardLookFrom(["live"]);
const changed = cardLookFrom(["changed"]);
const other = cardLookFrom(["other"]);

/** The hold after these steps, from checks opened on `opened`. */
function holdAfter(opened: CardLook, liveLook: CardLook | null, steps: readonly ((c: PageChecks<Page>) => PageChecks<Page>)[], pages = PAGES) {
  const checks = steps.reduce((c, step) => step(c), uncheckedFor<Page>(opened));
  return publishHoldOf(checks, liveLook, pages);
}
const edit = (look: CardLook) => (c: PageChecks<Page>) => checksAfterEdit(c, look);
const tick = (page: Page) => (c: PageChecks<Page>) => confirmPage(c, page);

test("a look equal to the live one publishes freely", () => {
  const hold = holdAfter(live, live, []);
  assert.deepEqual(hold, { kind: "free" });
  assert.equal(holdsPublish(hold), false);
});

test("a changed look holds Publish until every page to check is ticked", () => {
  assert.equal(holdsPublish(holdAfter(live, live, [edit(changed)])), true);
  assert.equal(holdsPublish(holdAfter(live, live, [edit(changed), tick("a")])), true);
  const both = holdAfter(live, live, [edit(changed), tick("a"), tick("b")]);
  assert.equal(both.kind, "checking");
  assert.equal(holdsPublish(both), false);
});

test("an item with no live version is held from the start, with no change at all", () => {
  assert.deepEqual(holdAfter(live, null, []), {
    kind: "checking",
    pages: [
      { page: "a", check: "unchecked" },
      { page: "b", check: "unchecked" },
    ],
  });
  assert.equal(holdsPublish(holdAfter(live, null, [tick("b"), tick("a")])), false);
});

test("only the pages named are checked: one page to check lifts on one tick", () => {
  assert.equal(holdsPublish(holdAfter(live, null, [tick("a")], ["a"])), false);
});

test("a further change resets the ticks, even back to a look once ticked", () => {
  const ticked = [edit(changed), tick("a"), tick("b")];
  assert.equal(holdsPublish(holdAfter(live, live, [...ticked, edit(other)])), true);
  assert.equal(holdsPublish(holdAfter(live, live, [...ticked, edit(other), edit(changed)])), true);
});

test("an edit that keeps the look keeps the ticks, and putting the live look back lifts the hold", () => {
  assert.equal(holdsPublish(holdAfter(live, live, [edit(changed), tick("a"), tick("b"), edit(changed)])), false);
  assert.deepEqual(holdAfter(live, live, [edit(changed), edit(live)]), { kind: "free" });
});

test("the switch marks the pages to check, and the page in view asks while it has its cross", () => {
  const targets = [
    { id: "own" as const, label: "Own" },
    { id: "a" as const, label: "A" },
    { id: "b" as const, label: "B" },
  ];
  const hold = holdAfter(live, null, [tick("a")]);
  assert.deepEqual(
    markedTargets(targets, hold).map((t) => t.check),
    [undefined, "checked", "unchecked"],
  );
  assert.equal(pageToCheck(hold, "own"), null);
  assert.equal(pageToCheck(hold, "a"), null);
  assert.equal(pageToCheck(hold, "b"), "b");
  assert.deepEqual(markedTargets(targets, holdAfter(live, live, [])), targets);
});
