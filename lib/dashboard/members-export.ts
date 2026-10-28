import writeXlsxFile from "write-excel-file/node";
import { memberDetailText, type MemberDetailKey } from "./details";
import { opensWholeTeam } from "./members-view";
import type { TeamMember } from "./team-members";
import type { ViewerStanding } from "./viewer";

// The Members page's "Export to Excel" (Owner decision, 2026-10-22, issue
// #539): one .xlsx with every member of the team and every field the member
// panel shows (boards 59b, 61f), private ones included. It is built on the
// server from the whole-team directory, never from the rows the page holds,
// so the page's search, filters and pages never narrow it. Only full access
// may run it.

/**
 * Who may export: full access, the viewers whose Members page is the whole
 * team (every full-access seat, and full access from a scope row). Everyone
 * else is refused, on the page and on the server alike.
 */
export function mayExportMembers(viewer: ViewerStanding): boolean {
  return opensWholeTeam(viewer);
}

/** One column of the file: its header and what a member holds in it, "" for nothing. */
type ExportColumn = { readonly header: string; readonly value: (person: TeamMember) => string };

const detail = (key: MemberDetailKey) => (person: TeamMember) => memberDetailText(person.details, key) ?? "";

/** "Aerodynamics · Mission Analysis (MA): Division Lead", one per division, as the panel's Divisions list reads. */
function divisionsText(person: TeamMember): string {
  return person.divisions
    .map((d) => {
      const name = `${d.department === "" ? "" : `${d.department} · `}${d.name}${d.code === null ? "" : ` (${d.code})`}`;
      return `${name}: ${d.role === "lead" ? "Division Lead" : (d.title ?? "Member")}`;
    })
    .join("; ");
}

/**
 * Every field the member panel can show, in its order: who they are, their
 * divisions, Contact, Studies, Personal and NDA. Dates are written as
 * YYYY-MM-DD so a spreadsheet sorts them.
 */
export const MEMBERS_EXPORT_COLUMNS: readonly ExportColumn[] = [
  { header: "Name", value: (p) => p.name },
  { header: "Role", value: (p) => p.roleLabel },
  // The table's Department cell (issue #767); a head's Divisions cell stays empty, as heading adds no division.
  { header: "Department", value: (p) => p.departments.join("; ") },
  { header: "Divisions", value: divisionsText },
  { header: "Member since", value: (p) => String(p.since) },
  // The member's team address, their email alias once one is created (issue #563).
  { header: "PRT email", value: detail("prtEmail") },
  { header: "Personal email", value: (p) => p.signInEmail },
  { header: "Phone", value: detail("phone") },
  { header: "Discord", value: detail("discord") },
  { header: "LinkedIn", value: detail("linkedin") },
  { header: "PoliTo ID", value: detail("politoId") },
  { header: "Program", value: detail("programme") },
  { header: "Level", value: detail("level") },
  { header: "From", value: detail("country") },
  { header: "Date of birth", value: (p) => p.details.birthDate },
  { header: "Gender", value: detail("gender") },
  { header: "NDA", value: (p) => (p.nda === null ? "Not signed" : "Signed") },
  { header: "NDA signed on", value: (p) => p.nda?.signedOn ?? "" },
  { header: "NDA confirmed by", value: (p) => p.nda?.confirmedBy ?? "" },
];

/** The sheet: the header row, then one row per member in the order given (heads and leads first). */
export function membersExportRows(people: readonly TeamMember[]): string[][] {
  return [MEMBERS_EXPORT_COLUMNS.map((c) => c.header), ...people.map((p) => MEMBERS_EXPORT_COLUMNS.map((c) => c.value(p)))];
}

/** The team's own calendar day, so a file made after midnight in Turin carries that day. */
const teamDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

/** "prt-members-2026-10-22.xlsx": the export date, in the team's time zone. */
export function membersExportFileName(at: Date): string {
  return `prt-members-${teamDay.format(at)}.xlsx`;
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The .xlsx file: one plain sheet, "Members", every cell text. */
export async function membersWorkbook(people: readonly TeamMember[]): Promise<Buffer> {
  return writeXlsxFile(membersExportRows(people), { sheet: "Members" }).toBuffer();
}
