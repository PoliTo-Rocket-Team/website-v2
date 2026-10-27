import assert from "node:assert/strict";
import { test } from "node:test";
import { PEOPLE_CSV, QUITTERS_SHEET, yearSheetOf } from "./columns";
import { matchPeople } from "./people";
import type { PhotoFolder } from "./photos";
import { planImport, type Plan } from "./plan";
import { renderReport } from "./report";
import { NO_DATABASE, type Snapshot } from "./snapshot";
import type { Sources } from "./sources";
import type { UnitRef } from "./unit-book";
import { DepartmentIndex, rowUnitNames, unitNames, type Units } from "./units";

// The roster shapes of issues #818 and #820, planned over an in-memory fake
// roster (no file, no database): Quitters date cells stored month/day, a
// people_rows.csv first name shorter than the workbook's given names, one unit
// spelt several ways, a separator inside parentheses, a note naming a parent
// department, one division name under two departments, a job title in the
// Division cell, and a plural spelling. Every name here is invented.

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
    csv: { people, teamMembers: [], subteams: [], divisions: [], advisors: [], orders: [], faqs: [], overrides: [] },
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
  const { people, matchPeopleRows } = matchPeople(sources);
  const { byPeopleId } = matchPeopleRows(() => true);
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

test("the given-names fallback counts only imported people: a refused person with the same surname does not make the row ambiguous", () => {
  const sources = sourcesOf({
    years: {
      2025: [
        person("Anna Maria", "Neri"),
        // Refused: no sign-in email.
        person("Anna Elena", "Neri", { personalEmail: "" }),
      ],
    },
    people: [{ id: "30", firstName: "Anna", lastName: "Neri" }],
  });
  // Counting every matched person, two fit and the row matches no one.
  assert.equal(matchPeople(sources).matchPeopleRows(() => true).byPeopleId.has("30"), false);

  const photo = { bytes: new Uint8Array([1]), contentType: "image/jpeg" } as const;
  const folder: PhotoFolder = { files: 1, photos: [{ kind: "member", row: 1, id: "30", photo }], ids: new Set(["30"]), advisorLines: new Set() };
  const plan = planImport(sources, EMPTY_DATABASE, folder, TODAY);
  assert.equal(plan.counts.users.refused, 1);
  assert.equal(plan.photos?.toUpload, 1);
  assert.deepEqual(
    plan.people.filter((p) => p.photo !== null).map((p) => p.user.firstName),
    ["Anna Maria"],
  );
  assert.equal(plan.conflicts.filter((c) => c.kind === "photo-not-imported").length, 0);
});

test("a group whose spellings find two database units is unresolved and reported, never created as a third unit", () => {
  const sources = sourcesOf({
    years: {
      2025: [
        person("Ada", "Bini", { subteam: "Alpha (X)" }),
        person("Ben", "Cori", { subteam: "Beta (X)" }),
        person("Cia", "Dani", { subteam: "Gamma (X)" }),
      ],
    },
  });
  const database = databaseWith({
    departments: [
      { id: 1, name: "Alpha", code: null },
      { id: 2, name: "Beta", code: null },
    ],
    divisions: [],
  });
  const plan = planImport(sources, database, null, TODAY);
  assert.deepEqual(plan.departments, []);
  assert.equal(plan.unresolvedUnits, 1);
  assert.deepEqual(
    plan.conflicts.filter((c) => c.kind === "unknown-unit").map((c) => [c.at.row, c.field]),
    [[4, "subteam"]],
  );
  assert.deepEqual(
    plan.roles.map((r) => (r.dept?.kind === "existing" ? r.dept.id : null)),
    [1, 2],
  );
});

test("a created unit's name, open state and spellings come from one set of values: a refused row's spelling is listed when it names the unit", () => {
  const sources = sourcesOf({
    years: {
      // Current: only refused rows (no sign-in email), with the misspelling.
      2025: [person("Ada", "Bini", { division: "Logistcs (LGS)", personalEmail: "" }), person("Ben", "Cori", { division: "Logistcs (LGS)", personalEmail: "" })],
      2024: [person("Cia", "Dani", { division: "Logistics (LGS)" })],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.equal(plan.counts.users.refused, 2);
  assert.deepEqual(
    plan.divisions.map((d) => [d.name, d.closedAt, [...d.spellings].sort()]),
    [["Logistcs", null, ["Logistcs (LGS)", "Logistics (LGS)"]]],
  );
  const report = renderReport({ mode: "dry-run", database: true, sources, plan });
  const listed = report.split("\n").find((l) => l.trim().startsWith("spellings:")) ?? "";
  assert.ok(listed.includes("Logistcs (LGS)") && listed.includes("Logistics (LGS)"), "the spellings line names the spelling the unit is named after");
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

/** A unit a plan names: a created one by its name, an existing one by its id. */
const nameOf = (plan: Plan, level: "departments" | "divisions", ref: UnitRef | null): string | null =>
  ref === null ? null : ref.kind === "new" ? plan[level][ref.index].name : `#${ref.id}`;

/** Each division a plan creates: its name, code, department and open state, sorted. */
const createdDivisions = (plan: Plan) =>
  plan.divisions.map((d) => [d.name, d.code, nameOf(plan, "departments", d.dept), d.closedAt === null ? "open" : "closed"]).sort((a, b) => String(a).localeCompare(String(b)));

test("issue #820: a comma, slash or ' - ' inside parentheses never splits a unit cell; 'ADVISOR (VES, AMV)' is one advisor marker and no unit", () => {
  assert.deepEqual(unitNames("ADVISOR (VES, AMV)"), ["ADVISOR (VES, AMV)"]);
  assert.deepEqual(unitNames("Propulsion (PRO / LPR) - Recovery (REC - X); Avionics, N/A"), ["Propulsion (PRO / LPR)", "Recovery (REC - X)", "Avionics", "N/A"]);
  // An open parenthesis never closed does not hold the rest of the cell together.
  assert.deepEqual(unitNames("Propulsion (PRO, Avionics"), ["Propulsion (PRO", "Avionics"]);

  const sources = sourcesOf({
    years: {
      2025: [person("Ada", "Bini", { subteam: "ADVISOR (VES, AMV)", title: "" })],
      2023: [person("Ben", "Cori", { subteam: "SENIOR ADVISOR (VES, AMV)", title: "" })],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual([plan.departments, plan.divisions], [[], []]);
  assert.deepEqual(
    plan.roles.map((r) => [r.title, r.type, r.dept, r.division]),
    [
      ["Advisor", "advisor", null, null],
      ["Senior Advisor", "advisor", null, null],
    ],
  );
  assert.deepEqual(plan.conflicts.filter((c) => c.kind === "unknown-unit"), []);
});

test("issue #820: a division's note that names a department is its department, not its code, and never joins a code group", () => {
  const index = new DepartmentIndex([
    { name: "Propulsion", code: "PRO" },
    { name: "Operations", code: null },
  ]);
  const unit = (name: string, code: string | null) => ({ kind: "unit" as const, name, code });
  assert.equal(index.parentOf(unit("Propulsion", "PRO")), null, "a department's own code is a code");
  assert.equal(index.parentOf(unit("Hybrid Motors", "HYB")), null, "a note no department has is a code");
  assert.deepEqual(index.parentOf(unit("IT&Media", "Operations")), unit("Operations", null), "by name");
  assert.deepEqual(index.parentOf(unit("Valves", "PRO")), unit("PRO", null), "by code");
  assert.deepEqual(
    rowUnitNames("", "IT&Media (Operations)", new Set(), "past", index).divisions.map((d) => [d.value.name, d.value.code, d.department?.name]),
    [["IT&Media", null, "Operations"]],
  );

  const sources = sourcesOf({
    years: {
      2025: [person("Ada", "Bini", { subteam: "Operations", division: "Logistics (LGS)" })],
      2021: [
        person("Ben", "Cori", { subteam: "Cavour", division: "Avionics (Cavour)" }),
        person("Cia", "Dani", { division: "IT&Media (Operations)" }),
        person("Dea", "Elmi", { division: "Logistics (Operations)" }),
        person("Eva", "Fano", { subteam: "Vittorio Emanuele II (VES)", division: "Avionics" }),
      ],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual(
    plan.departments.map((d) => [d.name, d.closedAt === null ? "open" : "closed"]),
    [
      ["Operations", "open"],
      ["Cavour", "closed"],
      ["Vittorio Emanuele II", "closed"],
    ],
  );
  // "IT&Media (Operations)" is IT&Media under Operations, not folded into Logistics; "Avionics (Cavour)" is not the Avionics of VES.
  assert.deepEqual(createdDivisions(plan), [
    ["Avionics", null, "Cavour", "closed"],
    ["Avionics", null, "Vittorio Emanuele II", "closed"],
    ["IT&Media", null, "Operations", "closed"],
    ["Logistics", "LGS", "Operations", "open"],
  ]);
  assert.deepEqual(plan.divisions.find((d) => d.name === "Logistics")?.spellings, ["Logistics (LGS)", "Logistics"]);

  // A note naming a database department by its code places the division under that department.
  const database = databaseWith({ departments: [{ id: 3, name: "Operations", code: "OPS" }], divisions: [] });
  const byCode = planImport(sourcesOf({ years: { 2025: [person("Fil", "Gaia", { division: "IT&Media (OPS)" })] } }), database, null, TODAY);
  assert.deepEqual(createdDivisions(byCode), [["IT&Media", null, "#3", "open"]]);
});

test("issue #820: a division's department is the newest sheet's; one name under a past department is its own closed division unless the code is the same", () => {
  const sources = sourcesOf({
    years: {
      2025: [
        person("Ada", "Bini", { subteam: "Aeromechanics", division: "Mission Analysis (MSA)" }),
        person("Fil", "Gaia", { subteam: "Systems Engineering", division: "Hardware (HDW)" }),
      ],
      // No department on the row: the name's group under the newest sheet's department.
      2024: [person("Gea", "Holm", { division: "Mission Analysis" })],
      2023: [
        person("Ben", "Cori", { subteam: "Vittorio Emanuele II (VES)", division: "Mission Analysis" }),
        person("Cia", "Dani", { subteam: "Vittorio Emanuele II (VES)", division: "Avionics" }),
        // Fil's older row is placed first: the division still goes under the newest sheet's department.
        person("Fil", "Gaia", { subteam: "Electronics", division: "Hardware (HDW)" }),
      ],
      2022: [person("Dea", "Elmi", { subteam: "Cavour", division: "Avionics" })],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual(createdDivisions(plan), [
    ["Avionics", null, "Cavour", "closed"],
    ["Avionics", null, "Vittorio Emanuele II", "closed"],
    ["Hardware", "HDW", "Systems Engineering", "open"],
    ["Mission Analysis", null, "Vittorio Emanuele II", "closed"],
    ["Mission Analysis", "MSA", "Aeromechanics", "open"],
  ]);
  const placed = (p: Plan) =>
    p.roles.map((r) => `${nameOf(p, "divisions", r.division)} ${nameOf(p, "departments", r.dept)} ${r.startedAt.slice(0, 4)}`).sort();
  assert.deepEqual(placed(plan), [
    "Avionics Cavour 2022",
    "Avionics Vittorio Emanuele II 2023",
    "Hardware Systems Engineering 2023",
    "Hardware Systems Engineering 2025",
    "Mission Analysis Aeromechanics 2024",
    "Mission Analysis Aeromechanics 2025",
    "Mission Analysis Vittorio Emanuele II 2023",
  ]);

  // A second run finds each division under its own department, and creates none.
  const database = databaseWith({
    departments: [
      { id: 1, name: "Cavour", code: null },
      { id: 2, name: "Vittorio Emanuele II", code: "VES" },
      { id: 3, name: "Aeromechanics", code: null },
      { id: 4, name: "Electronics", code: null },
      { id: 5, name: "Systems Engineering", code: null },
    ],
    divisions: [
      { id: 10, name: "Avionics", code: null, deptId: 1 },
      { id: 11, name: "Avionics", code: null, deptId: 2 },
      { id: 12, name: "Mission Analysis", code: "MSA", deptId: 3 },
      { id: 13, name: "Mission Analysis", code: null, deptId: 2 },
      { id: 14, name: "Hardware", code: "HDW", deptId: 5 },
    ],
  });
  const second = planImport(sources, database, null, TODAY);
  assert.deepEqual([second.departments, second.divisions, second.unresolvedUnits], [[], [], 0]);
  assert.deepEqual(placed(second), ["#10 #1 2022", "#11 #2 2023", "#12 #3 2024", "#12 #3 2025", "#13 #2 2023", "#14 #5 2023", "#14 #5 2025"]);
});

test("issue #820: a Division value ending in 'Lead' or 'Lead Engineer' is that division, and no unit takes the job title's name", () => {
  const sources = sourcesOf({
    years: {
      2025: [
        person("Ada", "Bini", { subteam: "Propulsion", division: "Safety Lead" }),
        person("Ben", "Cori", { subteam: "Propulsion", division: "Liquid System Architecture  lead   ENGINEER" }),
        person("Cia", "Dani", { subteam: "Propulsion", division: "Safety" }),
        person("Dea", "Elmi", { subteam: "Propulsion", division: "Liquid System Architecture" }),
      ],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual(createdDivisions(plan), [
    ["Liquid System Architecture", null, "Propulsion", "open"],
    ["Safety", null, "Propulsion", "open"],
  ]);
  assert.deepEqual(new Set(plan.roles.map((r) => nameOf(plan, "divisions", r.division))), new Set(["Safety", "Liquid System Architecture"]));
});

test("issue #820: names that differ only by a word's plural 's' fold together, open when the current sheet gives one", () => {
  const sources = sourcesOf({
    years: {
      2025: [person("Ada", "Bini", { subteam: "Operations", division: "Ground Systems (GNS)" })],
      2023: [person("Ben", "Cori", { subteam: "Operation", division: "Ground System" })],
      2022: [person("Cia", "Dani", { subteam: "Recovery Systems", division: "Parachute" })],
      2021: [person("Dea", "Elmi", { subteam: "Recovery System" })],
    },
  });
  const plan = planImport(sources, EMPTY_DATABASE, null, TODAY);
  assert.deepEqual(
    plan.departments.map((d) => [d.name, d.closedAt === null ? "open" : "closed", d.spellings]),
    [
      ["Operations", "open", ["Operations", "Operation"]],
      ["Recovery Systems", "closed", ["Recovery Systems", "Recovery System"]],
    ],
  );
  assert.deepEqual(
    plan.divisions.map((d) => [d.name, d.code, d.closedAt === null ? "open" : "closed", d.spellings]),
    [
      ["Ground Systems", "GNS", "open", ["Ground Systems (GNS)", "Ground System"]],
      ["Parachute", null, "closed", ["Parachute"]],
    ],
  );
});
