import "server-only";

import { asc, eq, isNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { departments, divisions, members, roles, scopes, users } from "@/db/schema";
import {
  boardSeatOf,
  membershipsOfRoles,
  type AlumnusRow,
  type BoardSeat,
  type OrgChart,
  type Placement,
  type RoleHeld,
  type RosterEntry,
} from "./team";

// The database side of the Team pages (issue #143). One cached snapshot of
// every role, the open org chart and every scope (ADR 0003: full-directory
// reads are cached, tagged, never per view); ./database.ts filters it by
// the viewer after the cache hit. The schema keeps no "shown on the site"
// flag for alumni, so alumni read from here carry none.

/** Tag for the snapshot; a write that changes who is on the team invalidates it. */
export const TEAM_ROSTER_CACHE_TAG = "team-roster";

type RoleRow = {
  member_id: number;
  type: "president" | "head" | "lead" | "core" | null;
  title: string;
  started_at: string;
  leaved_at: string | null;
  dept_id: number | null;
  division_id: number | null;
};

type PersonRow = {
  member_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  program: string | null;
  level_of_study: string | null;
  /** The years on the team their lead gave when moving them to alumni (issue #172). */
  team_from: number | null;
  team_to: number | null;
};

type ScopeRow = { member_id: number | null; target: string; access_level: string };

export type TeamSnapshot = {
  readonly org: OrgChart;
  readonly roles: readonly RoleRow[];
  readonly people: readonly PersonRow[];
  readonly scopes: readonly ScopeRow[];
};

async function queryTeamSnapshot(): Promise<TeamSnapshot> {
  const db = getDb();
  const [departmentRows, divisionRows, roleRows, personRows, scopeRows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(isNull(departments.closedAt))
      .orderBy(asc(departments.id)),
    db
      .select({ id: divisions.id, name: divisions.name, dept_id: divisions.deptId })
      .from(divisions)
      .where(isNull(divisions.closedAt))
      .orderBy(asc(divisions.id)),
    db
      .select({
        member_id: roles.memberId,
        type: roles.type,
        title: roles.title,
        started_at: roles.startedAt,
        leaved_at: roles.leavedAt,
        dept_id: roles.deptId,
        division_id: roles.divisionId,
      })
      .from(roles),
    db
      .select({
        member_id: users.member,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        program: users.program,
        level_of_study: users.levelOfStudy,
        team_from: members.teamFrom,
        team_to: members.teamTo,
      })
      .from(users)
      .leftJoin(members, eq(members.memberId, users.member)),
    db
      .select({ member_id: scopes.memberId, target: scopes.target, access_level: scopes.accessLevel })
      .from(scopes),
  ]);
  return {
    org: {
      departments: departmentRows,
      divisions: divisionRows.flatMap((d) => (d.dept_id === null ? [] : [{ id: d.id, name: d.name, departmentId: d.dept_id }])),
    },
    roles: roleRows.flatMap((r) => (r.member_id === null ? [] : [{ ...r, member_id: r.member_id }])),
    people: personRows.flatMap((p) => (p.member_id === null ? [] : [{ ...p, member_id: p.member_id }])),
    scopes: scopeRows,
  };
}

export async function readTeamSnapshot(): Promise<TeamSnapshot> {
  "use cache";
  cacheTag(TEAM_ROSTER_CACHE_TAG);
  cacheLife("hours");
  return queryTeamSnapshot();
}

const ROLE_RANK = { president: 0, head: 2, lead: 3, core: 4 } as const;

/**
 * A board seat (Project Manager, Chief Engineer) has no role type of its own:
 * it is a role in no department or division whose title names the seat.
 */
function boardSeatOfRole(role: RoleRow): BoardSeat | null {
  if (role.type === "president" || role.dept_id !== null || role.division_id !== null) return null;
  return boardSeatOf(role.title);
}

function rank(role: RoleRow): number {
  if (boardSeatOfRole(role) !== null) return 1;
  return role.type === null ? 5 : ROLE_RANK[role.type];
}

/**
 * Where someone's active roles put them, highest first: the team leader, a
 * board seat or a head by their top role; anyone else in every open division
 * they hold a role in, each with its own role (issue #229). A role in a closed
 * or missing division places them nowhere, so someone with only such roles is
 * on the roster and not yet placed.
 */
function placementOf(active: readonly RoleRow[], org: OrgChart): Placement {
  const [top] = active;
  if (top.type === "president") return { role: "team-leader" };
  const seat = boardSeatOfRole(top);
  if (seat !== null) return { role: "board", seat };
  if (top.type === "head") {
    const departmentId = top.dept_id ?? org.divisions.find((d) => d.id === top.division_id)?.departmentId ?? null;
    if (departmentId !== null && org.departments.some((d) => d.id === departmentId)) return { role: "head", departmentId };
  }
  const open = active.filter((role) => org.divisions.some((d) => d.id === role.division_id));
  return { role: "divisions", memberships: membershipsOfRoles(open.map(roleHeld)) };
}

function roleHeld(role: RoleRow): RoleHeld {
  return { type: role.type, divisionId: role.division_id, since: role.started_at };
}

const TARGET_LABELS: Readonly<Record<string, string>> = {
  all: "All pages",
  positions: "Positions",
  applications: "Applications",
  members: "Members",
  orders: "Orders",
  faq: "FAQ",
  blog: "Blog",
  logs: "Activity log",
};

function nameOf(person: PersonRow | undefined): { name: string; email: string } | null {
  if (!person) return null;
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email;
  return { name, email: person.email };
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

function rolesByMember(snapshot: TeamSnapshot): Map<number, RoleRow[]> {
  const byMember = new Map<number, RoleRow[]>();
  for (const role of snapshot.roles) byMember.set(role.member_id, [...(byMember.get(role.member_id) ?? []), role]);
  return byMember;
}

/** Everyone with an active role, placed by all of them (`placementOf`). */
export function rosterOf(snapshot: TeamSnapshot): RosterEntry[] {
  const people = new Map(snapshot.people.map((p) => [p.member_id, p]));
  return [...rolesByMember(snapshot)].flatMap(([memberId, memberRoles]): RosterEntry[] => {
    const active = memberRoles.filter((r) => r.leaved_at === null).sort((a, b) => rank(a) - rank(b));
    const person = people.get(memberId);
    const named = nameOf(person);
    if (active.length === 0 || !named) return [];
    return [
      {
        id: memberId,
        ...named,
        placement: placementOf(active, snapshot.org),
        pageTitle: active[0].title || null,
        joined: Math.min(...memberRoles.map((r) => yearOf(r.started_at))),
        program: person?.program ?? null,
        study: person?.level_of_study ?? null,
        access: snapshot.scopes
          .filter((s) => s.member_id === memberId)
          .map((s) => `${TARGET_LABELS[s.target] ?? s.target} · ${s.access_level}`),
      },
    ];
  });
}

/** Everyone whose roles have all ended, by their last one. */
export function alumniOf(snapshot: TeamSnapshot): AlumnusRow[] {
  const people = new Map(snapshot.people.map((p) => [p.member_id, p]));
  const { org } = snapshot;
  return [...rolesByMember(snapshot)].flatMap(([memberId, memberRoles]): AlumnusRow[] => {
    const person = people.get(memberId);
    const named = nameOf(person);
    if (!named || memberRoles.length === 0 || memberRoles.some((r) => r.leaved_at === null)) return [];
    const last = [...memberRoles].sort((a, b) => (b.leaved_at ?? "").localeCompare(a.leaved_at ?? ""))[0];
    const division = org.divisions.find((d) => d.id === last.division_id);
    const departmentId = last.dept_id ?? division?.departmentId ?? null;
    const department = org.departments.find((d) => d.id === departmentId)?.name ?? "Board";
    return [
      {
        id: memberId,
        name: named.name,
        lastRole: last.title,
        unit: division?.name ?? department,
        department,
        // The years the lead gave on Move to alumni, else the roles' own dates.
        from: person?.team_from ?? Math.min(...memberRoles.map((r) => yearOf(r.started_at))),
        to: person?.team_to ?? Math.max(...memberRoles.map((r) => yearOf(r.leaved_at!))),
        shownOnSite: null,
      },
    ];
  });
}
