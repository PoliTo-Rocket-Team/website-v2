// The role type a Quitters row's title gives (issue #913). The repair stores
// the title as the workbook writes it, as one role per unit; its `type` comes
// from the import's title table (scripts/import/titles.ts, issues #677, #816,
// #822), trimmed to the type each seat reads as. A cell may hold several seats
// (" - " parts them, and " & " where the table reads every part); the role
// takes the highest-ranked seat's type. A seat with a seat word no rule reads
// ("Vice Team Leader") gives no type, so the role is stored with none, which
// the Alumni page shows as a member. No role the repair adds holds full access:
// every one has ended.

export type PositionType = "president" | "head" | "lead" | "core" | "advisor";

type Rule = { readonly pattern: RegExp; readonly type: PositionType; readonly board: boolean };

/** The table, first match wins. Patterns run on the seat in lower case with single spaces and no parenthesized notes. */
const RULES: readonly Rule[] = [
  { pattern: /^(team leader|team lead|president)$/, type: "president", board: true },
  { pattern: /^chief engineer$/, type: "core", board: true },
  { pattern: /^project manager$/, type: "core", board: true },
  { pattern: /^(chief operating officer|head of operations|operations head|operations department head)$/, type: "head", board: false },
  { pattern: /^(it|information technology)( division)? lead( engineer)?$/, type: "lead", board: false },
  { pattern: /^chief technologist$/, type: "core", board: true },
  { pattern: /^(head of .+|.+ head|head|department head|.+ head of department)$/, type: "head", board: false },
  { pattern: /^(.+ )?lead( engineer)?$/, type: "lead", board: false },
  { pattern: /^(.+ )?coordinator$/, type: "core", board: false },
  { pattern: /^.+ manager$/, type: "core", board: false },
  { pattern: /^(.+ )?advisor$/, type: "advisor", board: false },
  { pattern: /^safety officer$/, type: "core", board: false },
];

/** Words that name a seat: a seat holding one that no rule reads gives no type. */
const SEAT_WORDS = /\b(head|lead|leader|chief|manager|president|director|vice|deputy|coordinator|captain|co-?lead|officer)\b/;

/** The rank of each type, highest first. */
const RANK: readonly PositionType[] = ["president", "head", "lead", "core", "advisor"];

const spaced = (text: string) => text.replace(/\s+/g, " ").trim();

/** A seat as the rules read it: no "AMV " lead, no trailing notes, lower case. */
function seatKey(text: string): string {
  let bare = spaced(text).replace(/^amv\s+/i, "");
  for (let m = /\s*\(([^()]*)\)\s*$/.exec(bare); m !== null; m = /\s*\(([^()]*)\)\s*$/.exec(bare)) bare = bare.slice(0, m.index);
  return spaced(bare).normalize("NFKC").toLowerCase();
}

/** What one seat reads as: a rule's type and place, a core member's seat, or nothing (a seat word no rule reads). */
function readSeat(text: string): Rule | "core" | null {
  const key = seatKey(text);
  const rule = key === "" ? undefined : RULES.find((r) => r.pattern.test(key));
  if (rule !== undefined) return rule;
  return SEAT_WORDS.test(key) ? null : "core";
}

/** The seats of a title cell: " - " parts, each split on " & " when every part is a seat a rule reads. */
function seatsOf(cell: string): string[] {
  return cell
    .split(/\s+[-–]\s+/)
    .map(spaced)
    .filter((s) => s !== "")
    .flatMap((part) => {
      if (/^president-advisor\b/i.test(seatKey(part))) return ["President", "Advisor"];
      const pieces = part.split(/\s*&\s*/).filter((p) => p !== "");
      const ruled = (p: string) => {
        const seat = readSeat(p);
        return seat !== null && seat !== "core";
      };
      return pieces.length > 1 && pieces.every(ruled) ? pieces : [part];
    });
}

/** What a title cell gives a role: its stored title, its type, and whether every seat sits on the board (in no unit). */
export type TitleReading = { readonly title: string; readonly type: PositionType | null; readonly board: boolean };

/** Reads a title cell. An "ADVISOR" marker in the unit cells makes a plain member's seat an advisor's. An empty cell is a member's, titled "Member". */
export function readTitle(cell: string, advisorMarker: boolean): TitleReading {
  const title = spaced(cell);
  const seats = seatsOf(title).map(readSeat);
  const read = seats.filter((s): s is Rule | "core" => s !== null);
  const types = read.map((s) => (s === "core" ? "core" : s.type));
  const best = RANK.find((t) => types.includes(t)) ?? null;
  const type = best === "core" && advisorMarker ? "advisor" : best;
  const board = read.length > 0 && read.every((s) => s !== "core" && s.board);
  return { title: title === "" ? "Member" : title, type: seats.length === 0 ? (advisorMarker ? "advisor" : "core") : type, board };
}
