import { z } from "zod";
import { NO_MEMBER_DETAILS, noDetailsFilled, parseMemberDetails, type MemberDetailErrors, type MemberDetails } from "./details";
import { movablePlacesOf, type MovablePlace } from "./member-move";
import { placesOf, type PersonPlace } from "./member-places";
import { nameRule, NO_NAME, type PersonName } from "./person-name";
import {
  beyondTitle,
  divisionLabel,
  homeFirst,
  leadsChangedBy,
  matchesQuery,
  mayChangeDivision,
  mayLeaveTeam,
  reachesDivision,
  removalFrom,
  roleIn,
  seatTitleValue,
  titledSeatOf,
  type DivisionRole,
  type Joining,
  type Memberships,
  type OrgChart,
  type Permission,
  type Removal,
  type RoleBeyondDivisions,
  type TeamActor,
} from "./team";
import { shortDate } from "./write";

// A division's Members page (issue #231, boards 61e to 61h2): the people in
// the division with every division they are in, their contact, studies and
// personal details, the people waiting for Confirm NDA, and what the viewer
// may do to each. Both sides of the data interface build it here from their
// own records, so the rules and the shapes are one.

/** A division as a chip names it (board 61e): its code inside the page's department, the department's name outside it. */
export type DivisionChip = {
  readonly divisionId: number;
  readonly label: string;
  /** The code style (mono, boxed); false for a department name. */
  readonly code: boolean;
};

/** One division a person is in, as the drawer lists it (board 61f). */
export type PersonDivision = {
  readonly divisionId: number;
  /** "Mission Analysis" */
  readonly name: string;
  readonly code: string | null;
  /** "Structures" */
  readonly department: string;
  /** In the page's department: the drawer shows its code; outside it, the department beside the name. */
  readonly sameDepartment: boolean;
  readonly role: DivisionRole;
  /** Their role's title there: "CAD Engineer". */
  readonly title: string | null;
};

/** The NDA a member signed: when, and who confirmed it. The team has one NDA (ADR 0014). */
export type SignedNda = {
  /** "2024-03-12" */
  readonly signedOn: string;
  /** Who clicked Confirm NDA; null where the record names nobody (members from before the dashboard). */
  readonly confirmedBy: string | null;
};

/** Someone in the division, with what the page shows and what the viewer may do. */
export type DivisionPerson = {
  readonly id: number;
  readonly name: string;
  /** The account they sign in with, or the email they were added with: locked in Edit details. */
  readonly signInEmail: string;
  readonly photoUrl: string | null;
  /** The year they joined the team. */
  readonly since: number;
  /** Their role in this division. */
  readonly role: DivisionRole;
  /** Their title in this division; the Role column shows it, or "Division Lead". */
  readonly title: string | null;
  /** Their role here is an Advisor role: Close division keeps them, in the department (issue #441). */
  readonly advisor: boolean;
  /** Every division they are in, this one first. */
  readonly divisions: readonly PersonDivision[];
  /** Every place they hold, seats and headships included, with its stored title: the member panel's Placement (board 98, issue #647). */
  readonly places: readonly PersonPlace[];
  readonly chips: readonly DivisionChip[];
  readonly details: MemberDetails;
  /** Null only for a record from before the NDA was kept. */
  readonly nda: SignedNda | null;
  /** The viewer's own row: the drawer shows it, and the menu offers nothing. */
  readonly self: boolean;
  readonly leave: Permission;
  readonly removal: Removal;
  /** What Edit details may change about them (`positionOf`); null when the viewer may change nothing here, or it is their own row. */
  readonly position: MemberPosition | null;
};

// The position part of the one Edit details panel (issue #584): every viewer
// who may edit a member in scope gets the same panel, and what it offers is
// worked out here, on both sides of the data interface, from the same rules
// the server checks (./team.ts).

/** "Remove from <division>" for one division a person is in. */
export type DivisionRemoval = {
  readonly divisionId: number;
  /** "Mission Analysis" */
  readonly short: string;
  readonly removal: Removal;
};

/** Lead or member in one division, offered where the viewer may change who leads it (`mayChangeDivision`). */
export type LeadChoice = {
  readonly divisionId: number;
  readonly short: string;
  readonly role: DivisionRole;
};

/**
 * The role title Edit details sets: their title in one division the viewer
 * reaches, or, for someone in none, their seat's stored title (`titledSeatOf`:
 * the team leader's, a head's or a team-level seat's), which the team edits
 * there too (issue #626) and which may not be blank. `fixed` is someone with
 * no such seat either (an Advisor role, a role kept on a department): their
 * role is shown and nothing sets it here.
 */
export type PositionTitle =
  | { readonly kind: "division"; readonly divisionId: number; readonly short: string; readonly value: string | null }
  | { readonly kind: "seat"; readonly value: string }
  | { readonly kind: "fixed"; readonly label: string };

/** What the viewer may change about someone's place on the team from Edit details. */
export type MemberPosition = {
  /** Their first and last name as stored, which Edit details renames them by (issue #668): anyone who may edit them may. */
  readonly name: PersonName;
  readonly title: PositionTitle;
  readonly leads: readonly LeadChoice[];
  /** The places the viewer may move them out of, from Edit details and the Team tree (`movablePlacesOf`, issue #647). */
  readonly moves: readonly MovablePlace[];
  /** Every division of theirs the viewer reaches; the panel and the ⋯ menu show those offered or locked. */
  readonly removals: readonly DivisionRemoval[];
  readonly leave: Permission;
};

/** A person's position with whose it is: the whole team's rows. */
export type PersonPosition = MemberPosition & { readonly id: number };

/**
 * Whether `actor` may edit the person at all: the team reaches everyone, a
 * head or a lead (or a Members grant at Can edit) whoever is in a division
 * they reach. The server's `rolesTheViewerChanges` is the same rule.
 */
export function editsPerson(actor: TeamActor, record: Pick<PersonRecord, "memberships">, org: OrgChart): boolean {
  return actor.kind === "team" || record.memberships.some((m) => reachesDivision(actor, m.divisionId, org));
}

/**
 * The position part for `record` as `actor` sees it. `titleIn` is the
 * division the page lists them under; the title falls back to their first
 * division the actor reaches, and to their seat when there is none.
 */
export function positionOf(record: PersonRecord, org: OrgChart, actor: TeamActor, titleIn: number | null): MemberPosition {
  const standing = { memberships: record.memberships, beyond: record.beyondDivisions };
  const reached = homeFirst(record.memberships).filter((m) => org.divisions.some((d) => d.id === m.divisionId) && reachesDivision(actor, m.divisionId, org));
  const short = (divisionId: number) => divisionLabel(org.divisions.find((d) => d.id === divisionId)?.name ?? "");
  const titled = reached.find((m) => m.divisionId === titleIn) ?? reached[0];
  return {
    name: record.storedName,
    title:
      titled === undefined
        ? seatTitleOf(record, org)
        : { kind: "division", divisionId: titled.divisionId, short: short(titled.divisionId), value: record.titles[titled.divisionId] ?? null },
    // An Advisor role is no lead or member role, so the switch does not set it.
    leads: reached
      .filter((m) => !record.advising.includes(m.divisionId) && mayChangeDivision(actor, m.divisionId, org).allowed)
      .map((m) => ({ divisionId: m.divisionId, short: short(m.divisionId), role: m.role })),
    moves: movablePlacesOf(record, org, actor),
    removals: reached.map((m) => ({ divisionId: m.divisionId, short: short(m.divisionId), removal: removalFrom(actor, standing, m.divisionId, org) })),
    leave: mayLeaveTeam(actor, standing, org),
  };
}

/** The title of someone in no division the viewer reaches: their seat's, as stored (`seatTitleValue`), or their role, fixed. */
function seatTitleOf(record: PersonRecord, org: OrgChart): PositionTitle {
  const titled = titledSeatOf(record.beyondDivisions, (role) => role);
  if (titled !== null) return { kind: "seat", value: seatTitleValue(titled.seat, org) };
  const other = record.beyondDivisions[0];
  return { kind: "fixed", label: other === undefined ? "Member" : beyondTitle(other, org) };
}

/** The whole team's positions: everyone `actor` may edit, never the viewer; none for no actor. */
export function positionsOf(records: readonly PersonRecord[], org: OrgChart, actor: TeamActor | null, selfId: number | null): PersonPosition[] {
  if (actor === null) return [];
  return records.flatMap((r) => (r.id === selfId || !editsPerson(actor, r, org) ? [] : [{ id: r.id, ...positionOf(r, org, actor, null) }]));
}

/**
 * Someone added by email who is not on the team yet (Owner decision,
 * 2026-10-11): "Waiting for NDA" until a lead or head clicks Confirm NDA.
 * They hold no role and no member record, so nothing treats them as a
 * member; only Confirm NDA makes them one.
 */
export type WaitingPerson = {
  /** The add, which Confirm NDA and Fill details act on. */
  readonly joinId: number;
  readonly email: string;
  /**
   * Whether the viewer may correct `email` in Fill details (issue #741): full
   * access only, while no sign-in account holds their user row
   * (`correctsSignInEmail`, ./sign-in-email.ts). Set on the server.
   */
  readonly correctsSignInEmail: boolean;
  /** Null until a name is given. */
  readonly name: string | null;
  readonly title: string | null;
  readonly details: MemberDetails;
  /** The day they were added, in the team's time zone: "2026-10-20". */
  readonly addedOn: string;
  /** Whether a sign-in account already holds their user row: they have signed in at least once. */
  readonly signedIn: boolean;
  /** Who added them, as the viewer reads it (issue #799). Set on the server. */
  readonly addedBy: WaitingAdder;
};

/**
 * Who added someone waiting, from `team_joins.added_by` (issue #799): the
 * viewer, another member by full name, or nobody known, since the column is
 * cleared when the adder's member record goes.
 */
export type WaitingAdder =
  | { readonly kind: "viewer" }
  | { readonly kind: "member"; readonly name: string }
  | { readonly kind: "unknown" };

/**
 * The first sentence of the "hasn't signed in yet" box (issues #790, #799):
 * "You added them…" for the adder, the adder's name for anyone else, and a
 * sentence that names no one when the adder is not known.
 */
export function addedSentence(waiting: Pick<WaitingPerson, "addedBy" | "addedOn" | "email">, unit: string): string {
  const where = `to ${unit} on ${shortDate(waiting.addedOn)} with ${waiting.email}.`;
  switch (waiting.addedBy.kind) {
    case "viewer":
      return `You added them ${where}`;
    case "member":
      return `${waiting.addedBy.name} added them ${where}`;
    case "unknown":
      return `They were added ${where}`;
  }
}

/**
 * Whether the "hasn't signed in yet" box shows for them (issue #790): only
 * while they have not signed in and nobody has filled in their details, since
 * until then they may not know they were added.
 */
export function mayNotKnowTheyWereAdded(waiting: Pick<WaitingPerson, "signedIn" | "details">): boolean {
  return !waiting.signedIn && noDetailsFilled(waiting.details);
}

export type DivisionHeader = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
  readonly code: string | null;
  readonly department: string;
  /** "Leads are changed by the Head of Aerodynamics"; null where the viewer changes them (`mayChangeDivision`, issue #594). */
  readonly leadsHint: string | null;
};

export type DivisionMembers = {
  readonly division: DivisionHeader;
  /** Every division the viewer's page reaches; a switch shows when there is more than one. */
  readonly divisions: readonly { readonly id: number; readonly name: string }[];
  readonly people: readonly DivisionPerson[];
  readonly waiting: readonly WaitingPerson[];
  /** Accepted applicants waiting for Confirm join (board 59). */
  readonly joining: readonly Joining[];
  /**
   * Whether the viewer may change people in this division: the actor they
   * change people as reaches it (`mayChange` on the Members area, issue
   * #351). False shows the page with no Add member and no row action.
   */
  readonly editable: boolean;
};

/** One person as a data source holds them. */
export type PersonRecord = {
  readonly id: number;
  /** Their name as the pages show it: the stored names, or their email when both are empty. */
  readonly name: string;
  /** Their first and last name as stored; "" for one never given. */
  readonly storedName: PersonName;
  readonly signInEmail: string;
  readonly photoUrl: string | null;
  readonly since: number;
  readonly memberships: Memberships;
  /** Every role they hold in no division (team leader, board seat, department): "Leaves the team" ends these too. */
  readonly beyondDivisions: readonly RoleBeyondDivisions[];
  /** Their role's title in each division they are in. */
  readonly titles: Readonly<Record<number, string | null>>;
  /** The divisions where their role is an Advisor role (issue #253): a membership that Close division does not count. */
  readonly advising: readonly number[];
  readonly details: MemberDetails;
  readonly nda: SignedNda | null;
};

function departmentNameOf(org: OrgChart, departmentId: number): string {
  return org.departments.find((d) => d.id === departmentId)?.name ?? "";
}

function personDivisions(record: PersonRecord, org: OrgChart, departmentId: number): PersonDivision[] {
  return homeFirst(record.memberships).flatMap((m) => {
    const division = org.divisions.find((d) => d.id === m.divisionId);
    if (!division) return [];
    return [
      {
        divisionId: division.id,
        name: divisionLabel(division.name),
        code: division.code ?? null,
        department: departmentNameOf(org, division.departmentId),
        sameDepartment: division.departmentId === departmentId,
        role: m.role,
        title: record.titles[division.id] ?? null,
      },
    ];
  });
}

/** The chips of a row (board 61e): a code per division in the department, and each other department's name once. */
export function chipsOf(divisions: readonly PersonDivision[]): DivisionChip[] {
  const departments = new Set<string>();
  return divisions.flatMap((d): DivisionChip[] => {
    if (d.sameDepartment) return [{ divisionId: d.divisionId, label: d.code ?? d.name, code: d.code !== null }];
    if (departments.has(d.department)) return [];
    departments.add(d.department);
    return [{ divisionId: d.divisionId, label: d.department, code: false }];
  });
}

/** Leads first, then by name. */
function byRoleThenName(a: DivisionPerson, b: DivisionPerson): number {
  return Number(b.role === "lead") - Number(a.role === "lead") || a.name.localeCompare(b.name);
}

/** A row's actions where the viewer may not change the division: none is offered (issue #351). */
const VIEW_ONLY: { readonly leave: Permission; readonly removal: Removal; readonly position: null } = {
  leave: { allowed: false, reason: "You can view this division, not change it" },
  removal: { kind: "not-in-reach" },
  position: null,
};

/**
 * The division's page as `actor` sees it: everyone in `divisionId`, this
 * division first in their list, with what the actor may do to each. `actor`
 * is who the viewer changes people as; null, or one that does not reach the
 * division, leaves every row with no action (issue #351).
 */
export function divisionMembers(input: {
  readonly records: readonly PersonRecord[];
  readonly org: OrgChart;
  readonly divisionId: number;
  readonly actor: TeamActor | null;
  readonly selfId: number | null;
  readonly reach: readonly number[];
  readonly waiting: readonly WaitingPerson[];
  readonly joining: readonly Joining[];
}): DivisionMembers | null {
  const { org, divisionId, actor } = input;
  const division = org.divisions.find((d) => d.id === divisionId);
  if (!division) return null;
  const changer = actor !== null && reachesDivision(actor, divisionId, org) ? actor : null;
  const people = input.records.flatMap((record): DivisionPerson[] => {
    const role = roleIn(record.memberships, divisionId);
    if (role === null) return [];
    const divisions = personDivisions(record, org, division.departmentId);
    const here = divisions.find((d) => d.divisionId === divisionId);
    const rest = divisions.filter((d) => d.divisionId !== divisionId);
    const ordered = here ? [here, ...rest] : divisions;
    const standing = { memberships: record.memberships, beyond: record.beyondDivisions };
    return [
      {
        id: record.id,
        name: record.name,
        signInEmail: record.signInEmail,
        photoUrl: record.photoUrl,
        since: record.since,
        role,
        title: record.titles[divisionId] ?? null,
        advisor: record.advising.includes(divisionId),
        divisions: ordered,
        places: placesOf(record, org),
        chips: chipsOf(ordered),
        details: record.details,
        nda: record.nda,
        self: record.id === input.selfId,
        ...(changer === null
          ? VIEW_ONLY
          : {
              leave: mayLeaveTeam(changer, standing, org),
              removal: removalFrom(changer, standing, divisionId, org),
              position: record.id === input.selfId ? null : positionOf(record, org, changer, divisionId),
            }),
      },
    ];
  });
  return {
    division: {
      id: division.id,
      name: division.name,
      code: division.code ?? null,
      department: departmentNameOf(org, division.departmentId),
      leadsHint: changer !== null && mayChangeDivision(changer, division.id, org).allowed ? null : leadsChangedBy(division.id, org),
    },
    divisions: input.reach.flatMap((id) => {
      const d = org.divisions.find((x) => x.id === id);
      return d ? [{ id: d.id, name: d.name }] : [];
    }),
    people: people.sort(byRoleThenName),
    waiting: input.waiting,
    joining: input.joining,
    editable: changer !== null,
  };
}

/** "2 leads, 7 members" under the title (board 61e): everyone listed counts as a member, those waiting included. */
export function headcountLine(page: Pick<DivisionMembers, "people" | "waiting">): string {
  const leads = page.people.filter((p) => p.role === "lead").length;
  const all = page.people.length + page.waiting.length;
  return `${leads} ${leads === 1 ? "lead" : "leads"}, ${all} ${all === 1 ? "member" : "members"}`;
}

/**
 * The page's search (board 61e: "Search name, email, phone"): every word in
 * the name, an email or the phone. `teamAddresses` are the shared team
 * addresses the person holds (issue #800), so a lead who knows only a team
 * address finds who holds it; a search with no address data passes none.
 */
export function matchesPerson(
  person: Pick<DivisionPerson, "name" | "signInEmail" | "details">,
  query: string,
  teamAddresses: readonly string[] = [],
): boolean {
  const digits = person.details.phone.replace(/\D/g, "");
  const typed = query.replace(/\D/g, "");
  if (typed.length >= 3 && digits.includes(typed)) return true;
  return matchesQuery([person.name, person.signInEmail, person.details.prtEmail, ...teamAddresses], query);
}

// Add member (boards 61h and 61h2)

/** Where an email or a picked person stands, toward the division they are being added to. */
export type AddStanding =
  | { readonly kind: "member"; readonly memberships: Memberships }
  | { readonly kind: "waiting" }
  | { readonly kind: "not-on-team" };

/**
 * What Add member does (Owner decisions, 2026-10-11): someone on the team
 * joins the division at once, keeps every other division and signs no second
 * NDA (one NDA for the whole team, ADR 0014); anyone else waits for Confirm
 * NDA and is not a member until then.
 */
export type AddOutcome =
  | { readonly kind: "joins" }
  | { readonly kind: "waits-for-nda" }
  | { readonly kind: "refused"; readonly reason: string };

export function addOutcome(standing: AddStanding, divisionId: number): AddOutcome {
  if (standing.kind === "waiting") return { kind: "refused", reason: "They are already waiting for their NDA here." };
  if (standing.kind === "not-on-team") return { kind: "waits-for-nda" };
  if (roleIn(standing.memberships, divisionId) !== null) return { kind: "refused", reason: "They are already in this division." };
  return { kind: "joins" };
}

/** Add member as the drawer sends it: someone picked from the team, or an email. */
export type AddMember =
  | { readonly kind: "member"; readonly divisionId: number; readonly personId: number; readonly title: string | null }
  | {
      readonly kind: "email";
      readonly divisionId: number;
      readonly email: string;
      readonly firstName: string;
      readonly lastName: string;
      readonly title: string | null;
      /** Null when "Fill in their other details now" is off. */
      readonly details: MemberDetails | null;
    };

export type AddMemberErrors = Partial<Record<"email" | "firstName" | "lastName" | "title" | "person" | "signInEmail", string>> & MemberDetailErrors;

const MAX_TITLE = 80;

const title = z
  .string()
  .trim()
  .max(MAX_TITLE, "Too long.")
  .nullable()
  .transform((s) => (s === null || s === "" ? null : s));

const id = z.number().int().positive();

/** An email as both sides key a person by it: trimmed and lower case, as Google answers it. */
export function signInEmailOf(text: string): string {
  return text.trim().toLowerCase();
}

const addSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("member"), divisionId: id, personId: id, title }),
  z.object({
    kind: z.literal("email"),
    divisionId: id,
    email: z.string().transform(signInEmailOf).pipe(z.email("Write an email address, or pick someone from the team.").max(200, "Too long.")),
    firstName: z.string().trim().max(100, "Too long."),
    lastName: z.string().trim().max(100, "Too long."),
    title,
    details: z.unknown(),
  }),
]);

/** Add member as sent, checked: the browser and the server run the same check. */
export function checkAddMember(input: unknown): { ok: true; value: AddMember } | { ok: false; errors: AddMemberErrors } {
  const result = addSchema.safeParse(input);
  if (!result.success) {
    const errors: AddMemberErrors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "email") as keyof AddMemberErrors;
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const value = result.data;
  if (value.kind === "member") return { ok: true, value };
  if (value.details === null || value.details === undefined) return { ok: true, value: { ...value, details: null } };
  const details = parseMemberDetails(value.details);
  if (!details.ok) return { ok: false, errors: details.errors };
  return { ok: true, value: { ...value, details: details.value } };
}

/** Someone on the team as Add member's search finds them. */
export type TeamMatch = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  /** Their stored photo (`members.picture`), on their row and once picked (issue #656); null for the PRT mark. */
  readonly photoUrl: string | null;
  readonly chips: readonly DivisionChip[];
  /** Already in the division being added to. */
  readonly here: boolean;
};

/** What Add member's field answers as the actor types (boards 61h, 69c). */
export type AddLookup =
  | { readonly kind: "people"; readonly people: readonly TeamMatch[] }
  | { readonly kind: "new-email"; readonly email: string }
  | { readonly kind: "waiting"; readonly email: string }
  | { readonly kind: "none" };

/** A person on the team, as the lookup searches them. */
export type TeamCandidate = {
  readonly id: number;
  readonly name: string;
  readonly emails: readonly string[];
  readonly photoUrl: string | null;
  readonly memberships: Memberships;
};

function looksLikeEmail(text: string): boolean {
  return z.email().safeParse(text).success;
}

/**
 * The field's answer: an email finds the member with it, the person waiting
 * with it, or says they are not on the team yet; anything else searches the
 * team by name. An empty field lists the whole team by name, so the field
 * shows people as soon as it opens, and typing narrows them (issue #618).
 */
export function lookupForAdd(
  query: string,
  team: readonly TeamCandidate[],
  waitingEmails: readonly string[],
  divisionId: number,
  org: OrgChart,
): AddLookup {
  const text = query.trim();
  const match = (c: TeamCandidate): TeamMatch => {
    const departmentId = org.divisions.find((d) => d.id === divisionId)?.departmentId ?? -1;
    const record: PersonRecord = {
      id: c.id,
      name: c.name,
      storedName: NO_NAME,
      signInEmail: c.emails[0] ?? "",
      photoUrl: c.photoUrl,
      since: 0,
      memberships: c.memberships,
      beyondDivisions: [],
      titles: {},
      advising: [],
      details: NO_MEMBER_DETAILS,
      nda: null,
    };
    return {
      id: c.id,
      name: c.name,
      email: c.emails[0] ?? "",
      photoUrl: c.photoUrl,
      chips: chipsOf(personDivisions(record, org, departmentId)),
      here: roleIn(c.memberships, divisionId) !== null,
    };
  };
  if (looksLikeEmail(text)) {
    const email = signInEmailOf(text);
    const member = team.find((c) => c.emails.some((e) => signInEmailOf(e) === email));
    if (member) return { kind: "people", people: [match(member)] };
    if (waitingEmails.some((e) => signInEmailOf(e) === email)) return { kind: "waiting", email };
    return { kind: "new-email", email };
  }
  const people = team.filter((c) => matchesQuery([c.name], text)).sort((x, y) => x.name.localeCompare(y.name));
  return people.length === 0 ? { kind: "none" } : { kind: "people", people: people.map(match) };
}

// Edit details and Fill details (board 61g)

/**
 * What Edit details saves: the title in the editor's own division, the
 * details, and for someone on the team their first and last name (issue
 * #668). `name` is null when the form sent none, as Fill details does for
 * someone waiting: nothing renames them. `signInEmail` is a corrected
 * sign-in email (issue #741), null when the form sent none. `opened` is what
 * the form opened with, when it sent that: then only what the viewer changed
 * is written (`editedFields`).
 */
export type MemberEditDetails = {
  readonly title: string | null;
  readonly details: MemberDetails;
  readonly name: PersonName | null;
  readonly signInEmail: string | null;
  readonly opened: OpenedEdit | null;
};

/**
 * The details and name Edit details opened with. Its Save after Link login
 * sends them (issue #860): the record then sits on the login's row, whose own
 * values the form never showed, so a field the viewer left as it opened keeps
 * the value that row holds.
 */
export type OpenedEdit = { readonly details: MemberDetails; readonly name: PersonName | null };

/** `OpenedEdit` as Edit details sends it, in its input's `opened`: the names beside the details, as the form sends its own. */
export type OpenedSent = { readonly details: MemberDetails } & Partial<PersonName>;

/**
 * The row one open Edit details form saves onto (issue #860). At first it is
 * the record's own row, the one the form shows, so Save sends all it holds.
 * Link login moves the record onto the login's row, which the form never
 * showed: from then on every Save of that form, the one right after the link
 * and any retry once that one failed, sends what the form opened with, so
 * only the fields the viewer changed overwrite that row's own.
 */
export type SaveBasis = { readonly kind: "shown-row" } | { readonly kind: "linked-login"; readonly opened: OpenedSent };

/** The basis a form opens on: the record's own row, as shown. */
export const SHOWN_ROW: SaveBasis = { kind: "shown-row" };

/** The basis once Link login landed: what the form opened with, for every Save after it. */
export function linkedLogin(opened: OpenedSent): SaveBasis {
  return { kind: "linked-login", opened };
}

/** Save's input on `basis`: what the form sends, with what it opened with beside it once the record sits on a linked login. */
export function saveInputOn<T extends object>(basis: SaveBasis, sent: T): T & { readonly opened?: OpenedSent } {
  return basis.kind === "shown-row" ? sent : { ...sent, opened: basis.opened };
}

/**
 * The details and name a checked save writes: all it sent, or with `opened`
 * only each one the viewer changed from it. An empty object writes nothing.
 */
export function editedFields(edit: MemberEditDetails): { readonly details: Partial<MemberDetails>; readonly name: Partial<PersonName> } {
  const { details, name, opened } = edit;
  if (opened === null) return { details, name: name ?? {} };
  const changed = <T extends object>(sent: T, was: T | null): Partial<T> =>
    Object.fromEntries(Object.entries(sent).filter(([key, value]) => was === null || was[key as keyof T] !== value)) as Partial<T>;
  return { details: changed(details, opened.details), name: name === null ? {} : changed(name, opened.name) };
}

/** A corrected sign-in email: the rule of the other email fields, never blank, keyed as Google answers it. */
const signInEmailRule = z.string().transform(signInEmailOf).pipe(z.email("Write an email address.").max(200, "Too long."));

const renameSchema = z.object({ firstName: nameRule("Enter their first name."), lastName: nameRule("Enter their last name.") });

/** Who Edit details is about: someone in the division, or someone waiting for their NDA (Fill details). */
export type DetailsTarget = { readonly kind: "person"; readonly id: number } | { readonly kind: "waiting"; readonly joinId: number };

export function isDetailsTarget(value: unknown): value is DetailsTarget {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "person") return id.safeParse(v.id).success;
  if (v.kind === "waiting") return id.safeParse(v.joinId).success;
  return false;
}

/** A seat's title (`PositionTitle` kind `seat`) is never blank: the Team tree and the Team page name the seat by it. */
export const SEAT_TITLE_REQUIRED = "Enter their role.";

/**
 * What Edit details sends, checked. `titled` says whether the role title may
 * be blank: a division title may, a seat's is `required` (issue #626).
 */
export function checkMemberEdit(
  input: unknown,
  titled: "optional" | "required" = "optional",
): { ok: true; value: MemberEditDetails } | { ok: false; errors: AddMemberErrors } {
  const sent = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const t = title.safeParse(sent.title ?? "");
  if (!t.success) return { ok: false, errors: { title: t.error.issues[0]?.message ?? "Check the role." } };
  if (titled === "required" && t.data === null) return { ok: false, errors: { title: SEAT_TITLE_REQUIRED } };
  const details = parseMemberDetails(sent.details);
  if (!details.ok) return { ok: false, errors: details.errors };
  const email = sent.signInEmail === undefined ? null : signInEmailRule.safeParse(sent.signInEmail);
  if (email !== null && !email.success) return { ok: false, errors: { signInEmail: email.error.issues[0]?.message ?? "Write an email address." } };
  const signInEmail = email === null ? null : email.data;
  const opened = checkOpened(sent.opened);
  if (opened === "bad") return { ok: false, errors: {} };
  if (sent.firstName === undefined && sent.lastName === undefined) return { ok: true, value: { title: t.data, details: details.value, name: null, signInEmail, opened } };
  // A rename sends both names, each trimmed and never blank, so the Team page never shows a nameless person.
  const name = renameSchema.safeParse({ firstName: sent.firstName ?? "", lastName: sent.lastName ?? "" });
  if (!name.success) {
    const errors: AddMemberErrors = {};
    for (const issue of name.error.issues) errors[issue.path[0] as "firstName" | "lastName"] ??= issue.message;
    return { ok: false, errors };
  }
  return { ok: true, value: { title: t.data, details: details.value, name: name.data, signInEmail, opened } };
}

/** What the form opened with, checked as the sent values are so the two compare; null when none was sent, "bad" when it does not read. */
function checkOpened(input: unknown): OpenedEdit | null | "bad" {
  if (input === undefined) return null;
  if (typeof input !== "object" || input === null) return "bad";
  const sent = input as Record<string, unknown>;
  const details = parseMemberDetails(sent.details);
  if (!details.ok) return "bad";
  if (sent.firstName === undefined && sent.lastName === undefined) return { details: details.value, name: null };
  if (typeof sent.firstName !== "string" || typeof sent.lastName !== "string") return "bad";
  return { details: details.value, name: { firstName: sent.firstName.trim(), lastName: sent.lastName.trim() } };
}

/** A member photo set from Edit details (board 61g): a square JPEG under 500 KB, as the crop dialog makes it. */
export const MAX_MEMBER_PHOTO_BYTES = 500 * 1024;

export function checkMemberPhoto(file: { type: string; size: number }): string | null {
  if (file.type !== "image/jpeg") return "The photo must be a JPEG.";
  if (file.size > MAX_MEMBER_PHOTO_BYTES) return "The photo must be under 500 KB.";
  return null;
}
