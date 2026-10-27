import assert from "node:assert/strict";
import { test } from "node:test";
import { PEOPLE_CSV, QUITTERS_SHEET, yearSheetOf } from "./columns";
import { matchPeople } from "./people";
import type { PhotoFolder } from "./photos";
import { planImport } from "./plan";
import { renderReport } from "./report";
import { NO_DATABASE, type Snapshot } from "./snapshot";
import type { Sources } from "./sources";
import type { Units } from "./units";

// The roster shapes of issue #818, planned over an in-memory fake roster (no
// file, no database): Quitters date cells stored month/day, a people_rows.csv
// first name shorter than the workbook's given names, and one unit spelt
// several ways. Every name here is invented.

type Cells = Readonly<Record<string, string>>;

const blank = (spec: object): Cells => Object.fromEntries(Object.keys(spec).map((k) => [k, ""]));

/** A fake source set: year sheets by academic year (rows from 2), Quitters rows (from 2) and people_rows.csv rows (from line 2). */
function sourcesOf(parts: { readonly years?: Readonly<Record<number, readonly Cells[]>>; readonly quitters?: readonly Cells[]; readonly people?: readonly Cells[] }): Sources {
  const years = Object.entries(parts.years ?? {})
    .map(([y, rows]) => {
      const year = Number(y);
      const sheet = `${year}-${year + 1}`;
      return { year, sheet, rows: rows.map((value, i) => ({ at: { file: "roster.xlsx", sheet, row: i + 2 }, value: { ...blank(yearSheetOf(year)), ...value } })) };
    })
    .sort((a, b) => b.year - a.year);
  const quitters = (parts.quitters ?? []).map((value, i) => ({ at: { file: "roster.xlsx", sheet: "Quitters", row: i + 2 }, value: { ...blank(QUITTERS_SHEET), ...value } }));
  const people = (parts.people ?? []).map((value, i) => ({ at: { file: "people_rows.csv", row: i + 2 }, value: { ...blank(PEOPLE_CSV), ...value } }));
  return {
    read: [],
    skipped: [],
    currentYear: years[0]?.year ?? null,
    years,
    quitters,
    rolesSheets: [],
    namelessRows: 0,
    csv: { people, teamMembers: [], subteams: [], divisions: [], advisors: [], positions: [], orders: [], faqs: [], overrides: [] },
    conflicts: [],
  } as never;
}

const databaseWith = (units: Units): Snapshot => ({ ...NO_DATABASE, units });
const EMPTY_DATABASE = databaseWith({ departments: [], divisions: [] });
const TODAY = "2026-03-15";

/** The Excel day serial a date cell stores for a day. */
const serialOf = (day: string) => String((Date.parse(day) - Date.UTC(1899, 11, 30)) / 86_400_000);

const person = (first: string, last: string, cells: Cells = {}): Cells => ({
  firstName: first,
  lastName: last,
  personalEmail: `${first}.${last}`.toLowerCase().replace(/\s+/g, ".") + "@example.com",
  title: "Engineer",
  ...cells,
});

test("Quitters date cells stored month/day are swapped back, counted and listed by row; a row no single swap fixes stays unclear", () => {
  const sources = sourcesOf({
    years: { 2025: [person("Alba", "Neri", { subteam: "Propulsion" })] },
    quitters: [
      // Row 2: a leave read as 5 January after a 1 April join is 1 May.
      person("Bruno", "Sala", { joinedOn: serialOf("2023-04-01"), leftOn: serialOf("2023-01-05"), subteam: "Propulsion" }),
      // Row 3: a leave read as 12 July after a 1 August join is 7 December.
      person("Carla", "Toti", { joinedOn: serialOf("2022-08-01"), leftOn: serialOf("2022-07-12"), subteam: "Propulsion" }),
      // Row 4: the leave's day is over 12; the join, read as 1 April, is 4 January.
      person("Dario", "Ugo", { joinedOn: serialOf("2023-04-01"), leftOn: serialOf("2023-01-20"), subteam: "Propulsion" }),
      // Row 5: neither day is 12 or less.
      person("Elsa", "Vico", { joinedOn: serialOf("2023-04-20"), leftOn: serialOf("2023-01-25"), subteam: "Propulsion" }),
      // Row 6: typed text, already day/month.
      person("Fabio", "Zeta", { joinedOn: "1/4/2023", leftOn: "5/1/2023", subteam: "Propulsion" }),
    ],
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual(
    plan.swappedDates.map((s) => [s.at.sheet, s.at.row, s.field]),
    [
      ["Quitters", 2, "leftOn"],
      ["Quitters", 3, "leftOn"],
      ["Quitters", 4, "joinedOn"],
    ],
  );
  assert.deepEqual(
    plan.roles.filter((r) => r.leavedAt !== null).map((r) => [r.startedAt, r.leavedAt]),
    [
      ["2023-04-01", "2023-05-01"],
      ["2022-08-01", "2022-12-07"],
      ["2023-01-04", "2023-01-20"],
    ],
  );
  assert.deepEqual(plan.leaves.map((l) => l.leftAt), ["2023-05-01", "2022-12-07", "2023-01-20"]);
  assert.deepEqual(
    plan.conflicts.filter((c) => c.kind === "quitter-date-unreadable").map((c) => [c.at.row, c.field]),
    [
      [5, "joinedOn"],
      [6, "joinedOn"],
    ],
  );
  const report = renderReport({ mode: "dry-run", database: true, sources, plan });
  assert.match(report, /^Quitters dates read with day and month swapped: 3$/m);
  assert.match(report, /^Quitters dates swapped to day\/month, by row: 3$/m);
  for (const line of ["roster.xlsx › sheet Quitters › row 2 › field leftOn", "roster.xlsx › sheet Quitters › row 3 › field leftOn", "roster.xlsx › sheet Quitters › row 4 › field joinedOn"]) {
    assert.ok(report.includes(`\n  ${line}\n`), `the report lists ${line}`);
  }
});

test("a people_rows.csv row no full name matches is the one person with its surname whose given names hold its first name", () => {
  const sources = sourcesOf({
    years: {
      2025: [
        person("Anna Maria", "Rossì"),
        person("Gianni Luca", "Verdi"),
        person("Luca Mario", "Verdi"),
        person("Paola", "De Santis"),
        person("Rita Elena", "Galli"),
      ],
    },
    people: [
      // Line 2: one given name of a person, the surname without its accent.
      { id: "23", firstName: "Maria", lastName: "rossi" },
      // Line 3: two people named Verdi have a "Luca": none is picked.
      { id: "24", firstName: "Luca", lastName: "Verdi" },
      // Line 4: spacing in the surname does not count.
      { id: "25", firstName: "Paola", lastName: "DeSantis" },
      // Line 5: every word of the first name must be a given name.
      { id: "26", firstName: "Rita Anna", lastName: "Galli" },
      // Line 6: no one has the surname.
      { id: "27", firstName: "Anna", lastName: "Bassi" },
    ],
  });
  const { people, byPeopleId } = matchPeople(sources);
  const named = (first: string) => people.find((p) => p.fields.firstName === first);
  assert.equal(byPeopleId.get("23"), named("Anna Maria"));
  assert.equal(byPeopleId.get("25"), named("Paola"));
  for (const id of ["24", "26", "27"]) assert.equal(byPeopleId.has(id), false, `id ${id} matches no one`);

  // The photo of id 23 is uploaded with Anna Maria's member row; id 24's is reported as not imported, as before.
  const photo = { bytes: new Uint8Array([1]), contentType: "image/jpeg" } as const;
  const folder: PhotoFolder = {
    files: 2,
    photos: [
      { kind: "member", row: 1, id: "23", photo },
      { kind: "member", row: 2, id: "24", photo },
    ],
    ids: new Set(["23", "24"]),
    advisorLines: new Set(),
  };
  const plan = planImport(sources, EMPTY_DATABASE, folder, TODAY);
  assert.equal(plan.photos?.toUpload, 1);
  assert.deepEqual(
    plan.people.filter((p) => p.photo !== null).map((p) => p.user.firstName),
    ["Anna Maria"],
  );
  assert.deepEqual(
    plan.conflicts.filter((c) => c.kind === "photo-not-imported").map((c) => c.at.row),
    [2],
  );
});

test("units the run creates fold by code: one unit per code, a bare code is that unit, named as the newest sheet spells it most, open once", () => {
  const sources = sourcesOf({
    years: {
      // Current: two spellings of AOA (one twice), Logistics twice and misspelt once.
      2025: [
        person("Ada", "Bini", { subteam: "Optimization and Analysis (AOA)", division: "Logistics (LGS)" }),
        person("Ben", "Cori", { subteam: "Optimization and Analysis (AOA)", division: "Logistcs (LGS)" }),
        person("Cia", "Dani", { subteam: "Optimization & Analysis (AOA)", division: "Logistics (LGS)" }),
      ],
      // A past sheet spells AOA a third way, more often than any current spelling.
      2024: [
        person("Dea", "Elmi", { subteam: "Aerodynamic Optimization and Analysis (AOA)" }),
        person("Eva", "Fano", { subteam: "Aerodynamic Optimization and Analysis (AOA)" }),
        person("Fil", "Gaia", { subteam: "Aerodynamic Optimization and Analysis (AOA)" }),
        person("Gea", "Holm", { subteam: "Aerodynamic Optimization and Analysis (AOA)" }),
      ],
      // A bare "VES" is read before the sheet that gives the code its name.
      2023: [person("Ivo", "Lupi", { subteam: "VES" })],
      2022: [person("Lia", "Mori", { subteam: "Vittorio Emanuele II (VES)" })],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual(
    plan.departments.map((d) => [d.name, d.code, d.startedAt, d.closedAt, d.spellings]),
    [
      [
        "Optimization and Analysis",
        "AOA",
        "2024-10-01",
        null,
        ["Optimization and Analysis (AOA)", "Optimization & Analysis (AOA)", "Aerodynamic Optimization and Analysis (AOA)"],
      ],
      ["Vittorio Emanuele II", "VES", "2022-10-01", "2024-09-30", ["VES", "Vittorio Emanuele II (VES)"]],
    ],
  );
  assert.deepEqual(
    plan.divisions.map((d) => [d.name, d.code, d.closedAt, d.spellings]),
    [["Logistics", "LGS", null, ["Logistics (LGS)", "Logistcs (LGS)"]]],
  );
  // Every role sits in one of those units.
  assert.ok(plan.roles.every((r) => r.dept?.kind === "new" && (r.division === null || (r.division.kind === "new" && r.division.index === 0))));
  assert.deepEqual(new Set(plan.roles.map((r) => (r.dept?.kind === "new" ? r.dept.index : -1))), new Set([0, 1]));

  const report = renderReport({ mode: "dry-run", database: true, sources, plan });
  assert.match(report, /^Units to create: 2 departments, 1 divisions$/m);
  for (const lines of [
    [
      "department Optimization and Analysis (AOA): open, from 2024-10-01",
      "  spellings: Optimization and Analysis (AOA); Optimization & Analysis (AOA); Aerodynamic Optimization and Analysis (AOA)",
    ],
    ["department Vittorio Emanuele II (VES): closed, 2022-10-01 to 2024-09-30", "  spellings: VES; Vittorio Emanuele II (VES)"],
    ["division Logistics (LGS) under Optimization and Analysis: open, from 2025-10-01", "  spellings: Logistics (LGS); Logistcs (LGS)"],
  ]) {
    assert.ok(report.includes(`\n  ${lines[0]}\n  ${lines[1]}\n`), `the report lists ${lines[0]} and its spellings`);
  }
});

test("a spelling that finds no unit in the database is the unit another spelling of its code finds", () => {
  const sources = sourcesOf({
    years: {
      2025: [person("Ada", "Bini", { division: "Logistcs (LGS)" })],
      2024: [person("Ben", "Cori", { division: "Logistics (LGS)" }), person("Cia", "Dani", { subteam: "VES" })],
      2022: [person("Dea", "Elmi", { subteam: "Vittorio Emanuele II (VES)" })],
    },
  });
  // The database holds both units, neither with a code.
  const database = databaseWith({ departments: [{ id: 7, name: "Vittorio Emanuele II", code: null }], divisions: [{ id: 9, name: "Logistics", code: null, deptId: null }] });
  const plan = planImport(sources, database, null, TODAY);
  assert.deepEqual([plan.departments.length, plan.divisions.length], [0, 0]);
  assert.deepEqual(
    plan.roles.map((r) => [r.dept?.kind === "existing" ? r.dept.id : null, r.division?.kind === "existing" ? r.division.id : null]),
    [
      [null, 9],
      [null, 9],
      [7, null],
      [7, null],
    ],
  );
});
