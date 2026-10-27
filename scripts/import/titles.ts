// What a roster title makes of a role row (issue #677): its `type`, its
// `full_access` seat and the unit it sits on. The table is explicit and read
// top down; the first rule whose pattern matches the whole title wins. A title
// with a seat word in it ("head", "lead", "chief", ...) that no rule reads is
// an unknown title: the import refuses to guess a seat, since a wrong one
// gives or withholds dashboard access. Any other title is a core member's.

export type PositionType = "president" | "head" | "lead" | "core" | "advisor";
export type FullAccessSeat = "operations_lead" | "it_lead" | "project_manager" | "chief_engineer";

/** Where the seat sits: on no unit (the board), the department the subteam names, or the division the row names. */
export type SeatUnit = "board" | "department" | "division" | "member-unit";

/** What a title reads as. `member-unit` is a core member's or an advisor's place: their division, else their subteam's department. */
export type Seat = { readonly type: PositionType; readonly fullAccess: FullAccessSeat | null; readonly unit: SeatUnit };

type Rule = { readonly pattern: RegExp; readonly seat: Seat };

/** The table, first match wins. Patterns run on the title in lower case with single spaces. */
export const TITLE_RULES: readonly Rule[] = [
  { pattern: /^(team leader|team lead|president)$/, seat: { type: "president", fullAccess: null, unit: "board" } },
  { pattern: /^chief engineer$/, seat: { type: "core", fullAccess: "chief_engineer", unit: "board" } },
  { pattern: /^project manager$/, seat: { type: "core", fullAccess: "project_manager", unit: "board" } },
  { pattern: /^(head of operations|operations head|operations department head)$/, seat: { type: "head", fullAccess: "operations_lead", unit: "department" } },
  { pattern: /^(it lead|it division lead|information technology lead|information technology division lead)$/, seat: { type: "lead", fullAccess: "it_lead", unit: "division" } },
  { pattern: /^(head of .+|.+ head|head|department head)$/, seat: { type: "head", fullAccess: null, unit: "department" } },
  { pattern: /^(.+ lead|lead|division lead)$/, seat: { type: "lead", fullAccess: null, unit: "division" } },
  { pattern: /^(.+ )?advisor$/, seat: { type: "advisor", fullAccess: null, unit: "member-unit" } },
];

/** Words that name a seat: a title holding one that no rule reads is unknown. */
const SEAT_WORDS = /\b(head|lead|leader|chief|manager|president|director|vice|deputy|coordinator|captain|co-?lead)\b/;

const CORE: Seat = { type: "core", fullAccess: null, unit: "member-unit" };

/** The title as the rules read it. */
export function titleKey(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The seat a title gives, or null for an unknown title. An empty title is a core member's. */
export function seatOf(title: string): Seat | null {
  const key = titleKey(title);
  if (key === "") return CORE;
  const rule = TITLE_RULES.find((r) => r.pattern.test(key));
  if (rule !== undefined) return rule.seat;
  return SEAT_WORDS.test(key) ? null : CORE;
}

/** The title a role row stores: the roster's, or "Member" when it gives none. */
export function storedTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim() || "Member";
}
