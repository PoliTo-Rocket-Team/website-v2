import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { cell, locate, QUITTERS_SHEET, ROLES_SHEET, TEAM_MEMBERS_CSV, YEAR_SHEET } from "./columns";
import { parseCsv } from "./csv";
import { listOf, linkedinLink } from "./plan";
import { readSources, yearOfSheet } from "./sources";
import { seatOf, TITLE_RULES } from "./titles";
import { unitKey } from "./units";

// The import's readers and tables (issue #677): the header alias table, the
// title mapping table, the CSV parser and the small value readers.

test("the alias table finds each field by its header text in every year's spelling", () => {
  const newest = [["", "First Name", "Last Name", "Personal Mail", "Subteam(s)", "Team Title Official", "PRT email", "PRT Domain @politorocketteam.it"]];
  const older = [["Number", "First Name", "Last Name", "Gmail", "poli email", "linkedin", "Subteam", "", "Team Role"]];
  const a = locate(newest, YEAR_SHEET);
  const b = locate(older, YEAR_SHEET);
  assert.ok(a !== null && b !== null);
  assert.deepEqual([a.columns.personalEmail, a.columns.subteam, a.columns.title], [[3], [4], [5]]);
  assert.deepEqual([b.columns.personalEmail, b.columns.studentEmail, b.columns.linkedin, b.columns.subteam, b.columns.title], [[3], [4], [5], [6], [8]]);
  // Two columns for one field: the earlier alias wins where it has a value.
  assert.deepEqual(a.columns.prtEmail, [7, 6]);
  assert.equal(cell(a, ["", "A", "B", "", "", "", "old@example.com", "new@example.com"], "prtEmail"), "new@example.com");
  assert.equal(cell(a, ["", "A", "B", "", "", "", "old@example.com", ""], "prtEmail"), "old@example.com");
});

test("the header row is found below title rows and beside stray cells, not assumed to be row 1", () => {
  const quitters = [["People who left the team"], [], ["Left the Team on:", "Joined the Team on:", "", "0 Number", "First Name", "Last Name", "LinkendIn Username"]];
  const found = locate(quitters, QUITTERS_SHEET);
  assert.equal(found?.headerRow, 3);
  assert.deepEqual([found?.columns.leftOn, found?.columns.linkedin], [[0], [6]]);
  const stray = [["Number", "First Name", "Last Name", "Subteam", "", "Team Role", "", "Total people: 2"]];
  assert.equal(locate(stray, YEAR_SHEET)?.headerRow, 1);
  assert.equal(locate([["Roles"], ["First Name", "Last Name", "Subteam", "Division", "Group", "Team Role"]], ROLES_SHEET)?.headerRow, 2);
  assert.equal(locate([["first_name", "last_name", "poli_email"]], TEAM_MEMBERS_CSV)?.headerRow, 1);
  assert.equal(locate([["no", "header", "here"]], YEAR_SHEET), null);
});

test("year sheets are named YYYY-YYYY with consecutive years, and the current one is the newest unless the run names another", () => {
  assert.equal(yearOfSheet("2025-2026"), 2025);
  assert.equal(yearOfSheet("2025-2027"), null);
  assert.equal(yearOfSheet("Stats"), null);
  const files = join(__dirname, "fixtures", "files");
  const newest = readSources(files);
  assert.equal(newest.currentYear, 2025);
  assert.deepEqual(newest.years.map((y) => y.sheet), ["2025-2026", "2024-2025", "2023-2024"]);
  const named = readSources(files, 2024);
  assert.equal(named.currentYear, 2024);
  assert.deepEqual(named.years.map((y) => y.sheet), ["2024-2025", "2023-2024"]);
  assert.ok(named.skipped.some((s) => s.includes("2025-2026")));
  assert.throws(() => readSources(files, 2019));
});

test("the title table gives each seat its type, full-access flag and unit", () => {
  const read = (title: string) => {
    const seat = seatOf(title);
    return seat === null ? null : [seat.type, seat.fullAccess, seat.unit];
  };
  assert.deepEqual(read("Team Leader"), ["president", null, "board"]);
  assert.deepEqual(read("President"), ["president", null, "board"]);
  assert.deepEqual(read("Chief Engineer"), ["core", "chief_engineer", "board"]);
  assert.deepEqual(read("Project Manager"), ["core", "project_manager", "board"]);
  assert.deepEqual(read("Head of Operations"), ["head", "operations_lead", "department"]);
  assert.deepEqual(read("IT Lead"), ["lead", "it_lead", "division"]);
  assert.deepEqual(read("Head of Propulsion"), ["head", null, "department"]);
  assert.deepEqual(read("Liquid Systems Lead"), ["lead", null, "division"]);
  assert.deepEqual(read("Faculty Advisor"), ["advisor", null, "member-unit"]);
  assert.deepEqual(read("Valve Engineer"), ["core", null, "member-unit"]);
  assert.deepEqual(read(""), ["core", null, "member-unit"]);
  assert.equal(read("Vice Team Leader"), null);
  assert.equal(read("Group Coordinator"), null);
  assert.ok(TITLE_RULES.length > 0);
});

test("the CSV parser keeps quoted commas, doubled quotes and line breaks in one field, and names each record's first line", () => {
  const records = parseCsv('id,question,answer\r\n1,"Why, though?","He said ""yes"".\n\nThen left."\n2,Plain,Text\n');
  assert.deepEqual(
    records.map((r) => [r.line, r.cells]),
    [
      [1, ["id", "question", "answer"]],
      [2, ["1", "Why, though?", 'He said "yes".\n\nThen left.']],
      [5, ["2", "Plain", "Text"]],
    ],
  );
});

test("list cells, LinkedIn handles and unit names read the old export's shapes", () => {
  assert.deepEqual(listOf('["CAD", "Python"]'), ["CAD", "Python"]);
  assert.deepEqual(listOf('{"Fluid dynamics",Teamwork}'), ["Fluid dynamics", "Teamwork"]);
  assert.deepEqual(listOf("- TypeScript\n- SQL\n"), ["TypeScript", "SQL"]);
  assert.equal(linkedinLink("someone-example"), "https://www.linkedin.com/in/someone-example");
  assert.equal(linkedinLink("https://it.linkedin.com/in/someone-example/"), "https://www.linkedin.com/in/someone-example");
  assert.equal(linkedinLink("not a handle"), null);
  assert.equal(unitKey("Design & Manufacturing Division"), unitKey("design and manufacturing"));
});
