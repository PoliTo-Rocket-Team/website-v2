import { z } from "zod";
import type { TeamPerson } from "./division-edit";
import { HAND_OVER_OUTCOMES, steppingDown, type HandOverOutcome, type SteppingDown } from "./hand-over";
import { beyondTitle, DEPARTMENT_KINDS, divisionLabel, type DepartmentKind, type OrgChart, type TeamActor } from "./team";

// New department, Edit department and Close department (issue #251, boards
// 77d to 77f): the team leader and full access manage departments, from the
// Team tree's edit view. A department head never does, not even their own.
// Both sides of the data interface run these checks: the panel runs them
// first, and the server runs them again on every save.

/** A department code: 2 or 3 letters, kept in capitals, as a division's (board 77d). */
const CODE = /^[A-Z]{2,3}$/;

const MAX_NAME = 60;

/** The code as typed, trimmed and in capitals. */
export function normalizeDepartmentCode(text: string): string {
  return text.trim().toUpperCase();
}

/** The name as stored: "Propulsion", without "Department", as every department is named. */
export function storedDepartmentName(typed: string): string {
  return typed
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+Department$/i, "");
}

/** Why the name as typed cannot be saved, or null. */
export function departmentNameError(typed: string): string | null {
  const name = storedDepartmentName(typed);
  if (name === "") return "Write the department's name.";
  return name.length > MAX_NAME ? "Too long." : null;
}

/**
 * Why `code` cannot be the department's code, or null: 2 or 3 letters, and no
 * other open department uses it. `self` is the department being edited, which
 * may keep its own code.
 */
export function departmentCodeError(code: string, open: readonly { readonly id: number; readonly name: string; readonly code?: string | null }[], self: number | null): string | null {
  if (!CODE.test(code)) return "Use 2 or 3 letters.";
  const taken = open.find((d) => d.id !== self && normalizeDepartmentCode(d.code ?? "") === code);
  return taken ? `${taken.name} already uses ${code}.` : null;
}

/** Whether the actor manages departments: the team leader and full access, nobody else (Owner decision, 2026-10-16). */
export function mayManageDepartments(actor: TeamActor | null): boolean {
  return actor?.kind === "team";
}

const ONLY_TEAM = "Only the team leader can change a department.";

/** What New department sends (board 77d): the name, the code, its kind (issue #325) and its head, picked from the team. */
export type DepartmentCreate = {
  readonly name: string;
  readonly code: string;
  readonly kind: DepartmentKind;
  /** Exactly one person; a list, so "none" and "two" are refused by the rule, not lost in the shape. */
  readonly heads: readonly number[];
};

/**
 * Change head on Edit department (board 77e, issue #253): who heads the
 * department from now on, and what the head they replace does next. The
 * outcome is null only when nothing was picked; the rules refuse that while
 * the department has a head.
 */
export type HeadChange = { readonly to: number; readonly outcome: HandOverOutcome | null };

/** What Save changes on Edit department sends (board 77e): the name, the code, its kind (issue #325), and a new head when Change head picked one. */
export type DepartmentSave = { readonly name: string; readonly code: string; readonly kind: DepartmentKind; readonly head: HeadChange | null };

/** What becomes of one division when its department closes (board 77f). */
export type DivisionFate =
  | { readonly divisionId: number; readonly action: "move"; readonly to: number }
  | { readonly divisionId: number; readonly action: "close" };

/**
 * What Close department sends: a fate for each of its open divisions, and
 * what becomes of its head (board 77f, Owner decision 2026-10-16): no role is
 * given automatically, the closer picks one. "advisor" ends the head role and
 * starts one Advisor role in no department and no division, since the
 * department closes, and removes their access; "leave" ends every role they
 * hold, so they appear on Alumni. `head` is null only when nothing was
 * picked; the rules refuse that while the department has a head.
 */
export type DepartmentClose = { readonly divisions: readonly DivisionFate[]; readonly head: HandOverOutcome | null };

export type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

function no<T>(error: string): Checked<T> {
  return { ok: false, error };
}

function yes<T>(value: T): Checked<T> {
  return { ok: true, value };
}

const id = z.number().int().positive();
const name = z.string().max(200);
const code = z.string().max(10).transform(normalizeDepartmentCode);
const kind = z.enum(DEPARTMENT_KINDS);

const createSchema = z.object({ name, code, kind, heads: z.array(id).max(5) });
const saveSchema = z.object({
  name,
  code,
  kind,
  head: z.object({ to: id, outcome: z.enum(HAND_OVER_OUTCOMES).nullable() }).nullable().default(null),
});
const closeSchema = z.object({
  divisions: z
    .array(
      z.discriminatedUnion("action", [
        z.object({ divisionId: id, action: z.literal("move"), to: id }),
        z.object({ divisionId: id, action: z.literal("close") }),
      ]),
    )
    .max(60),
  head: z.enum(HAND_OVER_OUTCOMES).nullable().default(null),
});

function parsed<T>(result: z.ZodSafeParseResult<T>): Checked<T> {
  return result.success ? yes(result.data) : no(result.error.issues[0]?.message ?? "Check the form.");
}

/** New department as sent, in its shape; the rules are `planDepartmentCreate`'s. */
export function checkDepartmentCreate(input: unknown): Checked<DepartmentCreate> {
  return parsed(createSchema.safeParse(input));
}

/** Edit department's save as sent, in its shape; the rules are `planDepartmentSave`'s. */
export function checkDepartmentSave(input: unknown): Checked<DepartmentSave> {
  return parsed(saveSchema.safeParse(input));
}

/** Close department as sent, in its shape; the rules are `planDepartmentClose`'s. */
export function checkDepartmentClose(input: unknown): Checked<DepartmentClose> {
  return parsed(closeSchema.safeParse(input));
}

/** A checked New department: the department to open and the one person who heads it. */
export type DepartmentCreatePlan = { readonly name: string; readonly code: string; readonly kind: DepartmentKind; readonly headId: number };

/**
 * New department as the rules allow it (board 77d), or the first reason it is
 * refused: only the team leader or full access; a name; a code of 2 or 3
 * letters no other open department uses; exactly one head, on the team, who
 * holds no seat yet (a team leader, a board seat or another department's
 * head stays where they are). The head keeps their divisions.
 */
export function planDepartmentCreate(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly save: DepartmentCreate;
  readonly team: readonly TeamPerson[];
}): Checked<DepartmentCreatePlan> {
  const { actor, org, save, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM);
  const nameError = departmentNameError(save.name);
  if (nameError !== null) return no(nameError);
  const codeError = departmentCodeError(save.code, org.departments, null);
  if (codeError !== null) return no(codeError);
  const heads = [...new Set(save.heads)];
  if (heads.length !== 1) return no("A department needs exactly one head.");
  const head = team.find((p) => p.id === heads[0]);
  if (!head) return no("They are not on the team.");
  const [seat] = head.beyond;
  if (seat !== undefined) return no(`${head.name} is already ${beyondTitle(seat, org)}.`);
  return yes({ name: storedDepartmentName(save.name), code: save.code, kind: save.kind, headId: head.id });
}

/**
 * A checked Change head: who heads the department from now on, the people
 * who head it now (`from`, none for a department with no head), and what
 * becomes of them (null when nobody heads it).
 */
export type HeadChangePlan = { readonly to: number; readonly from: readonly number[]; readonly steppingDown: SteppingDown | null };

/** A checked Edit department save: the name, code and kind as stored, what changed, and the new head, if any. */
export type DepartmentSavePlan = {
  readonly name: string;
  readonly code: string;
  readonly kind: DepartmentKind;
  readonly nameChanged: boolean;
  readonly codeChanged: boolean;
  readonly head: HeadChangePlan | null;
};

/**
 * Edit department's Save changes (board 77e): the same name and code rules
 * as New department, for an open department. Change head (issue #253) hands
 * the head role over: the new head is on the team, holds no seat yet (as in
 * New department) and keeps their divisions; the head they replace becomes an
 * advisor in this department or leaves the team, as the editor picked, and
 * nothing is picked for them (`steppingDown`). `headIds` are the people who
 * head it now.
 */
export function planDepartmentSave(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly departmentId: number;
  readonly save: DepartmentSave;
  readonly team: readonly TeamPerson[];
  readonly headIds: readonly number[];
}): Checked<DepartmentSavePlan> {
  const { actor, org, departmentId, save, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM);
  const department = org.departments.find((d) => d.id === departmentId);
  if (!department) return no("That department is closed.");
  const nameError = departmentNameError(save.name);
  if (nameError !== null) return no(nameError);
  const codeError = departmentCodeError(save.code, org.departments, departmentId);
  if (codeError !== null) return no(codeError);
  const stored = storedDepartmentName(save.name);
  const head = save.head === null ? null : planHeadChange(save.head, departmentId, [...new Set(input.headIds)], team, org);
  if (head !== null && !head.ok) return no(head.error);
  return yes({
    name: stored,
    code: save.code,
    kind: save.kind,
    nameChanged: stored !== department.name,
    codeChanged: save.code !== normalizeDepartmentCode(department.code ?? ""),
    head: head === null ? null : head.value,
  });
}

function planHeadChange(change: HeadChange, departmentId: number, from: readonly number[], team: readonly TeamPerson[], org: OrgChart): Checked<HeadChangePlan> {
  const next = team.find((p) => p.id === change.to);
  if (!next) return no("They are not on the team.");
  if (from.includes(next.id)) return no(`${next.name} already heads this department.`);
  const [seat] = next.beyond;
  if (seat !== undefined) return no(`${next.name} is already ${beyondTitle(seat, org)}.`);
  if (from.length === 0) return yes({ to: next.id, from, steppingDown: null });
  if (change.outcome === null) return no("Choose what happens to the head: Become an advisor or Leave the team.");
  return yes({ to: next.id, from, steppingDown: steppingDown({ kind: "head", departmentId }, change.outcome) });
}

/**
 * A checked Close department: the divisions that move, each to its new
 * department, the empty ones that close, and what becomes of the people who
 * head it (null when nobody does).
 */
export type DepartmentClosePlan = {
  readonly move: readonly { readonly divisionId: number; readonly to: number }[];
  readonly close: readonly number[];
  readonly head: { readonly outcome: HandOverOutcome; readonly personIds: readonly number[] } | null;
};

/**
 * Close department as the rules allow it (board 77f), or the first reason it
 * is refused: only the team leader or full access; every open division of the
 * department has exactly one fate; a division moves to another open
 * department, with its people, leads and open positions; a division closes
 * only when nobody is in it (`inIt`, the people and the people waiting for
 * their NDA, by division id); while anyone heads it (`headIds`), the closer
 * picks what becomes of them (`HandOverOutcome`), and nothing is picked for them.
 */
export function planDepartmentClose(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly departmentId: number;
  readonly close: DepartmentClose;
  readonly inIt: Readonly<Record<number, number>>;
  readonly headIds: readonly number[];
}): Checked<DepartmentClosePlan> {
  const { actor, org, departmentId, close, inIt } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM);
  if (!org.departments.some((d) => d.id === departmentId)) return no("That department is already closed.");
  const divisions = org.divisions.filter((d) => d.departmentId === departmentId);
  const named = close.divisions.map((f) => f.divisionId);
  if (new Set(named).size !== named.length) return no("A division is listed twice.");
  if (named.some((divisionId) => !divisions.some((d) => d.id === divisionId))) return no("Only this department's open divisions can be moved or closed.");
  const move: { divisionId: number; to: number }[] = [];
  const shut: number[] = [];
  for (const division of divisions) {
    const fate = close.divisions.find((f) => f.divisionId === division.id);
    const label = divisionLabel(division.name);
    if (!fate) return no(`Choose what happens to ${label}.`);
    if (fate.action === "move") {
      if (fate.to === departmentId || !org.departments.some((d) => d.id === fate.to)) return no(`Pick another open department for ${label}.`);
      move.push({ divisionId: division.id, to: fate.to });
    } else {
      if ((inIt[division.id] ?? 0) > 0) return no(`People are still in ${label}, so it can only move.`);
      shut.push(division.id);
    }
  }
  const personIds = [...new Set(input.headIds)];
  if (personIds.length === 0) return yes({ move, close: shut, head: null });
  if (close.head === null) return no("Choose what happens to the head: Become an advisor or Leave the team.");
  return yes({ move, close: shut, head: { outcome: close.head, personIds } });
}
