import type { PersonRecord } from "@/lib/dashboard/division-members";
import { BOARD_SEAT_TITLES, BOARD_SEATS, divisionLabel, roleIn, type OrgChart as TeamOrg, type RosterEntry } from "@/lib/dashboard/team";
import {
  applyLayer,
  ARC_LEADERS,
  NO_TEAM_LAYER,
  type BuiltDepartment,
  type BuiltLeader,
  type ShownDepartment,
  type ShownTeam,
  type TeamBuild,
  type TeamPageLayer,
} from "./team-layer";
import { byName, personOf, titleOf, type TeamPerson } from "./team-person";
import type { DepartmentGroup, Member, TeamPage, UpTo } from "./types";

// The Team page built from the team's roles (issue #282, ADR 0015): who
// leads, every department and every core member come from the roles the
// dashboard sets, so a title saved on the member panel reaches the page once
// the `team-roster` cache is refreshed. The visual layer (./team-layer.ts,
// issue #283) is laid on that build; the header, the advisors, "In numbers"
// and, unless the layer sets them, the intro text and the group photo stay
// the hand-typed values of ./team.ts. Pure: the database
// (lib/about/team-data.ts) and the dummy team read the same build.

export type { TeamPerson } from "./team-person";
export { ARC_LEADERS } from "./team-layer";

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

/** A slide holds up to ten members, the carousel up to five slides. */
export const SLIDE_MEMBERS = 10;
export const SLIDES = 5;

/** The first `n` items as an `UpTo`, or null for an empty list. */
function upTo<T, N extends number>(list: readonly T[], n: N): UpTo<T, N> | null {
  return list.length === 0 ? null : (list.slice(0, n) as unknown as UpTo<T, N>);
}

/** The board seats, in the order the Team tree draws them; two people in one seat by name. */
function arcOf(people: readonly TeamPerson[]): BuiltLeader[] {
  return BOARD_SEATS.flatMap((seat) =>
    people
      .filter((p) => p.placement.role === "board" && p.placement.seat === seat)
      .sort(byName)
      .map((p, n): BuiltLeader => ({ spot: `arc:${seat}:${n}`, person: p, role: titleOf(p) ?? BOARD_SEAT_TITLES[seat] })),
  );
}

/** Each open department with a head: its heads by name, and the leads of its divisions in division order, co-leads by name. */
function departmentsOf(roles: TeamRoles): BuiltDepartment[] {
  return roles.org.departments.flatMap((department): BuiltDepartment[] => {
    const heads = roles.people
      .filter((p) => p.placement.role === "head" && p.placement.departmentId === department.id)
      .sort(byName)
      .map((p, n) => ({ spot: `head:${department.id}:${n}` as const, person: p, title: titleOf(p) }));
    if (heads.length === 0) return [];
    const leads = roles.org.divisions
      .filter((d) => d.departmentId === department.id)
      .flatMap((division) =>
        roles.people
          .filter((p) => roleIn(p.placement.memberships, division.id) === "lead")
          .sort(byName)
          .map((p, n) => ({ spot: `lead:${division.id}:${n}` as const, person: p, division: divisionLabel(division.name) })),
      );
    return [{ id: department.id, name: department.name, heads, leads }];
  });
}

/**
 * Who the page shows, and where, as the roles alone build it:
 * - who leads: the team leader, then the board seats on the arc;
 * - departments: each open department's head with its division leads;
 * - core members: everyone else with an active role, by name, with their
 *   title. Someone the arc or the carousel has no room for is a core member.
 */
export function teamBuildOf(roles: TeamRoles): TeamBuild {
  const leaderPerson = roles.people.filter((p) => p.placement.role === "team-leader").sort(byName)[0];
  const arc = arcOf(roles.people);
  const departments = departmentsOf(roles);
  const carousel = departments
    .flatMap((d) => d.heads.map((head) => [head.person, ...d.leads.map((l) => l.person)]))
    .slice(0, SLIDES * SLIDE_MEMBERS)
    .flat();
  const shown = new Set([leaderPerson, ...arc.slice(0, ARC_LEADERS).map((l) => l.person), ...carousel].map((p) => p?.id));
  const core = roles.people
    .filter((p) => !shown.has(p.id))
    .sort(byName)
    .map((p): Member => {
      const { linkedin } = personOf(p);
      const role = titleOf(p);
      return { name: p.name, ...(role !== undefined && { role }), ...(linkedin !== undefined && { linkedin }) };
    });
  return {
    people: roles.people,
    leader: leaderPerson === undefined ? null : { person: leaderPerson, role: titleOf(leaderPerson) ?? "Team Leader" },
    arc,
    departments,
    core,
  };
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
function slidesOf(departments: readonly ShownDepartment[]): DepartmentGroup[] {
  const heads = departments.flatMap((d) => d.heads.map((head) => ({ department: d.name, head: head.shown })));
  const chunks: (typeof heads)[] = [];
  for (let i = 0; i < heads.length && chunks.length < SLIDES; i += SLIDE_MEMBERS) chunks.push(heads.slice(i, i + SLIDE_MEMBERS));
  return chunks.map((chunk) => ({
    name: slideName([...new Set(chunk.map((h) => h.department))], chunks.length),
    members: upTo(
      chunk.map((h) => h.head),
      SLIDE_MEMBERS,
    )!,
  }));
}

/** `page` with the layer's intro text and group photo, where it sets them. */
export function withLayerText(page: TeamPage, layer: Pick<TeamPageLayer, "intro" | "groupPhoto">): TeamPage {
  return {
    ...page,
    header: layer.intro === null ? page.header : { ...page.header, intro: layer.intro },
    coreMembers: layer.groupPhoto === null ? page.coreMembers : { ...page.coreMembers, groupPhoto: layer.groupPhoto },
  };
}

/**
 * The Team page as `shown` lays it out, with the core members of `build`,
 * onto `base` (the hand-typed ./team.ts) for everything else. Null when a
 * section the page always draws is empty: no team leader, no one on the arc,
 * no department head or no one left for core members.
 */
export function teamPageOf(build: TeamBuild, shown: ShownTeam, base: TeamPage): TeamPage | null {
  const leaders = upTo(
    shown.leaders.map((l) => l.shown),
    ARC_LEADERS,
  );
  const groups = upTo(slidesOf(shown.departments), SLIDES);
  const [firstCore, ...restCore] = build.core;
  if (!shown.leader || !leaders || !groups || !firstCore) return null;
  const page: TeamPage = {
    ...base,
    orgChart: { ...base.orgChart, leader: shown.leader, leaders },
    departments: { ...base.departments, groups },
    coreMembers: { ...base.coreMembers, members: [firstCore, ...restCore] },
  };
  return withLayerText(page, shown);
}

/**
 * The Team page built from the roles with `layer` laid on (none by default),
 * onto `base` for everything else; null when the roles cannot fill a section
 * the page always draws (`teamPageOf`).
 */
export function teamPageFromRoles(roles: TeamRoles, base: TeamPage, layer: TeamPageLayer = NO_TEAM_LAYER): TeamPage | null {
  const build = teamBuildOf(roles);
  return teamPageOf(build, applyLayer(build, layer), base);
}
