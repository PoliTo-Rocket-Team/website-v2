import type { PersonRecord } from "@/lib/dashboard/division-members";
import {
  BOARD_SEAT_TITLES,
  BOARD_SEATS,
  divisionLabel,
  roleIn,
  type OrgChart as TeamOrg,
  type OrgDepartment,
  type RosterEntry,
} from "@/lib/dashboard/team";
import type {
  DepartmentGroup,
  DepartmentHead,
  DivisionLead,
  Leader,
  Member,
  Person,
  PersonPhoto,
  TeamPage,
  UpTo,
} from "./types";

// The Team page built from the team's roles (issue #282, ADR 0015): who
// leads, every department and every core member come from the roles the
// dashboard sets, so a title saved on the member panel reaches the page once
// the `team-roster` cache is refreshed. The header, the advisors, "In
// numbers", the intro text and the group photo stay the hand-typed values of
// ./team.ts. Pure: the database (lib/about/team-data.ts) and the dummy team
// read the same build.

/** Someone on this year's team, as the Team page reads them. */
export type TeamPerson = Pick<RosterEntry, "id" | "name" | "placement" | "pageTitle"> & {
  /** `members.picture`, null when they uploaded none. */
  readonly photo: string | null;
  /** `users.linkedin` as the dashboard keeps it: "linkedin.com/in/elifkaya". Null or "" when none. */
  readonly linkedin: string | null;
  /** `members.prt_email`. Null or "" when none. */
  readonly teamEmail: string | null;
};

/** The open departments and divisions, in display order, and everyone with an active role. */
export type TeamRoles = { readonly org: TeamOrg; readonly people: readonly TeamPerson[] };

/** The roster with the contact each member record holds, joined by member id. */
export function teamPeopleOf(roster: readonly RosterEntry[], records: readonly PersonRecord[]): TeamPerson[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return roster.map((entry) => {
    const record = byId.get(entry.id);
    return {
      id: entry.id,
      name: entry.name,
      placement: entry.placement,
      pageTitle: entry.pageTitle,
      photo: record?.photoUrl ?? null,
      linkedin: record?.details.linkedin ?? null,
      teamEmail: record?.details.prtEmail ?? null,
    };
  });
}

/** The arc holds up to eight leaders, a slide up to ten members, the carousel up to five slides. */
export const ARC_LEADERS = 8;
export const SLIDE_MEMBERS = 10;
export const SLIDES = 5;

/** The first `n` items as an `UpTo`, or null for an empty list. */
function upTo<T, N extends number>(list: readonly T[], n: N): UpTo<T, N> | null {
  return list.length === 0 ? null : (list.slice(0, n) as unknown as UpTo<T, N>);
}

function photoOf(url: string | null): PersonPhoto | undefined {
  const value = url?.trim() ?? "";
  return value.startsWith("/team/") || value.startsWith("https://") ? (value as PersonPhoto) : undefined;
}

/** "linkedin.com/in/elif-kaya" is the handle "elif-kaya". */
function linkedinHandleOf(profile: string | null): string | undefined {
  const match = /linkedin\.com\/in\/([^/?#\s]+)/i.exec(profile ?? "");
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** A person as the page draws them: a missing photo, LinkedIn or email is an absent key. */
function personOf(p: TeamPerson): Person {
  const photo = photoOf(p.photo);
  const linkedin = linkedinHandleOf(p.linkedin);
  const email = p.teamEmail?.trim() ?? "";
  return {
    name: p.name,
    ...(photo !== undefined && { photo }),
    ...(linkedin !== undefined && { linkedin }),
    ...(email !== "" && { email }),
  };
}

function titleOf(p: TeamPerson): string | undefined {
  const title = p.pageTitle?.trim() ?? "";
  return title === "" ? undefined : title;
}

const byName = (a: TeamPerson, b: TeamPerson) => a.name.localeCompare(b.name, "en");

/** The board seats, in the order the Team tree draws them; two people in one seat by name. */
function arcOf(people: readonly TeamPerson[]): readonly (readonly [TeamPerson, Leader])[] {
  return BOARD_SEATS.flatMap((seat) =>
    people
      .filter((p) => p.placement.role === "board" && p.placement.seat === seat)
      .sort(byName)
      .map((p) => [p, { ...personOf(p), role: titleOf(p) ?? BOARD_SEAT_TITLES[seat] }] as const),
  ).slice(0, ARC_LEADERS);
}

/** One department's head with the leads of its divisions, in division order; co-leads by name. */
function headsOf(department: OrgDepartment, roles: TeamRoles): readonly (readonly [readonly TeamPerson[], DepartmentHead])[] {
  const heads = roles.people.filter((p) => p.placement.role === "head" && p.placement.departmentId === department.id).sort(byName);
  const leads = roles.org.divisions
    .filter((d) => d.departmentId === department.id)
    .flatMap((division) =>
      roles.people
        .filter((p) => roleIn(p.placement.memberships, division.id) === "lead")
        .sort(byName)
        .map((p) => [p, { ...personOf(p), division: divisionLabel(division.name) } satisfies DivisionLead] as const),
    );
  return heads.map((head) => [
    [head, ...leads.map(([p]) => p)],
    { kind: "head", ...personOf(head), role: titleOf(head) ?? `Head of ${department.name}`, leads: leads.map(([, l]) => l) },
  ]);
}

/**
 * A slide's heading: "All departments" when every head fits on one, else
 * the first and last department on it ("Aerodynamics to Electronics").
 */
function slideName(departments: readonly string[], slides: number): string {
  if (slides === 1) return "All departments";
  const first = departments[0];
  const last = departments[departments.length - 1];
  return first === last ? first : `${first} to ${last}`;
}

/** The heads in department order, filled into slides of up to ten, at most five slides. */
function slidesOf(roles: TeamRoles): { shown: readonly TeamPerson[]; groups: readonly DepartmentGroup[] } {
  const heads = roles.org.departments.flatMap((department) =>
    headsOf(department, roles).map(([people, head]) => ({ department: department.name, people, head })),
  );
  const chunks: (typeof heads)[] = [];
  for (let i = 0; i < heads.length && chunks.length < SLIDES; i += SLIDE_MEMBERS) chunks.push(heads.slice(i, i + SLIDE_MEMBERS));
  return {
    shown: chunks.flat().flatMap((h) => h.people),
    groups: chunks.map((chunk) => ({
      name: slideName([...new Set(chunk.map((h) => h.department))], chunks.length),
      members: upTo(
        chunk.map((h) => h.head),
        SLIDE_MEMBERS,
      )!,
    })),
  };
}

/**
 * The Team page with its people built from the roles, onto `base` (the
 * hand-typed ./team.ts) for everything else:
 * - who leads: the team leader, then the board seats on the arc;
 * - departments: each open department's head with its division leads;
 * - core members: everyone else with an active role, by name, with their title.
 *
 * Null when the roles cannot fill a section the page always draws: no team
 * leader, no board seat, no department head or no one left for core members.
 */
export function teamPageFromRoles(roles: TeamRoles, base: TeamPage): TeamPage | null {
  const leader = roles.people.filter((p) => p.placement.role === "team-leader").sort(byName)[0];
  const arc = arcOf(roles.people);
  const departments = slidesOf(roles);
  const shown = new Set([leader, ...arc.map(([p]) => p), ...departments.shown].map((p) => p?.id));
  const core = roles.people
    .filter((p) => !shown.has(p.id))
    .sort(byName)
    .map((p): Member => {
      const { linkedin } = personOf(p);
      const role = titleOf(p);
      return { name: p.name, ...(role !== undefined && { role }), ...(linkedin !== undefined && { linkedin }) };
    });

  const leaders = upTo(
    arc.map(([, l]) => l),
    ARC_LEADERS,
  );
  const groups = upTo(departments.groups, SLIDES);
  const [firstCore, ...restCore] = core;
  if (!leader || !leaders || !groups || !firstCore) return null;
  return {
    ...base,
    orgChart: { ...base.orgChart, leader: { ...personOf(leader), role: titleOf(leader) ?? "Team Leader" }, leaders },
    departments: { ...base.departments, groups },
    coreMembers: { ...base.coreMembers, members: [firstCore, ...restCore] },
  };
}
