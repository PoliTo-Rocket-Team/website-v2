import assert from "node:assert/strict";
import { test } from "node:test";
import { alumniOf, type AlumniEntry, type AlumniRecord, type RecordRole } from "@/lib/about/alumni-record";
import type { MyApplications } from "./my-applications";
import { alumniOverview, myAlumniOf, showsMe, withShowsMe } from "./my-alumni";

// Luca: a member of Structures Analysis, then of Mission Analysis, then its
// lead, every role ended in June 2025 (boards 56 and 56b, issue #317).
const ended = (divisionId: number, type: RecordRole["type"], title: string, startedAt: string, leftAt: string): RecordRole => ({
  memberId: 7,
  type,
  title,
  startedAt,
  leftAt,
  departmentId: null,
  divisionId,
});

function record(entry: Partial<AlumniEntry> | null = null): AlumniRecord {
  return {
    units: {
      departments: [
        { id: 1, name: "Aerodynamics" },
        { id: 2, name: "Structures" },
      ],
      divisions: [
        { id: 1, name: "Mission Analysis Division", departmentId: 1 },
        { id: 4, name: "Structures Analysis Division", departmentId: 2 },
      ],
    },
    roles: [
      ended(4, "core", "Member", "2022-10-01", "2023-09-30"),
      ended(1, "core", "Member", "2023-10-01", "2024-09-30"),
      ended(1, "lead", "Division Lead", "2024-10-01", "2025-06-30"),
    ],
    people: [{ memberId: 7, name: "Luca Moretti", email: "luca@example.com" }],
    entries:
      entry === null
        ? []
        : [{ id: 1, who: { kind: "member", memberId: 7, keptName: null }, name: null, founder: null, photo: null, shown: true, removed: false, fixes: [], ...entry }],
    imported: [],
  };
}

const luca = (entry: Partial<AlumniEntry> | null = null) => myAlumniOf(alumniOf(record(entry), 2026)[0]!);
const noApplications: MyApplications = { firstName: "Luca", email: "luca@example.com", active: [], past: [] };

test("the alumni Overview reads Former member, the last unit and the years, from the ended roles (board 56)", () => {
  const overview = alumniOverview("Luca Moretti", luca(), noApplications);
  assert.equal(overview.person.line, "Former member · Mission Analysis Division · 2022 – 2025");
  assert.deepEqual(overview.card, {
    title: "You are on the Alumni page",
    detail: "Shown as Division Lead, Mission Analysis Division · 2022 – 2025",
    link: { label: "Open My alumni", href: "/dashboard/my-alumni" },
  });
  assert.equal(overview.applications, null);
});

test("the card never claims the Alumni page lists someone who asked to be left off, or whom the team hid", () => {
  assert.equal(alumniOverview("Luca Moretti", luca({ removed: true }), noApplications).card.title, "You are not on the Alumni page");
  assert.equal(alumniOverview("Luca Moretti", luca({ shown: false }), noApplications).card.title, "You are not on the Alumni page");
});

test("My alumni lists the roles by academic year, newest first (board 56b)", () => {
  assert.deepEqual(luca().history, [
    { year: "2024 – 25", role: "Division Lead", unit: "Mission Analysis Division" },
    { year: "2023 – 24", role: "Member", unit: "Mission Analysis Division" },
    { year: "2022 – 23", role: "Member", unit: "Structures Analysis Division" },
  ]);
});

test("the switch is the person's own request alone: an editor's Hidden leaves it on, and turning it off asks to be left off", () => {
  assert.equal(showsMe(luca({ shown: false })), true);
  assert.equal(showsMe(luca({ removed: true })), false);
  assert.equal(withShowsMe(luca(), false).askedOff, true);
});
