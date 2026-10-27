import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
//   who imports as an active member). Ugo Sala: on Quitters only.
// - One conflict of each kind: Bruno Conti twice in 2025-2026 (duplicate);
//   Luca Moretti with no email; Irene Costa in an unknown division; Hugo
//   Bianchi with an unknown title; Elena Greco a second head of Propulsion;
//   Zeno Fabbri a second team leader; Fabio Ricci the chief engineer the test
//   database already seats; Marta Villa whose CSV program disagrees; Paolo
//   Lombardi who matches an imported Alumni entry the test lays; Nicola
//   Fontana's 2024 row carrying Carla Ferri's email (two people); Wanda Riva,
//   whose email an existing account without a member row holds; and CSV rows
//   that do not fit the schema.

const OUT = join(__dirname, "files");

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
    ["p-1", "Marta", "Villa", "", "u-marta", "false"],
    ["p-2", "Bruno", "Conti", "https://www.linkedin.com/in/bruno-conti-example", "u-bruno", "true"],
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
    ["a-1", "Prof. Ada", "Example", "Faculty Advisor", "ada-example", "false"],
    ["a-2", "Sam", "Specialist", "Safety Specialist", "", "false"],
    ["a-3", "Sam", "Specialist", "Safety Specialist", "", "false"],
    ["a-4", "No", "Title", "", "", "false"],
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

async function main() {
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
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
