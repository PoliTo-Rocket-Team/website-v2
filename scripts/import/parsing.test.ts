import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { cell, locate, QUITTERS_SHEET, ROLES_SHEET, TEAM_MEMBERS_CSV, YEAR_SHEET } from "./columns";
import { parseCsv } from "./csv";
import { listOf, linkedinLink } from "./plan";
import { readSources, yearOfSheet } from "./sources";
import sharp from "sharp";
import { checkMemberPhoto } from "@/lib/dashboard/division-members";
import { matchPhotos, shapeMemberPhoto, surnameKey, type PhotoFile } from "./photos";
import { seatOf, seatsOf, TITLE_RULES } from "./titles";
import { departmentOf, divisionOf, readUnitValue, rowUnitNames, subteamReadingOf, unitKey, unitNames, unitValues, type Units } from "./units";

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
  // "Safety Officer" is a core member's seat (#816); any other officer is still not guessed.
  assert.deepEqual(read("Safety Officer"), ["core", null, "member-unit"]);
  assert.equal(read("Press Officer"), null);
  assert.ok(TITLE_RULES.length > 0);
});

test("the #816 title readings: AMV prefix, Safety Officer, '<Dept> Head of Department', '&' between seats and President-Advisor", () => {
  const seats = (cell: string) =>
    seatsOf(cell).map((s) => (s.kind === "seat" ? [s.title, s.seat.type, s.seat.fullAccess, s.seat.unit, s.project] : ["unknown", s.title]));
  assert.deepEqual(seats("AMV Chief Engineer"), [["Chief Engineer", "core", "chief_engineer", "board", null]]);
  assert.deepEqual(seats("Safety Officer"), [["Safety Officer", "core", null, "member-unit", null]]);
  assert.deepEqual(seats("Electronics Head of Department - Hardware Lead Engineer"), [
    ["Electronics Head of Department", "head", null, "department", null],
    ["Hardware Lead Engineer", "lead", null, "division", null],
  ]);
  assert.deepEqual(seats("President & Chief Engineer"), [
    ["President", "president", null, "board", null],
    ["Chief Engineer", "core", "chief_engineer", "board", null],
  ]);
  // "&" parts seats only where the table reads every part: a unit name with "&" in it stays one seat.
  assert.deepEqual(seats("Design & Manufacturing Lead"), [["Design & Manufacturing Lead", "lead", null, "division", null]]);
  assert.deepEqual(seats("President-Advisor (Project Cavour)"), [
    ["President", "president", null, "board", null],
    ["Advisor (Project Cavour)", "advisor", null, "noted-department", "Project Cavour"],
  ]);
  assert.deepEqual(seats("Co-Lead"), [["unknown", "Co-Lead"]]);
});

test("the #816 unit readings: past subteams are departments, AMV is no unit, '/' splits, and '<Dept> Department - <Division>' is both", () => {
  const projects = new Set([unitKey("Cavour"), unitKey("Efesto"), unitKey("VES")]);
  // Before 2024-2025, and on the Quitters and Roles sheets, a subteam that names a project is a department.
  assert.equal(subteamReadingOf({ kind: "year", year: 2023 }), "past");
  assert.equal(subteamReadingOf({ kind: "year", year: 2024 }), "present");
  assert.equal(subteamReadingOf({ kind: "quitters" }), "past");
  assert.equal(subteamReadingOf({ kind: "roles" }), "past");
  const past = rowUnitNames("Cavour - Liquid Propulsion", "", projects, "past");
  assert.deepEqual(past.departments.map((d) => d.value.name), ["Cavour", "Liquid Propulsion"]);
  assert.equal(past.projectOnly, false);
  const present = rowUnitNames("Cavour", "", projects, "present");
  assert.deepEqual([present.departments.length, present.projectOnly], [0, true]);

  assert.deepEqual(unitValues("AMV - Amerigo Vespucci (AMV) - Propulsion", projects), [{ kind: "none" }, { kind: "none" }, { kind: "unit", name: "Propulsion", code: null }]);

  assert.deepEqual(unitNames("Hybrid Motors (HYB) / Information Technology (IT), Logistics (LGS)"), ["Hybrid Motors (HYB)", "Information Technology (IT)", "Logistics (LGS)"]);
  assert.deepEqual(unitNames("IT/Logistics"), ["IT", "Logistics"]);
  assert.deepEqual(unitNames("N/A"), ["N/A"]);
  assert.deepEqual(unitNames("n/a - Propulsion"), ["n/a", "Propulsion"]);

  const both = rowUnitNames("", "Electronics (ELT) Department - Hardware (HDW)", projects, "present");
  assert.deepEqual(
    both.departments.map((d) => [d.value.name, d.value.code, d.cell]),
    [["Electronics Department", "ELT", "division"]],
  );
  assert.deepEqual(
    both.divisions.map((d) => [d.value.name, d.value.code, d.department?.name ?? null]),
    [["Hardware", "HDW", "Electronics Department"]],
  );
  // A department named in both cells is one department.
  assert.equal(rowUnitNames("Electronics (ELT)", "Electronics Department - Hardware", projects, "present").departments.length, 1);
});

test("the title table reads each named form by an explicit rule", () => {
  const read = (title: string) => {
    const seat = seatOf(title);
    return seat === null ? null : [seat.type, seat.fullAccess, seat.unit];
  };
  // "<unit> Lead Engineer" and "<unit> Division Lead Engineer": a lead of the row's division.
  assert.deepEqual(read("Avionics Lead Engineer"), ["lead", null, "division"]);
  assert.deepEqual(read("Avionics Division Lead Engineer"), ["lead", null, "division"]);
  assert.deepEqual(read("IT Lead Engineer"), ["lead", "it_lead", "division"]);
  // "<area> Coordinator" and "<area> Manager": a core member; Project Manager keeps its full-access seat.
  for (const t of ["Recruitment Coordinator", "Coordinator", "Social Media Manager", "Sponsoring Manager", "Facility Manager", "IT Manager", "Program Manager", "Safety Manager", "Launch Manager"]) {
    assert.deepEqual(read(t), ["core", null, "member-unit"], t);
  }
  assert.deepEqual(read("Project Manager"), ["core", "project_manager", "board"]);
  // Chief Operating Officer: the operations department's head and its full-access seat. Chief Technologist: a board member, no access.
  assert.deepEqual(read("Chief Operating Officer"), ["head", "operations_lead", "department"]);
  assert.deepEqual(read("Chief Technologist"), ["core", null, "board"]);
  // Head of Department: the head of the subteam's department.
  assert.deepEqual(read("Head of Department"), ["head", null, "department"]);
});

test("a title cell splits on ' - ' into one seat each; '(acting)' and a project in parentheses keep the seat and stay in the title", () => {
  const seats = seatsOf("Head of Department - Avionics Lead (acting)");
  assert.deepEqual(
    seats.map((s) => (s.kind === "seat" ? [s.title, s.seat.type, s.seat.unit, s.acting, s.project] : null)),
    [
      ["Head of Department", "head", "department", false, null],
      ["Avionics Lead (acting)", "lead", "division", true, null],
    ],
  );
  const [chief] = seatsOf("Chief Engineer (Cavour)");
  assert.ok(chief.kind === "seat");
  assert.deepEqual([chief.title, chief.seat.fullAccess, chief.acting, chief.project], ["Chief Engineer (Cavour)", "chief_engineer", false, "Cavour"]);
  const [both] = seatsOf("Team Leader (Cavour) (acting)");
  assert.ok(both.kind === "seat");
  assert.deepEqual([both.seat.type, both.acting, both.project], ["president", true, "Cavour"]);
  // A hyphen inside a word does not split; an unknown seat is reported beside the known ones.
  assert.deepEqual(seatsOf("Co-Lead").map((s) => s.kind), ["unknown"]);
  assert.deepEqual(seatsOf("Valve Engineer - Vice Team Leader").map((s) => s.kind), ["seat", "unknown"]);
  assert.deepEqual(seatsOf("").map((s) => (s.kind === "seat" ? [s.title, s.seat.type] : null)), [["Member", "core"]]);
});

test("unit cells split on ' - ', ',' and ';', read a code in parentheses, N/A, advisor markers and project names", () => {
  const projects = new Set([unitKey("Cavour"), unitKey("Liquid Propulsion")]);
  assert.deepEqual(unitNames("Propulsion (PRO) - Structures, Avionics; Recovery"), ["Propulsion (PRO)", "Structures", "Avionics", "Recovery"]);
  assert.deepEqual(unitValues("N/A", projects), [{ kind: "none" }]);
  assert.deepEqual(unitValues("Propulsion (PRO) - Cavour", projects), [
    { kind: "unit", name: "Propulsion", code: "PRO" },
    { kind: "project", name: "Cavour" },
  ]);
  assert.deepEqual(readUnitValue("Liquid Propulsion", projects), { kind: "project", name: "Liquid Propulsion" });
  assert.deepEqual(readUnitValue("ADVISOR", projects), { kind: "advisor", senior: false, project: null });
  assert.deepEqual(readUnitValue("SENIOR ADVISOR (Cavour)", projects), { kind: "advisor", senior: true, project: "Cavour" });
  assert.deepEqual(readUnitValue("Avionics Department", projects), { kind: "unit", name: "Avionics Department", code: null });

  const units: Units = {
    departments: [{ id: 1, name: "Propulsion", code: "PRP" }],
    divisions: [{ id: 7, name: "Hybrid Motors", code: "HYB", deptId: 1 }],
  };
  const unit = (name: string, code: string | null = null) => ({ kind: "unit" as const, name, code });
  assert.equal(departmentOf(units, unit("Propulsion", "PRO"))?.id, 1, "by name");
  assert.equal(departmentOf(units, unit("Propulsione", "PRP"))?.id, 1, "by the code in parentheses");
  assert.equal(departmentOf(units, unit("Propulsion Department"))?.id, 1, "a <name> Department form");
  assert.equal(divisionOf(units, unit("Hybrid Motors Division"))?.id, 7);
  assert.equal(departmentOf(units, unit("Underwater Basket Weaving", "UBW")), null, "reported as unresolved");
});

test("a photo file matches on its id first, exactly; the surname only cross-checks", () => {
  const file = (row: number, id: string | null, surname: string): PhotoFile => ({ row, id, surname, bytes: Buffer.alloc(0) });
  const row = (id: string, lastName: string) => ({ at: { file: "x.csv", row: 2 }, value: { id, firstName: "A", lastName, linkedin: "", user: "", title: "T", hasPhoto: "" } });
  const sources = { csv: { people: [row("1", "Rossi"), row("3", "De Luca"), row("4", "Verdi")], advisors: [row("3", "Neri"), row("4", "Bianchi")] } } as never;
  const kinds = matchPhotos(
    [file(1, "1", "rossi"), file(2, "1", "bianchi"), file(3, "2", "rossi"), file(4, null, "rossi"), file(5, "3", "deluca"), file(6, "3", "neri"), file(7, "4", "gialli"), file(8, "01", "rossi")],
    sources,
  ).map((m) => m.kind);
  assert.deepEqual(kinds, ["member", "surname-differs", "no-id-match", "no-id-match", "member", "advisor", "shared-id", "no-id-match"]);
  assert.equal(surnameKey("De Luca"), surnameKey("de-luca"));
});

test("a member photo is shaped as the crop dialog makes one: a centred square of at most 800 px, a JPEG that passes checkMemberPhoto", async () => {
  const wide = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
  const shaped = await shapeMemberPhoto(wide);
  assert.ok(shaped !== null);
  const meta = await sharp(shaped.bytes).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["jpeg", 800, 800]);
  assert.equal(checkMemberPhoto({ type: shaped.contentType, size: shaped.bytes.byteLength }), null);
  const small = await shapeMemberPhoto(await sharp({ create: { width: 30, height: 50, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer());
  assert.deepEqual([(await sharp(small!.bytes).metadata()).width, (await sharp(small!.bytes).metadata()).height], [30, 30]);
  assert.equal(await shapeMemberPhoto(Buffer.from("not an image")), null);
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
