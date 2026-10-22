import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ApplyPosition } from "@/db/types";
import { applyListing, isPublic, positionIdFromSlug, positionSlug } from "./positions";
import { placeholderRoles } from "./placeholder-roles";

describe("isPublic", () => {
  const cases = [
    { status: true, is_deleted: false, isOpen: true, expected: true },
    { status: false, is_deleted: false, isOpen: true, expected: false },
    { status: true, is_deleted: true, isOpen: true, expected: false },
    { status: true, is_deleted: false, isOpen: false, expected: false },
    { status: false, is_deleted: true, isOpen: true, expected: false },
    { status: false, is_deleted: false, isOpen: false, expected: false },
    { status: true, is_deleted: true, isOpen: false, expected: false },
    { status: false, is_deleted: true, isOpen: false, expected: false },
  ];
  for (const { status, is_deleted, isOpen, expected } of cases) {
    test(`open=${status} deleted=${is_deleted} recruitment=${isOpen} -> ${expected}`, () => {
      assert.equal(isPublic({ status, is_deleted }, { isOpen }), expected);
    });
  }
});

describe("position slug", () => {
  test("resolves to the id, and still does after the title changes", () => {
    const slug = positionSlug({ id: 12, title: "Design & Manufacturing Engineer" });
    assert.equal(slug, "12-design-and-manufacturing-engineer");
    assert.equal(positionIdFromSlug(slug), 12);
    assert.equal(positionIdFromSlug("12-an-older-title"), 12);
    assert.equal(positionIdFromSlug("12"), 12);
  });

  test("names no position when it does not start with an id", () => {
    for (const slug of ["", "mission-analyst", "0-x", "-12", "12x", "1.5", "12-Mission"]) {
      assert.equal(positionIdFromSlug(slug), null, slug);
    }
  });
});

describe("applyListing", () => {
  let nextId = 1;
  const position = (dept_name: string): ApplyPosition => {
    const id = nextId++;
    return {
      id,
      status: true,
      division_id: 1,
      title: `Role ${id}`,
      description: null,
      required_skills: null,
      desirable_skills: null,
      custom_questions: null,
      created_at: "2026-10-01T00:00:00Z",
      requires_motivation_letter: false,
      is_deleted: false,
      div_name: "Some",
      div_code: "SOM",
      dept_id: 1,
      dept_name,
      dept_code: "DEP",
    };
  };
  test("none open shows every placeholder role, each closed", () => {
    const listing = applyListing([]);
    assert.equal(listing.kind, "closed");
    const roles = listing.kind === "closed" ? listing.placeholders.flatMap((g) => g.roles) : [];
    assert.deepEqual(
      roles.map((r) => [r.code, r.status]),
      placeholderRoles.map((p) => [p.code, "closed"]),
    );
  });

  for (const count of [1, 4, 5]) {
    test(`${count} open show only the open positions`, () => {
      const departments = ["Aerodynamics", "Structures", "Recovery", "Electronics", "Operations"];
      const listing = applyListing(Array.from({ length: count }, (_, i) => position(departments[i])));
      assert.equal(listing.kind, "open");
      const roles = listing.kind === "open" ? listing.open.flatMap((g) => g.roles) : [];
      assert.equal(roles.length, count);
      assert.ok(roles.every((r) => r.status === "open"));
      const placeholderCodes = new Set<string>(placeholderRoles.map((p) => p.code));
      assert.ok(roles.every((r) => !placeholderCodes.has(r.code)));
    });
  }
});
