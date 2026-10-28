import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import writeXlsxFile from "write-excel-file/node";

// Writes the import's fake source files (issue #677) into ./files: a roster
// workbook and the CSV exports, small and invented, every name made up and
// every email on example.com. Run it with `pnpm exec tsx
// scripts/import/fixtures/make-fixtures.ts` after changing what it plants; the
// files it writes are committed, and ../import.test.ts reads them.
//
// What is planted, by the people who carry it:
// - Alice Marino: team leader now; in 2024-2025 under the old headers, her
//   email in the "poli email" column (it is her "Personal Mail" now) and her
//   name spelled differently, so only the email links her two years.
// - Sara Testa: the alumnus. 2023-2024 (her division only on "Roles 23-24")
//   and 2024-2025; on Quitters with the day she left.
// - Tommaso Neri, Valeria Pace: two heads of Structures in 2024-2025 (a past
//   year, so both are inserted); Tommaso is an alumnus not on Quitters.
// - Giulia Russo: on Quitters and on the current sheet (an unclear quitter
//   who imports as an active member). Ugo Sala: on Quitters only, with the
//   day he left (a quitter-only alumnus of 2023-2024).
// - One conflict of each kind: Bruno Conti twice in 2025-2026 (duplicate);
//   Luca Moretti with no email; Irene Costa in an unknown division; Hugo
//   Bianchi with an unknown title; Elena Greco a second head of Propulsion
//   (Irene's division and Pietro's "Avionics Legacy" are on the current sheet,
//   so they are created open, issue #816);
//   Zeno Fabbri a second team leader; Fabio Ricci the chief engineer the test
//   database already seats; Marta Villa whose CSV program disagrees; Paolo
//   Lombardi who matches an imported Alumni entry the test lays; Nicola
//   Fontana's 2024 row carrying Carla Ferri's email (two people); and CSV rows
//   that do not fit the schema. Wanda Riva's sign-in email is an existing
//   account without a member row: no conflict since issue #820, the account is
//   linked to her new member row.
// - The title and unit forms: Rita Longo holds two seats in one cell, an
//   acting one among them, with a unit code in parentheses, a project and an
//   "N/A" beside her units; Ettore Bassi's subteam is only a project; Sofia
//   Marchi carries a "SENIOR ADVISOR (<project>)" marker; Pietro Rinaldi's
//   "<area> Manager - <area> Coordinator" cell sits on a subteam cell that
//   lists a unit the database lacks. Olga Serra is a member the test
//   database already holds.
// - photos/: tiny generated JPEGs. In sorted order: 1 Marta's (a member
//   match, not square), 2 an id whose surname differs, 3 Olga's (already in
//   the database), 4 Dario's, by an id an advisor row also has (an id is
//   always a people_rows.csv id), 5 an id whose person has another surname,
//   6 an id no people_rows.csv row has, 7 a surname only, the one advisor of
//   advisors_rows.csv with it, 8 a surname only, Sofia Marchi's, whose
//   workbook row is an advisor's, 9 a surname only no advisor has. Carla
//   Ferri and the "No Title" advisor are flagged has_pp with no file.
//
// It also writes ./rules: a second, smaller roster for the reading rules of
// issue #816, which ../rules.test.ts reads, and the overrides.csv input
// beside it. What is planted there:
// - 2025-2026 (current): Anna Bello "AMV Chief Engineer" with an "AMV"
//   subteam; Bianca Corsi a "Safety Officer"; Carlo Dini (row 4) and Davide
//   Elia (row 5) both "Project Manager", row 4 handing the seat to row 5;
//   Emma Fermi with three subteams (one "Amerigo Vespucci (AMV)") and three
//   divisions split by "/" and ","; Franco Gatti with two subteams and one
//   division, under the second subteam's department only by its subteam;
//   Rosa Sarti in a department and division the database lacks (created
//   open); a template row with no name and Anna's email; Yara Gori (row 10)
//   and Leo Pini (row 11) both head of Avionics, row 10 handing the seat to
//   row 11.
// - 2024-2025: Gina Hale "Electronics Head of Department - Hardware Lead
//   Engineer" with a "<Dept> Department - <Division>" Division cell; Franco
//   under "Cavour" (from 2024-2025 on a project, not a department); Ivo Jori
//   in a division the database lacks; Quinto Rossi whose subteam only the
//   "Roles 24-25" sheet gives ("Efesto").
// - 2022-2023, its Division column headed "A" and a "Date of joining"
//   column: Lia Kent "President-Advisor (Project Cavour)" under "Cavour", no
//   joining day; Mario Lodi under a past subteam and a division paired with it
//   in the "A" column, joined on a date cell; Nora Monti under "Vittorio
//   Emanuele II (VES) - Management", joined on a "d/m/yyyy" day; Ivo again,
//   with a joining day that does not read (row 5).
// - Roles 22-23: not read. It gives Lia a division and holds a row that
//   matches nobody, so reading it would show.
// - 2021-2022: Oscar Neri "President & Chief Engineer"; Mario under "Liquid
//   Propulsion"; Pia Orsi under "Efesto", and on Quitters.
// - Quitters, on no year sheet: Sergio Tosi (row 3, a date cell and a
//   "dd/mm/yyyy" join day), Teresa Ugolini (row 4, "d/m/yyyy"), Ugo Valli
//   (row 5, "dd.mm.yyyy" and a date cell join day), Vera Zanni (row 6, no
//   dates, placed in 2022-2023 by overrides.csv), Walter Bassi (row 7, no
//   dates, no override), Xenia Conti (row 8, a date that does not read); last,
//   a row with no name and Pia's email.
// - overrides.csv: line 2 hands the 2025-2026 row 4 seat to row 5; line 3
//   names a past sheet; line 4 places Quitters row 6 in 2022-2023; line 5
//   names Pia's Quitters row, who is on a year sheet; line 6 has an unknown
//   kind; line 7 hands the 2025-2026 row 10 head seat to row 11. Lines 3, 5
//   and 6 are not applied.

//
// It also writes ./positions: the old exports the positions-only run reads
// (issue #834), which ../positions.test.ts runs over, plus a people and an FAQ
// export it must leave alone. Each positions_rows.csv line plants one case,
// against the divisions that test lays: line 2 maps by code under another
// name and carries a form id and `open` true; line 3 by a plural spelling of
// the name; line 4 by code; line 5 repeats line 4's title in other case and
// spacing (a duplicate); line 6 has line 4's title in another division (no
// duplicate); line 7's name finds two divisions, line 8's code two; line 9
// finds none; line 10 is the test division; line 11's id is a subteam's,
// mapped by name; line 12's id is on no row; line 13 has no title; line 14,
// over three lines, maps to a closed division.

const OUT = join(__dirname, "files");
const RULES_OUT = join(__dirname, "rules");
const POSITIONS_OUT = join(__dirname, "positions");

type Cell = string | number | Date | null;
const text = (rows: readonly (readonly Cell[])[]) =>
  rows.map((row) =>
    row.map((value) =>
      value === null || value === "" ? null : value instanceof Date ? { value, type: Date, format: "yyyy-mm-dd" } : typeof value === "number" ? { value, type: Number } : { value, type: String },
    ),
  );

// 2025-2026: the current year, with the newest headers (an unnamed counter first).
const NEW_HEADER = [
  "",
  "First Name",
  "Last Name",
  "St. ID",
  "Personal Mail",
  "Polito Student Email",
  "Polito PhD email",
  "PRT email",
  "PRT Domain @politorocketteam.it",
  "Mobile number",
  "LinkedIn Username",
  "Discord Username",
  "Subteam(s)",
  "Division",
  "Group",
  "Team Title Official",
  "Program",
  "International / Domestic student",
  "Country of origin",
  "Level (Bachelor's or Master's). Careful with the spelling",
  "Programs",
  "Degree Level",
];

type NewRow = {
  first: string;
  last: string;
  id?: string;
  personal?: string;
  student?: string;
  prt?: string;
  mobile?: string;
  linkedin?: string;
  discord?: string;
  subteam?: string;
  division?: string;
  title?: string;
  program?: string;
};

const newRow = (n: number, r: NewRow): Cell[] => [
  n,
  r.first,
  r.last,
  r.id ?? null,
  r.personal ?? null,
  r.student ?? null,
  null,
  null,
  r.prt ?? null,
  r.mobile ?? null,
  r.linkedin ?? null,
  r.discord ?? null,
  r.subteam ?? null,
  r.division ?? null,
  null,
  r.title ?? null,
  r.program ?? null,
  "Domestic",
  "Italy",
  "Master's",
  null,
  null,
];

const CURRENT: NewRow[] = [
  { first: "Alice", last: "Marino", id: "s900001", personal: "alice.marino@example.com", prt: "alice.marino@team.example.com", mobile: "+39 000 0000001", linkedin: "alice-marino-example", discord: "alice#0001", subteam: "", title: "Team Leader", program: "Aerospace Engineering" },
  { first: "Bruno", last: "Conti", personal: "bruno.conti@example.com", subteam: "Propulsion", title: "Head of Propulsion", linkedin: "bruno-conti-example" },
  { first: "Carla", last: "Ferri", personal: "carla.ferri@example.com", subteam: "Propulsion", division: "Liquid Systems", title: "Liquid Systems Lead" },
  { first: "Dario", last: "Gallo", student: "dario.gallo@studenti.example.com", subteam: "Operations", division: "Information Technology", title: "IT Lead" },
  { first: "Elena", last: "Greco", personal: "elena.greco@example.com", subteam: "Propulsion", title: "Head of Propulsion" },
  { first: "Fabio", last: "Ricci", personal: "fabio.ricci@example.com", title: "Chief Engineer" },
  { first: "Giulia", last: "Russo", personal: "giulia.russo@example.com", subteam: "Structures", division: "Design & Manufacturing", title: "Structural Analyst" },
  { first: "Hugo", last: "Bianchi", personal: "hugo.bianchi@example.com", subteam: "Structures", title: "Vice Team Leader" },
  { first: "Irene", last: "Costa", personal: "irene.costa@example.com", subteam: "Propulsion", division: "Underwater Basket Weaving", title: "Engineer" },
  { first: "Luca", last: "Moretti", subteam: "Structures", division: "Design and Manufacturing", title: "Engineer" },
  { first: "Bruno", last: "Conti", personal: "bruno.conti@example.com", subteam: "Structures", title: "Engineer" },
  { first: "Marta", last: "Villa", personal: "marta.villa@example.com", subteam: "Operations", division: "Communications", title: "Video Editor", program: "Physics" },
  { first: "Nicola", last: "Fontana", personal: "nicola.fontana@example.com", subteam: "Propulsion", division: "Hybrid Motors", title: "Grain Engineer" },
  { first: "Paolo", last: "Lombardi", personal: "paolo.lombardi@example.com", subteam: "Propulsion", division: "Hybrid Motors", title: "Test Engineer" },
  { first: "Zeno", last: "Fabbri", personal: "zeno.fabbri@example.com", title: "President" },
  { first: "Wanda", last: "Riva", personal: "wanda.riva@example.com", subteam: "Operations", division: "Communications", title: "Writer" },
  { first: "Olga", last: "Serra", personal: "olga.serra@example.com", subteam: "Operations", division: "Communications", title: "Writer" },
  {
    first: "Rita",
    last: "Longo",
    personal: "rita.longo@example.com",
    subteam: "Structures (STR) - Cavour",
    division: "Design & Manufacturing - N/A",
    title: "Head of Department - Design and Manufacturing Division Lead Engineer (acting)",
  },
  { first: "Ettore", last: "Bassi", personal: "ettore.bassi@example.com", subteam: "Cavour", title: "Engineer" },
  { first: "Sofia", last: "Marchi", personal: "sofia.marchi@example.com", subteam: "SENIOR ADVISOR (Cavour)" },
  {
    first: "Pietro",
    last: "Rinaldi",
    personal: "pietro.rinaldi@example.com",
    subteam: "Operations (OPS), Avionics Legacy",
    division: "N/A",
    title: "Social Media Manager - Recruitment Coordinator",
  },
];

// 2024-2025: the 2023-2024 headers ("Subteam", "Team Role", "Gmail", "poli email", "linkedin").
const OLD_HEADER = ["Number", "First Name", "Last Name", "St. ID", "Gmail", "poli email", "linkedin", "Subteam", "Division", "Team Role", "program"];
type OldRow = { first: string; last: string; gmail?: string; poli?: string; subteam?: string; division?: string; title?: string };
const oldRow = (n: number, r: OldRow): Cell[] => [n, r.first, r.last, null, r.gmail ?? null, r.poli ?? null, null, r.subteam ?? null, r.division ?? null, r.title ?? null, null];

const PAST: OldRow[] = [
  { first: "Alice", last: "M. Marino", poli: "alice.marino@example.com", subteam: "Propulsion", division: "Liquid Systems", title: "Valve Engineer" },
  { first: "Sara", last: "Testa", poli: "sara.testa@studenti.example.com", subteam: "Propulsion", division: "Hybrid Motors", title: "Hybrid Motors Lead" },
  { first: "Tommaso", last: "Neri", gmail: "tommaso.neri@example.com", subteam: "Structures", title: "Head of Structures" },
  { first: "Valeria", last: "Pace", gmail: "valeria.pace@example.com", subteam: "Structures", title: "Head of Structures" },
  { first: "Nicola", last: "Fontana", gmail: "carla.ferri@example.com", subteam: "Propulsion", division: "Hybrid Motors", title: "Grain Engineer" },
  { first: "Paolo", last: "Lombardi", gmail: "paolo.lombardi@example.com", subteam: "Propulsion", division: "Hybrid Motors", title: "Test Engineer" },
];

// 2023-2024: the oldest shape, no division column, a stray summary cell beside the header.
const OLDEST_HEADER = ["Number", "First Name", "Last Name", "St. ID", "Gmail", "poli email", "linkedin", "Subteam", "", "Team Role", "program", "", "Total people: 2"];
const OLDEST: Cell[][] = [
  [1, "Sara", "Testa", null, null, "sara.testa@studenti.example.com", null, "Propulsion", null, "Grain Engineer", null],
  [2, "Paolo", "Lombardi", null, "paolo.lombardi@example.com", null, null, "Propulsion", null, "Test Engineer", null],
];
// "Roles 23-24": the 2023-2024 seats with the division that year's sheet lacks.
const ROLES = [
  ["First Name", "Last Name", "Subteam", "Division", "Group", "Team Role"],
  ["Sara", "Testa", "Propulsion", "Hybrid Motors", null, "Grain Engineer"],
  ["Paolo", "Lombardi", "Propulsion", "Hybrid Motors", null, "Test Engineer"],
  ["Nobody", "Known", "Propulsion", "Hybrid Motors", null, "Engineer"],
];

// Quitters: a title in row 1, an empty row 2, the header in row 3.
const QUITTERS: Cell[][] = [
  ["People who left the team"],
  [],
  ["Left the Team on:", "Joined the Team on:", "", "0 Number", "First Name", "Last Name", "St. ID", "Gmail", "Polito Student Email", "LinkendIn Username", "Subteam", "Division", "Team Role"],
  [new Date(Date.UTC(2025, 6, 15)), new Date(Date.UTC(2023, 9, 10)), null, 1, "Sara", "Testa", null, null, "sara.testa@studenti.example.com", null, "Propulsion", "Hybrid Motors", "Hybrid Motors Lead"],
  [new Date(Date.UTC(2026, 0, 20)), null, null, 2, "Giulia", "Russo", null, "giulia.russo@example.com", null, null, "Structures", null, "Structural Analyst"],
  [new Date(Date.UTC(2024, 2, 1)), null, null, 3, "Ugo", "Sala", null, "ugo.sala@example.com", null, null, "Structures", null, "Engineer"],
];

const STATS = [["Year", "People"], ["2025-2026", 16]];

const csv = (rows: readonly (readonly string[])[]) =>
  rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";

const FILES: Record<string, string[][]> = {
  "people_rows.csv": [
    ["id", "first_name", "last_name", "linkedin", "user", "has_pp"],
    ["11", "Marta", "Villa", "", "u-marta", "true"],
    ["12", "Bruno", "Conti", "https://www.linkedin.com/in/bruno-conti-example", "u-bruno", "true"],
    ["13", "Olga", "Serra", "", "", "true"],
    ["14", "Carla", "Ferri", "", "", "true"],
    ["30", "Dario", "Gallo", "", "", "true"],
    ["31", "Paolo", "Lombardi", "", "", "false"],
  ],
  "team_members_rows.csv": [
    ["first_name", "last_name", "team_role", "poli_email", "status", "start_date", "end_date", "subteam", "linkedin", "program", "level", "origin", "division", "id"],
    ["Marta", "Villa", "Video Editor", "marta.villa@studenti.example.com", "active", "2024-10-01", "", "Operations", "marta-villa-example", "Mathematics", "Bachelor's", "Domestic", "Communications", "tm-1"],
    ["Dario", "Gallo", "IT Lead", "dario.gallo@studenti.example.com", "active", "2024-10-01", "", "Operations", "", "Computer Engineering", "", "", "Information Technology", "tm-2"],
  ],
  "subteams_rows.csv": [
    ["id", "name", "end", "code", "title_name", "chief", "coordinator1", "coordinator2", "project_manager", "coordinator3"],
    ["st-1", "Propulsion", "", "PRP", "Head of Propulsion", "", "", "", "", ""],
    ["st-2", "Structures", "", "STR", "Head of Structures", "", "", "", "", ""],
  ],
  "divisions_rows.csv": [
    ["id", "subteam", "name", "code", "end", "lead", "lead_acting"],
    ["d-1", "st-1", "Liquid Systems", "LQS", "", "", ""],
    ["d-2", "st-3", "Information Technology", "IT", "", "", ""],
    ["d-9", "st-9", "Avionics Legacy", "AVL", "2022-09-30", "", ""],
  ],
  "advisors_rows.csv": [
    ["id", "first_name", "last_name", "title_name", "linkedin", "has_pp"],
    ["21", "Prof. Ada", "Example", "Faculty Advisor", "ada-example", "true"],
    ["30", "Sam", "Specialist", "Safety Specialist", "", "false"],
    ["31", "Sam", "Specialist", "Safety Specialist", "", "false"],
    ["32", "No", "Title", "", "", "true"],
  ],
  "positions_rows.csv": [
    ["id", "division", "number", "name", "description", "desirable", "required", "form", "open"],
    ["pos-1", "d-1", "2", "Feed Systems Engineer", "Design the feed system.\nWork with the test bench.", '["CAD","Python"]', '{"Fluid dynamics","Teamwork"}', "", "true"],
    ["pos-2", "d-9", "1", "Avionics Engineer", "An old division.", "", "", "", "false"],
    ["pos-3", "Information Technology", "1", "Web Developer", "Build the site.", "", "TypeScript\nSQL", "", "true"],
  ],
  "orders_rows.csv": [
    ["requester", "description", "quantity", "price", "status", "reason", "createdAt", "name", "quoteName", "id"],
    ["tm-2", "Two routers", "2", "120.50", "accepted", "Lab network", "2025-11-03T10:00:00Z", "Router", "", "o-1"],
    ["zz-unknown", "Bolts", "100", "5", "pending", "", "2025-11-04T10:00:00Z", "Bolts", "", "o-2"],
    ["tm-2", "Cables", "3", "9", "shipped", "", "2025-11-05T10:00:00Z", "Cables", "", "o-3"],
  ],
  "faqs_rows.csv": [
    ["id", "question", "answer", "visible"],
    ["f-1", "Can I join while on exchange?", "Yes, if you can work remotely.\n\nTell us in your application.", "true"],
    ["f-2", "An old hidden question?", "Hidden.", "false"],
    ["f-3", `${"A question far too long for the panel ".repeat(4)}?`, "Too long.", "true"],
  ],
};

// The reading rules of issue #816 -------------------------------------------------

const RULES_CURRENT: NewRow[] = [
  { first: "Anna", last: "Bello", personal: "anna.bello@example.com", subteam: "AMV", title: "AMV Chief Engineer" },
  { first: "Bianca", last: "Corsi", personal: "bianca.corsi@example.com", subteam: "Operations (OPS)", division: "Logistics (LGS)", title: "Safety Officer" },
  { first: "Carlo", last: "Dini", personal: "carlo.dini@example.com", title: "Project Manager" },
  { first: "Davide", last: "Elia", personal: "davide.elia@example.com", title: "Project Manager" },
  {
    first: "Emma",
    last: "Fermi",
    personal: "emma.fermi@example.com",
    subteam: "Amerigo Vespucci (AMV) - Propulsion (PRP) - Operations (OPS)",
    division: "Hybrid Motors (HYB) / Information Technology (IT), Logistics (LGS)",
    title: "Engineer",
  },
  { first: "Franco", last: "Gatti", personal: "franco.gatti@example.com", subteam: "Propulsion - Electronics", division: "Hybrid Motors", title: "Engineer" },
  { first: "Rosa", last: "Sarti", personal: "rosa.sarti@example.com", subteam: "Avionics (AVI)", division: "Flight Software (FSW)", title: "Engineer" },
  // A template row: no name, only email placeholders, one of them Anna's.
  { first: "", last: "", personal: "anna.bello@example.com", student: "name.surname@studenti.example.com" },
  // Rows 10 and 11: the head seat of Avionics, a department this run creates, handed from row 10 to row 11.
  { first: "Yara", last: "Gori", personal: "yara.gori@example.com", subteam: "Avionics (AVI)", title: "Head of Department" },
  { first: "Leo", last: "Pini", personal: "leo.pini@example.com", subteam: "Avionics (AVI)", title: "Head of Department" },
];

const RULES_2024: OldRow[] = [
  {
    first: "Gina",
    last: "Hale",
    gmail: "gina.hale@example.com",
    division: "Electronics (ELT) Department - Hardware (HDW)",
    title: "Electronics Head of Department - Hardware Lead Engineer",
  },
  { first: "Franco", last: "Gatti", gmail: "franco.gatti@example.com", subteam: "Cavour", title: "Engineer" },
  { first: "Ivo", last: "Jori", gmail: "ivo.jori@example.com", subteam: "Propulsion", division: "Solid Motors (SLM)", title: "Engineer" },
  { first: "Quinto", last: "Rossi", gmail: "quinto.rossi@example.com", title: "Engineer" },
];

// 2022-2023: its Division column is headed "A", and a "Date of joining" column gives the day each role started.
const HEADER_2022 = ["Number", "First Name", "Last Name", "St. ID", "Gmail", "poli email", "linkedin", "Subteam", "A", "Team Role", "Date of joining", "program"];
const RULES_2022: Cell[][] = [
  [1, "Lia", "Kent", null, "lia.kent@example.com", null, null, "Cavour", null, "President-Advisor (Project Cavour)", null, null],
  [2, "Mario", "Lodi", null, "mario.lodi@example.com", null, null, "Liquid Propulsion", "Injectors (INJ)", "Engineer", new Date(Date.UTC(2022, 10, 15)), null],
  [3, "Nora", "Monti", null, "nora.monti@example.com", null, null, "Vittorio Emanuele II (VES) - Management", null, "Engineer", "1/12/2022", null],
  [4, "Ivo", "Jori", null, "ivo.jori@example.com", null, null, "Propulsion", "Solid Motors", "Engineer", "after the exams", null],
];

const RULES_2021: OldRow[] = [
  { first: "Oscar", last: "Neri", gmail: "oscar.neri@example.com", subteam: "Efesto", title: "President & Chief Engineer" },
  { first: "Mario", last: "Lodi", gmail: "mario.lodi@example.com", subteam: "Liquid Propulsion", title: "Engineer" },
  { first: "Pia", last: "Orsi", gmail: "pia.orsi@example.com", subteam: "Efesto", title: "Engineer" },
];

const ROLES_HEADER = ["First Name", "Last Name", "Subteam", "Division", "Group", "Team Role"];

// Quitters, its rows 2 to 9: the header in row 1. Dates come as date cells and as text in each listed format.
const RULES_QUITTERS: Cell[][] = [
  ["Left the Team on:", "Joined the Team on:", "First Name", "Last Name", "Gmail", "Subteam", "Division", "Team Role"],
  [new Date(Date.UTC(2022, 5, 30)), null, "Pia", "Orsi", "pia.orsi@example.com", "Efesto", null, "Engineer"],
  [new Date(Date.UTC(2023, 1, 15)), "10/11/2021", "Sergio", "Tosi", "sergio.tosi@example.com", "Efesto", null, "Engineer"],
  ["5/3/2024", null, "Teresa", "Ugolini", "teresa.ugolini@example.com", "Propulsion (PRP)", "Hybrid Motors", "Engineer"],
  ["30.06.2022", new Date(Date.UTC(2020, 9, 15)), "Ugo", "Valli", "ugo.valli@example.com", "Liquid Propulsion", null, "Engineer"],
  [null, null, "Vera", "Zanni", "vera.zanni@example.com", "Management", null, "Engineer"],
  [null, null, "Walter", "Bassi", "walter.bassi@example.com", "Management", null, "Engineer"],
  ["sometime in 2023", null, "Xenia", "Conti", "xenia.conti@example.com", "Management", null, "Engineer"],
  [new Date(Date.UTC(2023, 4, 1)), null, null, null, "pia.orsi@example.com", "Efesto", null, "Engineer"],
];

const RULES_FILES: Record<string, string[][]> = {
  "overrides.csv": [
    ["kind", "sheet", "row", "value"],
    ["handover", "2025-2026", "4", "5"],
    ["handover", "2024-2025", "2", "3"],
    ["quitter-year", "Quitters", "6", "2022-2023"],
    ["quitter-year", "Quitters", "2", "2022-2023"],
    ["swap", "2025-2026", "1", "2"],
    ["handover", "2025-2026", "10", "11"],
  ],
};

async function writeRules() {
  mkdirSync(RULES_OUT, { recursive: true });
  const sheets = [
    { sheet: "2025-2026", data: text([NEW_HEADER, ...RULES_CURRENT.map((r, i) => newRow(i + 1, r))]) },
    { sheet: "2024-2025", data: text([OLD_HEADER, ...RULES_2024.map((r, i) => oldRow(i + 1, r))]) },
    { sheet: "2022-2023", data: text([HEADER_2022, ...RULES_2022]) },
    { sheet: "2021-2022", data: text([OLD_HEADER, ...RULES_2021.map((r, i) => oldRow(i + 1, r))]) },
    { sheet: "Quitters", data: text(RULES_QUITTERS) },
    // Not read (owner decision): were it read, Lia's empty Division cell would take "Hydraulics" and the unknown row would raise roles-sheet-unmatched.
    {
      sheet: "Roles 22-23",
      data: text([ROLES_HEADER, ["Lia", "Kent", "Cavour", "Hydraulics (HYD)", null, "President-Advisor (Project Cavour)"], ["Nobody", "Known", "Management", null, null, "Engineer"]]),
    },
    { sheet: "Roles 24-25", data: text([ROLES_HEADER, ["Quinto", "Rossi", "Efesto", null, null, "Engineer"]]) },
  ];
  writeFileSync(join(RULES_OUT, "roster.xlsx"), await writeXlsxFile(sheets as never).toBuffer());
  for (const [name, rows] of Object.entries(RULES_FILES)) writeFileSync(join(RULES_OUT, name), csv(rows));
}

// The positions-only run of issue #834 -------------------------------------------

const POSITIONS_FILES: Record<string, string[][]> = {
  "positions_rows.csv": [
    ["id", "division", "number", "name", "description", "desirable", "required", "form", "open"],
    ["p-1", "d-1", "2", "Feed Systems Engineer", "Design the feed system.", '["CAD","Python"]', '{"Fluid dynamics",Teamwork}', "fake-form-1", "true"],
    ["p-2", "d-2", "1", "Test Bench Operator", "", "", "", "", "false"],
    ["p-3", "d-3", "1", "Web Developer", "Build the site.", "", "", "fake-form-3", "true"],
    ["p-4", "d-3", "1", " web  developer ", "Build it again.", "", "", "", "true"],
    ["p-5", "d-1", "1", "Web Developer", "Build the bench software.", "", "", "", "true"],
    ["p-6", "d-4", "1", "Safety Officer", "", "", "", "", "true"],
    ["p-7", "d-5", "1", "Flight Software Engineer", "", "", "", "", "true"],
    ["p-8", "d-6", "1", "Bay Technician", "", "", "", "", "true"],
    ["p-9", "d-7", "1", "Test Position", "", "", "", "", "true"],
    ["p-10", "st-4", "1", "Recovery Engineer", "Pack the parachutes.", "", "", "", "false"],
    ["p-11", "d-404", "1", "Ghost Position", "", "", "", "", "true"],
    ["p-12", "d-1", "1", "", "A row with no title.", "", "", "", "true"],
    ["p-13", "d-8", "1", "Mission Analyst", "Plan the flight.\nCheck the margins.", "", "- Orbital mechanics\n- MATLAB", "", "true"],
  ],
  "divisions_rows.csv": [
    ["id", "subteam", "name", "code", "end", "lead", "lead_acting"],
    ["d-1", "st-1", "Liquid Propulsion Systems", "LQS", "", "", ""],
    ["d-2", "st-1", "Ground System", "", "", "", ""],
    ["d-3", "st-2", "IT & Communication", "ITC", "", "", ""],
    ["d-4", "st-2", "Safety", "", "", "", ""],
    ["d-5", "st-3", "Flight Software", "FSW", "", "", ""],
    ["d-6", "st-3", "Avionics Bay", "AVB", "", "", ""],
    ["d-7", "st-9", "test-division-website", "TDW", "", "", ""],
    ["d-8", "st-3", "Mission Analysis", "MSA", "2024-09-30", "", ""],
  ],
  "subteams_rows.csv": [
    ["id", "name", "end", "code", "title_name", "chief", "coordinator1", "coordinator2", "project_manager", "coordinator3"],
    ["st-1", "Propulsion", "", "PRP", "", "", "", "", "", ""],
    ["st-2", "Operations", "", "OPS", "", "", "", "", "", ""],
    ["st-3", "Avionics", "", "AVI", "", "", "", "", "", ""],
    ["st-4", "Recovery", "", "RCV", "", "", "", "", "", ""],
  ],
  // Not read by the positions-only run: were they read, a person and an FAQ would be inserted.
  "people_rows.csv": [
    ["id", "first_name", "last_name", "linkedin", "user", "has_pp"],
    ["1", "Pino", "Example", "", "", "false"],
  ],
  "faqs_rows.csv": [
    ["id", "question", "answer", "visible"],
    ["f-1", "Is this read by the positions run?", "No.", "true"],
  ],
};

function writePositions() {
  mkdirSync(POSITIONS_OUT, { recursive: true });
  for (const [name, rows] of Object.entries(POSITIONS_FILES)) writeFileSync(join(POSITIONS_OUT, name), csv(rows));
}

async function main() {
  writePositions();
  await writeRules();
  mkdirSync(OUT, { recursive: true });
  const sheets = [
    { sheet: "2025-2026", data: text([NEW_HEADER, ...CURRENT.map((r, i) => newRow(i + 1, r))]) },
    { sheet: "2024-2025", data: text([OLD_HEADER, ...PAST.map((r, i) => oldRow(i + 1, r))]) },
    { sheet: "2023-2024", data: text([OLDEST_HEADER, ...OLDEST]) },
    { sheet: "Quitters", data: text(QUITTERS) },
    { sheet: "Roles 23-24", data: text(ROLES as Cell[][]) },
    { sheet: "Stats", data: text(STATS) },
  ];
  const buffer = await writeXlsxFile(sheets as never).toBuffer();
  writeFileSync(join(OUT, "roster.xlsx"), buffer);
  for (const [name, rows] of Object.entries(FILES)) writeFileSync(join(OUT, name), csv(rows));
  mkdirSync(join(OUT, "photos"), { recursive: true });
  for (const [name, [width, height, r]] of Object.entries(PHOTOS)) {
    const jpeg = await sharp({ create: { width, height, channels: 3, background: { r, g: 120, b: 90 } } }).jpeg({ quality: 80 }).toBuffer();
    writeFileSync(join(OUT, "photos", name), jpeg);
  }
}

// photos/: name → [width, height, a red level], so each file differs.
const PHOTOS: Record<string, [number, number, number]> = {
  "11-villa.jpeg": [40, 24, 200],
  "12-rossi.jpeg": [16, 16, 180],
  "13-serra.jpeg": [16, 16, 160],
  "30-gallo.jpeg": [24, 32, 120],
  "31-neri.jpeg": [16, 16, 100],
  "99-mancini.jpeg": [16, 16, 80],
  "example.jpeg": [20, 20, 140],
  "marchi.jpeg": [18, 18, 40],
  "villa.jpeg": [16, 16, 60],
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
