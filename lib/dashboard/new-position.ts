import { positionCode } from "@/lib/apply/positions";

// The New position drawer (boards 57a and 57b, issue #171): which divisions a
// lead may post a role in, the code a role gets from its division, and the
// check every field passes before either data source writes it.

/** A division the viewer may post a role in, with the two short codes a position code is made from. */
export type DivisionChoice = {
  readonly id: number;
  readonly name: string;
  readonly department: string;
  readonly deptCode: string;
  readonly divCode: string;
};

/**
 * Where the drawer's Division field starts. One division is locked (57a);
 * several are a dropdown the lead picks from (57b). A viewer with none
 * cannot post a role, so the page shows no New position button.
 */
export type DivisionField =
  | { readonly kind: "locked"; readonly division: DivisionChoice }
  | { readonly kind: "choose"; readonly divisions: readonly [DivisionChoice, DivisionChoice, ...DivisionChoice[]] };

export function divisionField(divisions: readonly DivisionChoice[]): DivisionField | null {
  if (divisions.length === 0) return null;
  if (divisions.length === 1) return { kind: "locked", division: divisions[0] };
  return { kind: "choose", divisions: divisions as unknown as readonly [DivisionChoice, DivisionChoice, ...DivisionChoice[]] };
}

/**
 * The code the new role will get: `AER-MSA-017`. The number is the id the
 * role is stored under, so the drawer shows the next one as a preview and
 * the saved role's code is read back from the id it got.
 */
export function newPositionCode(division: DivisionChoice, id: number): string {
  return positionCode({ id, dept_code: division.deptCode, div_code: division.divCode });
}

/**
 * What a role says: the text the public pages show, the lists, and whether
 * it asks for a motivation letter. New position writes it with a division
 * and "Open now"; Edit position (issue #207) rewrites it and nothing else.
 */
export type PositionContent = {
  readonly title: string;
  readonly description: string;
  readonly required: readonly string[];
  readonly desirable: readonly string[];
  readonly questions: readonly string[];
  /** The CV is always asked; the motivation letter only when this is true. */
  readonly motivationLetter: boolean;
};

export type NewPosition = PositionContent & {
  readonly divisionId: number;
  /** "Open now": off unless the lead turns it on. */
  readonly open: boolean;
};

export type NewPositionField = "division" | "title" | "description" | "required";
export type NewPositionErrors = Partial<Record<NewPositionField, string>>;

export const NEW_POSITION_LIMITS = { title: 80, description: 2000, item: 200, items: 10 } as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => text(v).slice(0, NEW_POSITION_LIMITS.item))
    .filter((v) => v !== "")
    .slice(0, NEW_POSITION_LIMITS.items);
}

type Checked<T> = { readonly ok: true; readonly position: T } | { readonly ok: false; readonly errors: NewPositionErrors };

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function contentErrors(v: Record<string, unknown>, errors: NewPositionErrors): PositionContent {
  const title = text(v.title);
  if (title === "") errors.title = "Give the role a title.";
  else if (title.length > NEW_POSITION_LIMITS.title) errors.title = `Keep the title under ${NEW_POSITION_LIMITS.title} characters.`;
  const description = text(v.description);
  if (description === "") errors.description = "Say what the role does.";
  else if (description.length > NEW_POSITION_LIMITS.description) {
    errors.description = `Keep the description under ${NEW_POSITION_LIMITS.description} characters.`;
  }
  const required = list(v.required);
  if (required.length === 0) errors.required = "Add at least one required skill.";
  return {
    title,
    description,
    required,
    desirable: list(v.desirable),
    questions: list(v.questions),
    motivationLetter: v.motivationLetter === true,
  };
}

/**
 * Edit position's fields as the browser sent them, checked as New position
 * checks the same fields. The division and the open state are not part of
 * an edit: the role keeps its division, and the row's switch opens it.
 */
export function checkPositionContent(input: unknown): Checked<PositionContent> {
  const errors: NewPositionErrors = {};
  const content = contentErrors(asRecord(input), errors);
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, position: content };
}

/**
 * The drawer's fields as the browser sent them, checked. The division must be
 * one the viewer may post in; the data source refuses any other before this
 * runs, so here it only has to be there.
 */
export function checkNewPosition(input: unknown): Checked<NewPosition> {
  const v = asRecord(input);
  const errors: NewPositionErrors = {};
  const divisionId = Number.isInteger(v.divisionId) && (v.divisionId as number) > 0 ? (v.divisionId as number) : null;
  if (divisionId === null) errors.division = "Choose a division.";
  const content = contentErrors(v, errors);
  if (Object.keys(errors).length > 0 || divisionId === null) return { ok: false, errors };
  return { ok: true, position: { ...content, divisionId, open: v.open === true } };
}

/** What a saved role answers: its id and the code made from its division. */
export type CreatedPosition = { readonly id: number; readonly code: string };
