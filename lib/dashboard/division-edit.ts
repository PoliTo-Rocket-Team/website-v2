import { z } from "zod";
import {
  divisionLabel,
  homeDivision,
  matchesQuery,
  mayChangeDivision,
  mayLeaveTeam,
  roleIn,
  type Memberships,
  type OrgChart,
  type OrgDivision,
  type RoleBeyondDivisions,
  type TeamActor,
} from "./team";

// A department head creates, edits, closes and reopens the divisions of their
// department (issue #232, boards 68b to 68e and 69d). Both sides of the data
// interface run these checks, so the drawer's rules and the server's are one:
// the drawer runs them first, and the server runs them again on every save.

/** A division code: 2 or 3 letters, kept in capitals (Owner decision on #232). */
const CODE = /^[A-Z]{2,3}$/;

/** The code as typed, trimmed and in capitals. */
export function normalizeDivisionCode(text: string): string {
  return text.trim().toUpperCase();
}

/**
 * Why `code` cannot be the division's code, or null when it can: 2 or 3
 * letters, and no other open division uses it (Owner decision, 2026-10-11).
 * `self` is the division being edited, which may keep its own code.
 */
export function divisionCodeError(code: string, open: readonly Pick<OrgDivision, "id" | "name" | "code">[], self: number | null): string | null {
  if (!CODE.test(code)) return "Use 2 or 3 letters.";
  const taken = open.find((d) => d.id !== self && normalizeDivisionCode(d.code ?? "") === code);
  return taken ? `${divisionLabel(taken.name)} already uses ${code}.` : null;
}

const MAX_NAME = 60;

/** Why the name as typed cannot be saved, or null. The drawer's field holds the name without "Division". */
export function divisionNameError(typed: string): string | null {
  const name = divisionLabel(typed.trim());
  if (name === "") return "Write the division's name.";
  return name.length > MAX_NAME ? "Too long." : null;
}

/** The name as stored: "Flight Dynamics" is kept as "Flight Dynamics Division", as every division is named. */
export function storedDivisionName(typed: string): string {
  return `${divisionLabel(typed.trim().replace(/\s+/g, " "))} Division`;
}

/**
 * What happens to a lead who is replaced or removed (Owner decision,
 * 2026-10-11): they stay as a member (the default), leave this division and
 * keep their others, or leave the team (Alumni, all access ends).
 */
export const OLD_LEAD_OUTCOMES = ["member", "leave-division", "leave-team"] as const;
export type OldLeadOutcome = (typeof OLD_LEAD_OUTCOMES)[number];

/**
 * What New division and Edit division send. A replaced lead and a removed one
 * are the same to the server: an old lead with an outcome. Members and emails
 * are sent only by New division and Reopen: an open division adds its members
 * one by one, as the Members page does.
 */
export type DivisionSave = {
  /** As typed, without "Division". */
  readonly name: string;
  readonly code: string;
  readonly newLeads: readonly number[];
  readonly oldLeads: readonly { readonly personId: number; readonly outcome: OldLeadOutcome }[];
  readonly members: readonly number[];
  readonly emails: readonly string[];
};

const id = z.number().int().positive();

const saveSchema = z.object({
  name: z.string().max(200),
  code: z.string().max(10).transform(normalizeDivisionCode),
  newLeads: z.array(id).max(20),
  oldLeads: z.array(z.object({ personId: id, outcome: z.enum(OLD_LEAD_OUTCOMES) })).max(20),
  members: z.array(id).max(60),
  emails: z.array(z.string().trim().toLowerCase().pipe(z.email("Write an email address.").max(200))).max(20),
});

/** The save as sent, in its shape; the rules are `planDivisionSave`'s. */
export function checkDivisionSave(input: unknown): { ok: true; value: DivisionSave } | { ok: false; error: string } {
  const result = saveSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "Check the form." };
  return { ok: true, value: result.data };
}

/** Someone on the team, as the division rules read them. */
export type TeamPerson = {
  readonly id: number;
  readonly name: string;
  /** Every address they are found by: the one they sign in with, and their team address. */
  readonly emails: readonly string[];
  readonly memberships: Memberships;
  /** Every role they hold in no division: the team leader, a board seat, a head. */
  readonly beyond: readonly RoleBeyondDivisions[];
};

/** The division a save is about: a new one in a department, an open one, or a closed one being reopened. */
export type DivisionSubject =
  | { readonly kind: "new"; readonly departmentId: number }
  | { readonly kind: "open"; readonly division: OrgDivision }
  | {
      readonly kind: "closed";
      readonly division: OrgDivision;
      /**
       * People whose role in it never ended. Close division refuses while
       * anyone is in it, but a division closed before that rule can still hold
       * roles; the org chart leaves closed divisions out, so it is read here.
       */
      readonly stillIn: readonly number[];
    };

/** What a checked save changes; each data source writes it in one go. */
export type DivisionPlan = {
  /** As stored: "Mission Analysis Division". */
  readonly name: string;
  readonly code: string;
  /** The code changed: the division's position codes read the new one from now on. */
  readonly codeChanged: boolean;
  /**
   * A closed division opens again with this save, or null. It comes back
   * with no members (Owner decision, 2026-10-11): every role still active in
   * it ends, its pending NDA adds and its division access go, and only the
   * roles of `keep` stay, the leads this save picks who still held one there.
   * Those are in `promote`, so nobody gets a second role in the division.
   */
  readonly reopen: { readonly keep: readonly number[] } | null;
  /** Members of the division who become its leads. */
  readonly promote: readonly number[];
  /** People not in the division who join it as leads, keeping their other divisions. */
  readonly joinAsLead: readonly number[];
  /** Old leads who stay as members. */
  readonly demote: readonly number[];
  /** Old leads who leave this division and keep their others. */
  readonly leaveDivision: readonly number[];
  /** Old leads who leave the team: every role and every access ends, and they move to Alumni. */
  readonly leaveTeam: readonly number[];
  /** People who join as members (New division and Reopen). */
  readonly joinAsMember: readonly number[];
  /** Emails new to the team: they wait for Confirm NDA in the division (New division and Reopen). */
  readonly emails: readonly string[];
};

export type Planned = { readonly ok: true; readonly plan: DivisionPlan } | { readonly ok: false; readonly error: string };

function no(error: string): Planned {
  return { ok: false, error };
}

/**
 * Whether the actor may create, edit, close or reopen a division of the
 * department: its head, or the team leader (Owner decision, 2026-10-11).
 */
export function mayManageDivisionsIn(actor: TeamActor, departmentId: number): boolean {
  return actor.kind === "team" || (actor.kind === "head" && actor.departmentIds.includes(departmentId));
}

function managePermission(actor: TeamActor, departmentId: number, org: OrgChart): string | null {
  if (mayManageDivisionsIn(actor, departmentId)) return null;
  const department = org.departments.find((d) => d.id === departmentId);
  return department ? `Only the Head of ${department.name} or the team leader can do this.` : "Only the team leader can do this.";
}

/** Why someone cannot be picked to lead or join a division here, or null. */
function pickError(person: TeamPerson | undefined): string | null {
  if (!person) return "They are not on the team.";
  // A seat, a head or the team leader is placed by that role, so a division role would not show.
  return person.beyond.length > 0 ? `${person.name} holds a team role beyond the divisions, so they cannot join one here.` : null;
}

/**
 * The save as the rules allow it (Owner decisions, 2026-10-11 on #232), or
 * the first reason it is refused:
 * - only the department's head or the team leader may make it;
 * - a name, and a code of 2 or 3 letters no other open division uses;
 * - leads are picked from the whole team and keep their other divisions;
 * - an open division always has at least one lead, so a create, an edit or a
 *   reopen that leaves none is refused;
 * - an old lead leaves this division only when they are in another one, and
 *   leaves the team only when `mayLeaveTeam` allows it.
 */
export function planDivisionSave(input: {
  readonly actor: TeamActor;
  /** The open departments and divisions. */
  readonly org: OrgChart;
  readonly subject: DivisionSubject;
  readonly save: DivisionSave;
  readonly team: readonly TeamPerson[];
}): Planned {
  const { actor, org, subject, save, team } = input;
  const departmentId = subject.kind === "new" ? subject.departmentId : subject.division.departmentId;
  if (!org.departments.some((d) => d.id === departmentId)) return no("That department is closed.");
  if (subject.kind === "open") {
    const may = mayChangeDivision(actor, subject.division.id, org);
    if (!may.allowed) return no(may.reason);
  } else {
    const refusal = managePermission(actor, departmentId, org);
    if (refusal !== null) return no(refusal);
  }

  const nameError = divisionNameError(save.name);
  if (nameError !== null) return no(nameError);
  const self = subject.kind === "open" ? subject.division.id : null;
  const codeError = divisionCodeError(save.code, org.divisions, self);
  if (codeError !== null) return no(codeError);

  const byId = new Map(team.map((p) => [p.id, p]));
  const divisionId = subject.kind === "new" ? null : subject.division.id;
  const roleHere = (p: TeamPerson) => (divisionId === null ? null : roleIn(p.memberships, divisionId));
  const leads = subject.kind === "open" ? team.filter((p) => roleHere(p) === "lead").map((p) => p.id) : [];
  const stillIn = subject.kind === "closed" ? subject.stillIn : [];
  /** A role here this save turns into a lead's: a member of an open division, or a role a closed one still holds. */
  const holdsRole = (personId: number) => roleHere(byId.get(personId)!) === "member" || stillIn.includes(personId);

  const newLeads = [...new Set(save.newLeads)];
  const oldIds = save.oldLeads.map((o) => o.personId);
  if (new Set(oldIds).size !== oldIds.length) return no("A lead is listed twice.");
  for (const personId of oldIds) {
    if (!leads.includes(personId)) return no("Only a lead of this division can be replaced or removed.");
  }
  for (const personId of newLeads) {
    const person = byId.get(personId);
    const error = pickError(person);
    if (error !== null) return no(error);
    if (leads.includes(personId) || oldIds.includes(personId)) return no(`${person!.name} already leads this division.`);
  }
  if (leads.length - oldIds.length + newLeads.length < 1) return no("A division needs at least one lead.");

  const demote: number[] = [];
  const leaveDivision: number[] = [];
  const leaveTeam: number[] = [];
  for (const { personId, outcome } of save.oldLeads) {
    const person = byId.get(personId)!;
    if (outcome === "member") demote.push(personId);
    if (outcome === "leave-division") {
      if (!person.memberships.some((m) => m.divisionId !== divisionId)) {
        return no(`This is ${person.name}'s only division, so they stay as a member or leave the team.`);
      }
      leaveDivision.push(personId);
    }
    if (outcome === "leave-team") {
      const may = mayLeaveTeam(actor, { memberships: person.memberships, beyond: person.beyond }, org);
      if (!may.allowed) return no(may.reason);
      leaveTeam.push(personId);
    }
  }

  const members = [...new Set(save.members)].filter((m) => !newLeads.includes(m));
  const emails = [...new Set(save.emails)];
  if (subject.kind === "open" && (members.length > 0 || emails.length > 0)) return no("Add members to an open division from its member list.");
  for (const personId of members) {
    const error = pickError(byId.get(personId));
    if (error !== null) return no(error);
  }
  for (const email of emails) {
    const member = team.find((p) => p.emails.some((e) => e.trim().toLowerCase() === email));
    if (member) return no(`${email} is ${member.name}'s address: pick them from the team.`);
  }

  return {
    ok: true,
    plan: {
      name: storedDivisionName(save.name),
      code: save.code,
      codeChanged: subject.kind === "open" && normalizeDivisionCode(subject.division.code ?? "") !== save.code,
      reopen: subject.kind === "closed" ? { keep: newLeads.filter((p) => stillIn.includes(p)) } : null,
      promote: newLeads.filter(holdsRole),
      joinAsLead: newLeads.filter((p) => !holdsRole(p)),
      demote,
      leaveDivision,
      leaveTeam,
      joinAsMember: members,
      emails,
    },
  };
}

/**
 * Why the division cannot close, or null (Owner decision, 2026-10-11): only
 * its department's head or the team leader closes it, and never while anyone
 * is in it, people waiting for their NDA included. Closing also closes its
 * open positions and removes the access given in it.
 */
export function closeRefusal(
  actor: TeamActor,
  org: OrgChart,
  divisionId: number,
  inIt: { readonly people: number; readonly waiting: number },
): string | null {
  const division = org.divisions.find((d) => d.id === divisionId);
  if (!division) return "That division is already closed.";
  const may = mayChangeDivision(actor, divisionId, org);
  if (!may.allowed) return may.reason;
  const count = inIt.people + inIt.waiting;
  if (count === 0) return null;
  return `${count} ${count === 1 ? "person is" : "people are"} still in ${division.name}. Remove them or add them to another division first.`;
}

// The lead and member pickers of the division drawers (boards 68b2, 69d)

/** Someone on the team as a picker lists them (board 68b2). */
export type TeamPick = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  /** "Aerodynamics · Mission Analysis": their home division and its department; null when they are in none. */
  readonly place: string | null;
  /** "Member", or "Lead · Parachutes" for someone who leads a division. */
  readonly role: string;
  readonly divisionIds: readonly number[];
};

/** What a picker's field finds as the actor types. */
export type TeamSearch =
  | { readonly kind: "people"; readonly people: readonly TeamPick[] }
  | { readonly kind: "new-email"; readonly email: string }
  | { readonly kind: "none" };

const SEARCH_LIMIT = 6;

function pickOf(person: TeamPerson, org: OrgChart): TeamPick {
  const label = (divisionId: number | null) => {
    const division = org.divisions.find((d) => d.id === divisionId);
    return division ? divisionLabel(division.name) : null;
  };
  const home = homeDivision(person.memberships);
  const department = org.departments.find((d) => d.id === org.divisions.find((v) => v.id === home)?.departmentId);
  const led = person.memberships.find((m) => m.role === "lead");
  const ledLabel = led ? label(led.divisionId) : null;
  return {
    id: person.id,
    name: person.name,
    email: person.emails[0] ?? "",
    place: home === null || !department ? null : `${department.name} · ${label(home)}`,
    role: ledLabel === null ? "Member" : `Lead · ${ledLabel}`,
    divisionIds: person.memberships.map((m) => m.divisionId),
  };
}

/**
 * A picker's search over the whole team (Owner decision, 2026-10-11): an
 * email finds the member who uses it, or says it is new to the team; anything
 * else searches names. Someone who holds a team role beyond the divisions is
 * not listed (`planDivisionSave` refuses them).
 */
export function searchTeam(query: string, team: readonly TeamPerson[], org: OrgChart): TeamSearch {
  const text = query.trim();
  const pickable = team.filter((p) => p.beyond.length === 0);
  if (z.email().safeParse(text).success) {
    const email = text.toLowerCase();
    const member = team.find((p) => p.emails.some((e) => e.trim().toLowerCase() === email));
    if (!member) return { kind: "new-email", email };
    return member.beyond.length === 0 ? { kind: "people", people: [pickOf(member, org)] } : { kind: "none" };
  }
  if (text.length < 2) return { kind: "none" };
  const people = pickable.filter((p) => matchesQuery([p.name], text)).slice(0, SEARCH_LIMIT);
  return people.length === 0 ? { kind: "none" } : { kind: "people", people: people.map((p) => pickOf(p, org)) };
}
