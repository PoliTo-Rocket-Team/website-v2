// What a roster title cell makes of role rows (issues #677, #816). A cell may
// hold several seats separated by " - " ("Head of Department - Avionics
// Lead"): each seat is read on its own and gives its own role. " & " parts
// seats too ("President & Chief Engineer"), but only where every part is a
// seat a rule of the table reads, so "Design & Manufacturing Lead" stays one
// seat. A seat may end in parenthesized notes: "(acting)" marks an acting
// holder, any other note names a project ("Chief Engineer (Cavour)"). Neither
// changes the seat: an acting holder takes the seat, its type and its full
// access, and the schema has no project on `roles`, so both stay only in the
// stored title text. A leading "AMV " is removed before the rules run: it
// carries no meaning ("AMV Chief Engineer" is the Chief Engineer).
//
// The table is explicit and read top down; the first rule whose pattern
// matches the seat (notes removed) wins. A seat with a seat word in it
// ("head", "lead", "chief", ...) that no rule reads is an unknown title: the
// import refuses to guess a seat, since a wrong one gives or withholds
// dashboard access. Any other seat is a core member's. A few titles name two
// seats in one word ("President-Advisor"); COMPOUND_TITLES lists them.
//
// A seat whose row names no unit of its level may still have a place (issue
// #822): the Chief Operating Officer heads Operations, a lead seat sits in the
// division its title names, and a bare "Lead" is a member of the row's
// department. A rule says so in its seat's `fallback`; the plan finds the unit.
//
// A "Head of <X>" or "<X> Head" seat whose X names a division and no
// department is that division's lead seat (owner decision, issue #824): "Head
// of Safety" leads the Safety division. Whether X names one is a fact about the
// units, so the reading carries X (`headed`) and the plan decides.

export type PositionType = "president" | "head" | "lead" | "core" | "advisor";
export type FullAccessSeat = "operations_lead" | "it_lead" | "project_manager" | "chief_engineer";

/**
 * Where the seat sits: on no unit (the board), the department the subteam
 * names, the division the row names, the member's own unit, or the department
 * the seat's parenthesized note names ("Advisor (Project Cavour)").
 */
export type SeatUnit = "board" | "department" | "division" | "member-unit" | "noted-department";

/**
 * Where a seat sits when its row names no unit of the seat's level (issue
 * #822). `department`: a department seat goes to the department the rule
 * names, found by its name or its code (the Chief Operating Officer's
 * Operations). `member`: a division seat on a row that names a department and
 * no division is a core member's seat in that department (a bare "Lead").
 */
export type Fallback = { readonly kind: "department"; readonly name: string; readonly code: string } | { readonly kind: "member" };

/** What a seat reads as. `member-unit` is a core member's or an advisor's place: their division, else their subteam's department. */
export type Seat = { readonly type: PositionType; readonly fullAccess: FullAccessSeat | null; readonly unit: SeatUnit; readonly fallback?: Fallback };

type Rule = { readonly form: string; readonly pattern: RegExp; readonly seat: Seat };

const CORE: Seat = { type: "core", fullAccess: null, unit: "member-unit" };

/** The table, first match wins. Patterns run on the seat in lower case with single spaces and no parenthesized notes. */
export const TITLE_RULES: readonly Rule[] = [
  { form: "Team Leader, Team Lead, President", pattern: /^(team leader|team lead|president)$/, seat: { type: "president", fullAccess: null, unit: "board" } },
  { form: "Chief Engineer", pattern: /^chief engineer$/, seat: { type: "core", fullAccess: "chief_engineer", unit: "board" } },
  { form: "Project Manager", pattern: /^project manager$/, seat: { type: "core", fullAccess: "project_manager", unit: "board" } },
  {
    form: "Chief Operating Officer, Head of Operations",
    pattern: /^(chief operating officer|head of operations|operations head|operations department head)$/,
    // Owner decision (issue #822): the Chief Operating Officer heads the Operations department, whatever the row's unit cells say.
    seat: { type: "head", fullAccess: "operations_lead", unit: "department", fallback: { kind: "department", name: "Operations", code: "OPS" } },
  },
  {
    form: "IT Lead, IT Lead Engineer, IT Division Lead",
    pattern: /^(it|information technology)( division)? lead( engineer)?$/,
    seat: { type: "lead", fullAccess: "it_lead", unit: "division" },
  },
  { form: "Chief Technologist", pattern: /^chief technologist$/, seat: { type: "core", fullAccess: null, unit: "board" } },
  {
    form: "Head of <unit>, <unit> Head, Head of Department, <unit> Head of Department",
    pattern: /^(head of .+|.+ head|head|department head|.+ head of department)$/,
    seat: { type: "head", fullAccess: null, unit: "department" },
  },
  {
    form: "Lead, Lead Engineer",
    pattern: /^lead( engineer)?$/,
    seat: { type: "lead", fullAccess: null, unit: "division", fallback: { kind: "member" } },
  },
  {
    form: "<unit> Lead, <unit> Lead Engineer, <unit> Division Lead Engineer",
    pattern: /^(.+ )?lead( engineer)?$/,
    seat: { type: "lead", fullAccess: null, unit: "division" },
  },
  { form: "<area> Coordinator", pattern: /^(.+ )?coordinator$/, seat: CORE },
  { form: "<area> Manager", pattern: /^.+ manager$/, seat: CORE },
  { form: "<kind> Advisor", pattern: /^(.+ )?advisor$/, seat: { type: "advisor", fullAccess: null, unit: "member-unit" } },
  { form: "Safety Officer", pattern: /^safety officer$/, seat: CORE },
];

/** A title that names two seats in one word. Its notes go to the last part; a part may sit somewhere its rule does not say. */
type Compound = { readonly form: string; readonly pattern: RegExp; readonly parts: readonly { readonly text: string; readonly unit?: SeatUnit }[] };

/** The compound titles, read before the table. */
export const COMPOUND_TITLES: readonly Compound[] = [
  {
    // The president seat, and an advisor placed in the department the note names ("President-Advisor (Project Cavour)").
    form: "President-Advisor",
    pattern: /^president-advisor$/,
    parts: [{ text: "President" }, { text: "Advisor", unit: "noted-department" }],
  },
];

/** Words that name a seat: a seat holding one that no rule reads is unknown. */
const SEAT_WORDS = /\b(head|lead|leader|chief|manager|president|director|vice|deputy|coordinator|captain|co-?lead|officer)\b/;

/** One seat of a title cell. */
export type SeatReading =
  | {
      readonly kind: "seat";
      readonly seat: Seat;
      /** The title the role row stores: the seat's own text, notes included. */
      readonly title: string;
      readonly acting: boolean;
      /** The project a parenthesized note names; the schema has no project on `roles`, so it lives in the title only. */
      readonly project: string | null;
      /** The division a division seat's title names (issue #822): "Firmware" for "Firmware Lead Engineer". Null for a bare "Lead" and for any other seat. */
      readonly division: string | null;
      /** The unit a "Head of <X>" or "<X> Head" seat's title names (issue #824): "Safety" for "Head of Safety". Null for "Head of Department" and for any other seat. */
      readonly headed: string | null;
    }
  | { readonly kind: "unknown"; readonly title: string };

/** The seat as the rules read it. */
export function titleKey(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

const spaced = (text: string) => text.replace(/\s+/g, " ").trim();

/** Splits a title cell into its seats: " - " (or a spaced en dash) parts them; a hyphen inside a word does not. */
export function seatTexts(cell: string): string[] {
  return cell
    .split(/\s+[-–]\s+/)
    .map(spaced)
    .filter((s) => s !== "");
}

/** One seat's text without its trailing parenthesized notes, and the notes. */
function notesOf(text: string): { bare: string; acting: boolean; project: string | null } {
  let bare = text;
  let acting = false;
  let project: string | null = null;
  for (let m = /\s*\(([^()]*)\)\s*$/.exec(bare); m !== null; m = /\s*\(([^()]*)\)\s*$/.exec(bare)) {
    const note = spaced(m[1]);
    if (/^acting$/i.test(note)) acting = true;
    else if (note !== "") project = note;
    bare = bare.slice(0, m.index);
  }
  return { bare: spaced(bare), acting, project };
}

/** A seat text without the "AMV " that may lead it. */
const withoutAmv = (text: string) => spaced(text).replace(/^amv\s+/i, "");

/** The rule that reads a seat text (notes removed), if any. */
function ruleOf(text: string): Rule | undefined {
  const key = titleKey(notesOf(withoutAmv(text)).bare);
  return key === "" ? undefined : TITLE_RULES.find((r) => r.pattern.test(key));
}

/** The division a division seat's title names: its text before "Lead" or "Lead Engineer"; null when nothing comes before. */
function divisionNamed(bare: string): string | null {
  const name = spaced(bare.replace(/\blead(\s+engineer)?$/i, ""));
  return name === "" ? null : name;
}

/** The unit a head seat's title names: X of "Head of X" or "X Head"; null when there is none, or it is only "Department". */
function headedNamed(bare: string): string | null {
  const m = /^head\s+of\s+(.+)$/i.exec(bare) ?? /^(.+?)\s+head$/i.exec(bare);
  const name = m === null ? "" : spaced(m[1]);
  return name === "" || /^department$/i.test(name) ? null : name;
}

/** The seat one seat text gives. */
export function readSeat(text: string): SeatReading {
  const title = withoutAmv(text);
  const { bare, acting, project } = notesOf(title);
  const key = titleKey(bare);
  const rule = key === "" ? undefined : TITLE_RULES.find((r) => r.pattern.test(key));
  if (rule !== undefined) {
    const { seat } = rule;
    const division = seat.unit === "division" ? divisionNamed(bare) : null;
    // Only a plain head seat: the Chief Operating Officer's rule reads its own titles.
    const headed = seat.type === "head" && seat.fullAccess === null ? headedNamed(bare) : null;
    return { kind: "seat", seat, title, acting, project, division, headed };
  }
  if (SEAT_WORDS.test(key)) return { kind: "unknown", title };
  return { kind: "seat", seat: CORE, title: title || "Member", acting, project, division: null, headed: null };
}

/** The seats one " - " part gives: a compound title's parts, the " & " parts when the table reads each, else the part itself. */
function readPart(text: string): SeatReading[] {
  const title = withoutAmv(text);
  const { bare } = notesOf(title);
  const notes = title.slice(bare.length).trim();
  const compound = COMPOUND_TITLES.find((c) => c.pattern.test(titleKey(bare)));
  if (compound !== undefined) {
    return compound.parts.map((part, i) => {
      const reading = readSeat(i === compound.parts.length - 1 && notes !== "" ? `${part.text} ${notes}` : part.text);
      return reading.kind === "seat" && part.unit !== undefined ? { ...reading, seat: { ...reading.seat, unit: part.unit } } : reading;
    });
  }
  const parts = title.split(/\s*&\s*/).filter((p) => p !== "");
  if (parts.length > 1 && parts.every((p) => ruleOf(p) !== undefined)) return parts.map(readSeat);
  return [readSeat(title)];
}

/** The seats a title cell gives, one per " - " part (or more, see readPart). An empty cell is one core member's seat, titled "Member". */
export function seatsOf(cell: string): SeatReading[] {
  const texts = seatTexts(cell);
  return texts.length === 0 ? [readSeat("")] : texts.flatMap(readPart);
}

/** The seat a single title gives, or null for an unknown title. */
export function seatOf(title: string): Seat | null {
  const reading = readSeat(title);
  return reading.kind === "seat" ? reading.seat : null;
}
