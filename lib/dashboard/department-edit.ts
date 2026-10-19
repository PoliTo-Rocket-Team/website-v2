import { z } from "zod";
import type { TeamPerson } from "./division-edit";
import type { PersonRecord } from "./division-members";
import { advisingIn, HAND_OVER_OUTCOMES, steppingDown, type HandOverOutcome, type SteppingDown, type Unit } from "./hand-over";
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

/** The role a former head or lead picks in their destination on Close department: "Become an advisor" or a member. */
export const DESTINATION_ROLES = ["advisor", "member"] as const;
export type DestinationRole = (typeof DESTINATION_ROLES)[number];

/**
 * Where one person goes when their department closes, and, for a former head
 * or lead, the role they pick there. `role` is null when nothing was picked,
 * and always for a member or an advisor, who keep the role they hold.
 */
export type PersonMove = { readonly personId: number; readonly to: Unit; readonly role: DestinationRole | null };

/**
 * What Close department sends (Owner decision, 2026-10-19): a destination for
 * every person in the department, members, leads, advisors and the head, and
 * no "Leave the team". Every division closes with the department. Nothing is
 * picked for anyone (Owner decision, 2026-10-16).
 */
export type DepartmentClose = { readonly people: readonly PersonMove[] };

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
const unit = z.discriminatedUnion("kind", [z.object({ kind: z.literal("department"), departmentId: id }), z.object({ kind: z.literal("division"), divisionId: id })]);
const closeSchema = z.object({
  people: z.array(z.object({ personId: id, to: unit, role: z.enum(DESTINATION_ROLES).nullable().default(null) })).max(500),
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

// Close department (Owner decision, 2026-10-19): the department and every one
// of its divisions close, and every person in it moves to a department or
// division the closer picks, one destination each. Nobody leaves the team
// from here.

/** What someone holds in a closing department: its head, a lead of one of its divisions, an Advisor role in it, or a member of it. */
export type ClosingStanding = "head" | "lead" | "advisor" | "member";

/** Whether the person hands a role over when their department closes, and so picks their role in the destination. */
export function stepsDown(standing: ClosingStanding): standing is "head" | "lead" {
  return standing === "head" || standing === "lead";
}

/** Someone Close department moves: who they are, what they hold in the department, and the units outside it they already hold a role in. */
export type ClosingPerson = {
  readonly id: number;
  readonly name: string;
  readonly standing: ClosingStanding;
  /** Units outside the closing department where they already hold a role: they cannot be moved there. */
  readonly holds: readonly Unit[];
};

/** A person as `closingPeople` reads them: both data sources build these records (./division-members.ts). */
export type ClosingRecord = Pick<PersonRecord, "id" | "name" | "memberships" | "beyondDivisions" | "advising">;

const STANDING_ORDER: Readonly<Record<ClosingStanding, number>> = { head: 0, lead: 1, advisor: 2, member: 3 };

/**
 * Everyone Close department moves, head first, then leads, advisors and
 * members, each by name: anyone who heads the department, or holds a role in
 * one of its divisions or on the department itself. A role they hold
 * anywhere else stays, and that unit is not a destination for them.
 */
export function closingPeople(records: readonly ClosingRecord[], org: OrgChart, departmentId: number): ClosingPerson[] {
  const own = new Set(org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id));
  const people = records.flatMap((r): ClosingPerson[] => {
    const here = r.memberships.filter((m) => own.has(m.divisionId));
    const heads = r.beyondDivisions.some((b) => b.kind === "head" && b.departmentId === departmentId);
    const kept = r.beyondDivisions.filter((b) => (b.kind === "advisor" || b.kind === "department") && b.departmentId === departmentId);
    if (!heads && here.length === 0 && kept.length === 0) return [];
    const advises = kept.some((b) => b.kind === "advisor") || here.some((m) => r.advising.includes(m.divisionId));
    const standing: ClosingStanding = heads ? "head" : here.some((m) => m.role === "lead") ? "lead" : advises ? "advisor" : "member";
    const holds: Unit[] = [
      ...r.memberships.filter((m) => !own.has(m.divisionId)).map((m): Unit => ({ kind: "division", divisionId: m.divisionId })),
      ...r.beyondDivisions.flatMap((b): Unit[] =>
        (b.kind === "head" || b.kind === "advisor" || b.kind === "department") && b.departmentId !== null && b.departmentId !== departmentId
          ? [{ kind: "department", departmentId: b.departmentId }]
          : [],
      ),
    ];
    return [{ id: r.id, name: r.name, standing, holds }];
  });
  return people.sort((a, b) => STANDING_ORDER[a.standing] - STANDING_ORDER[b.standing] || a.name.localeCompare(b.name));
}

/** "Structures", "Mission Analysis": the destination's name, or null when it is not an open unit outside the closing department. */
export function destinationName(to: Unit, org: OrgChart, departmentId: number): string | null {
  if (to.kind === "department") {
    return to.departmentId === departmentId ? null : (org.departments.find((d) => d.id === to.departmentId)?.name ?? null);
  }
  const division = org.divisions.find((d) => d.id === to.divisionId);
  return division === undefined || division.departmentId === departmentId ? null : divisionLabel(division.name);
}

function sameUnit(a: Unit, b: Unit): boolean {
  return a.kind === "department" ? b.kind === "department" && a.departmentId === b.departmentId : b.kind === "division" && a.divisionId === b.divisionId;
}

/**
 * The role someone holds in their destination. A former head or lead picked
 * it: "Become an advisor" there (`advisingIn`, so their access ends) or a
 * member. A member stays a member and an advisor stays an advisor, with the
 * access they hold.
 */
export type Becoming = { readonly kind: "member" } | { readonly kind: "advisor"; readonly access: "ends" | "kept" };

/** One person's move: where they go and what they hold there. Every role they held in the closing department ends. */
export type ClosingMove = { readonly personId: number; readonly to: Unit; readonly becomes: Becoming };

/** A checked Close department: the divisions that close with it, and every person's move. */
export type DepartmentClosePlan = { readonly divisions: readonly number[]; readonly moves: readonly ClosingMove[] };

function becoming(person: ClosingPerson, move: PersonMove, where: string): Checked<Becoming> {
  const { standing } = person;
  if (!stepsDown(standing) && move.role !== null) return no(`${person.name} keeps the role they hold: only a head or lead picks one.`);
  const role: DestinationRole | null = stepsDown(standing) ? move.role : standing;
  if (role === null) return no(`Choose ${person.name}'s role in ${where}: Become an advisor or Member.`);
  if (role === "member") return move.to.kind === "division" ? yes({ kind: "member" }) : no(`A member goes to a division: pick one for ${person.name}.`);
  return yes({ kind: "advisor", access: stepsDown(standing) ? advisingIn(move.to).access : "kept" });
}

/**
 * Close department as the rules allow it, or the first reason it is refused
 * (Owner decision, 2026-10-19): only the team leader or full access; nobody
 * waits for their NDA in its divisions (`waiting`, by division id); every
 * person in it (`people`, from `closingPeople`) has one destination, an open
 * department or division outside it where they hold no role yet; a former
 * head or lead picks Advisor or member there, and nothing is picked for them;
 * a member's destination is a division. Every division of the department
 * closes with it.
 */
export function planDepartmentClose(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly departmentId: number;
  readonly close: DepartmentClose;
  readonly people: readonly ClosingPerson[];
  readonly waiting: Readonly<Record<number, number>>;
}): Checked<DepartmentClosePlan> {
  const { actor, org, departmentId, close, people } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM);
  if (!org.departments.some((d) => d.id === departmentId)) return no("That department is already closed.");
  const divisions = org.divisions.filter((d) => d.departmentId === departmentId);
  for (const division of divisions) {
    const waiting = input.waiting[division.id] ?? 0;
    if (waiting > 0) return no(`${waiting} ${waiting === 1 ? "person is" : "people are"} waiting for their NDA in ${divisionLabel(division.name)}. Confirm or cancel them first.`);
  }
  const named = close.people.map((m) => m.personId);
  if (new Set(named).size !== named.length) return no("Someone is listed twice.");
  if (named.some((personId) => !people.some((p) => p.id === personId))) return no("Only people in this department move when it closes.");
  const moves: ClosingMove[] = [];
  for (const person of people) {
    const move = close.people.find((m) => m.personId === person.id);
    if (!move) return no(`Choose where ${person.name} goes.`);
    const where = destinationName(move.to, org, departmentId);
    if (where === null) return no(`Pick an open department or division outside this one for ${person.name}.`);
    if (person.holds.some((u) => sameUnit(u, move.to))) return no(`${person.name} is already in ${where}.`);
    const becomes = becoming(person, move, where);
    if (!becomes.ok) return no(becomes.error);
    moves.push({ personId: person.id, to: move.to, becomes: becomes.value });
  }
  return yes({ divisions: divisions.map((d) => d.id), moves });
}
