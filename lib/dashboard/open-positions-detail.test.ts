import assert from "node:assert/strict";
import test from "node:test";
import { openPositionsDetail } from "./open-positions-detail";

const role = (title: string, division: number) => ({ title, division });

test("no open role reads None open", () => {
  assert.equal(openPositionsDetail([]), "None open");
});

test("up to three open roles are named", () => {
  assert.equal(openPositionsDetail([role("Test Engineer", 1)]), "Test Engineer");
  assert.equal(
    openPositionsDetail([role("Test Engineer", 1), role("Mission Analyst", 2), role("RF Specialist", 2)]),
    "Test Engineer, Mission Analyst, RF Specialist",
  );
});

test("more than three open roles are counted by division", () => {
  const four = [role("A", 1), role("B", 2), role("C", 2), role("D", 3)];
  assert.equal(openPositionsDetail(four), "In 3 divisions");
  assert.equal(openPositionsDetail(four.map((r) => ({ ...r, division: 7 }))), "In 1 division");
});
