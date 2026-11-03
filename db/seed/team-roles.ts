// The team as the Team page reads it, built from the seeded rows the way the
// team snapshot builds it from stored ones (lib/dashboard/team-snapshot.ts).
// It needs only the rows of the structure and people modules, so the Team
// page seed (./team-page.ts) can snapshot its layer's layout from them, and
// ./cases.ts reads the same team from the whole seed.

import type { InferInsertModel } from "drizzle-orm";
import type { departments, divisions, members, roles, users } from "@/db/schema";
import { furtherSeatsOf, type TeamPerson as PagePerson } from "@/lib/about/team-person";
import type { TeamRoles } from "@/lib/about/team-roles";
import { isTeamSeat, membershipsOfRoles, roleBeyondDivisions, type OrgChart, type Placement, type RoleSeat } from "@/lib/dashboard/team";
import { SEAT_OF_FLAG } from "@/lib/dashboard/viewer";

/** The seeded rows the team is read from. */
export type SeedRoster = {
  readonly departments: readonly InferInsertModel<typeof departments>[];
  readonly divisions: readonly InferInsertModel<typeof divisions>[];
  readonly members: readonly InferInsertModel<typeof members>[];
  readonly users: readonly InferInsertModel<typeof users>[];
  readonly roles: readonly InferInsertModel<typeof roles>[];
};

type Role = SeedRoster["roles"][number];

/**
 * A seeded role row of `data` as `RoleSeat`, the way lib/dashboard/team-snapshot.ts
 * reads a stored one. A row seeded with no id gets the one a fresh database
 * gives it: its place in `data.roles`, from 1.
 */
export function seatOfRole(data: Pick<SeedRoster, "roles">, role: Role): RoleSeat {
  return {
    id: role.id ?? data.roles.indexOf(role) + 1,
    type: role.type ?? null,
    divisionId: role.divisionId ?? null,
    since: role.startedAt!,
    departmentId: role.deptId ?? null,
    title: role.title,
    fullAccess: role.fullAccess == null ? null : SEAT_OF_FLAG[role.fullAccess],
  };
}

export function isActive(role: Role): boolean {
  return (role.leavedAt ?? null) === null;
}

/** The member ids that hold a role now. */
export function onTeam(data: Pick<SeedRoster, "roles">): Set<number> {
  return new Set(data.roles.filter(isActive).flatMap((r) => (r.memberId == null ? [] : [r.memberId])));
}

/** The open org chart, as the team snapshot reads it (lib/dashboard/team-snapshot.ts). */
export function orgOf(data: Pick<SeedRoster, "departments" | "divisions">): OrgChart {
  return {
    departments: data.departments.filter((d) => (d.closedAt ?? null) === null).map((d) => ({ id: d.id!, name: d.name, code: d.code ?? null, kind: d.kind ?? "technical" })),
    divisions: data.divisions
      .filter((d) => (d.closedAt ?? null) === null)
      .flatMap((d) => (d.deptId == null ? [] : [{ id: d.id!, name: d.name, departmentId: d.deptId, code: d.code ?? null }])),
  };
}

/** A role's rank when the roster picks where someone sits, as lib/dashboard/team-snapshot.ts ranks it. */
function placementRank(role: Role): number {
  if (role.type === "president") return 0;
  if (isTeamSeat({ type: role.type ?? null, departmentId: role.deptId ?? null, divisionId: role.divisionId ?? null })) return 1;
  const ranks: Readonly<Record<string, number>> = { head: 2, lead: 3, core: 4, advisor: 4 };
  return ranks[role.type ?? ""] ?? 5;
}

/** Where someone's active roles put them, highest first, as `placementOf` in lib/dashboard/team-snapshot.ts. */
function placementOfRoles(data: Pick<SeedRoster, "roles">, active: readonly Role[], org: OrgChart): Placement {
  const [top] = active;
  const open = active.filter((r) => org.divisions.some((d) => d.id === r.divisionId)).map((r) => seatOfRole(data, r));
  const beside = () => membershipsOfRoles(open.filter((r) => roleBeyondDivisions(r, org) === null));
  const seat = roleBeyondDivisions(seatOfRole(data, top), org);
  if (seat?.kind === "team-leader") return { role: "team-leader", memberships: beside() };
  if (seat?.kind === "board") return { role: "board", seat: seat.seat, memberships: beside() };
  if (seat?.kind === "head") {
    const { departmentId, title } = seat;
    if (departmentId !== null && org.departments.some((d) => d.id === departmentId)) return { role: "head", departmentId, title, memberships: beside() };
  }
  return { role: "divisions", memberships: membershipsOfRoles(open) };
}

/** The team as the Team page reads it from the seeded rows. */
export function teamRolesOf(data: SeedRoster): TeamRoles {
  const org = orgOf(data);
  const people = [...onTeam(data)].flatMap((memberId): PagePerson[] => {
    const active = data.roles.filter((r) => r.memberId === memberId && isActive(r)).sort((a, b) => placementRank(a) - placementRank(b));
    const user = data.users.find((u) => u.member === memberId);
    const member = data.members.find((m) => m.memberId === memberId);
    if (user === undefined) return [];
    const placement = placementOfRoles(data, active, org);
    return [
      {
        id: memberId,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        placement,
        furtherSeats: furtherSeatsOf(placement, active.flatMap((r) => roleBeyondDivisions(seatOfRole(data, r), org) ?? [])),
        pageTitle: active[0].title || null,
        photo: member?.picture ?? null,
        linkedin: user.linkedin ?? null,
        teamEmail: member?.prtEmail ?? null,
      },
    ];
  });
  return { org, people };
}
