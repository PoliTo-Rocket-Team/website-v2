import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { departments, divisions, members, roles, users } from "@/db/schema";
import { getCurrentMemberId } from "./get-memberId";

type MemberUser = {
  first_name: string | null;
  last_name: string | null;
  email: string;
  level_of_study: string | null;
  linkedin: string | null;
  origin: string | null;
  polito_id: string | null;
  program: string | null;
  updated_at: string | null;
};

type MemberDepartment = {
  id: number;
  name: string;
  started_at: string;
  closed_at: string | null;
  code: string | null;
};

type MemberDivision = {
  id: number;
  dept_id: number | null;
  name: string;
  started_at: string;
  closed_at: string | null;
  code: string | null;
};

export type Role = {
  id: number;
  member_id: number | null;
  dept_id: number | null;
  division_id: number | null;
  title: string;
  started_at: string;
  leaved_at: string | null;
  type: "president" | "head" | "lead" | "core" | null;
  departments?: Partial<MemberDepartment> | null;
  divisions?: Partial<MemberDivision> | null;
};

export type Member = {
  member_id: number;
  prt_email: string | null;
  mobile_number: string | null;
  discord: string | null;
  nda_signed_at: string;
  nda_name: string | null;
  nda_confirmed_by: number | null;
  picture: string | null;
  users?: Partial<MemberUser>[] | null;
  roles?: Partial<Role>[] | null;
};

type MemberDirectoryRow = Awaited<ReturnType<typeof getMemberDirectoryRows>>[number];

type ViewerAccess = {
  canViewAll: boolean;
  departmentIds: Set<number>;
  divisionKeys: Set<string>;
};

async function getRolesForMember(memberId: number) {
  const db = getDb();
  return db
    .select({
      id: roles.id,
      member_id: roles.memberId,
      dept_id: roles.deptId,
      division_id: roles.divisionId,
      title: roles.title,
      started_at: roles.startedAt,
      leaved_at: roles.leavedAt,
      type: roles.type,
    })
    .from(roles)
    .where(eq(roles.memberId, memberId));
}

async function getMemberDirectoryRows() {
  const db = getDb();
  return db
    .select({
      member_id: members.memberId,
      prt_email: members.prtEmail,
      mobile_number: members.mobileNumber,
      discord: members.discord,
      nda_signed_at: members.ndaSignedAt,
      nda_name: members.ndaName,
      nda_confirmed_by: members.ndaConfirmedBy,
      picture: members.picture,
      user_id: users.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      level_of_study: users.levelOfStudy,
      linkedin: users.linkedin,
      origin: users.origin,
      polito_id: users.politoId,
      program: users.program,
      updated_at: users.updatedAt,
      role_id: roles.id,
      role_member_id: roles.memberId,
      dept_id: roles.deptId,
      division_id: roles.divisionId,
      title: roles.title,
      started_at: roles.startedAt,
      leaved_at: roles.leavedAt,
      type: roles.type,
      department_id: departments.id,
      department_name: departments.name,
      department_started_at: departments.startedAt,
      department_closed_at: departments.closedAt,
      department_code: departments.code,
      division_name: divisions.name,
      division_started_at: divisions.startedAt,
      division_closed_at: divisions.closedAt,
      division_code: divisions.code,
      division_dept_id: divisions.deptId,
    })
    .from(members)
    .leftJoin(users, eq(users.member, members.memberId))
    .leftJoin(roles, eq(roles.memberId, members.memberId))
    .leftJoin(departments, eq(roles.deptId, departments.id))
    .leftJoin(divisions, eq(roles.divisionId, divisions.id));
}

function toMemberUser(row: MemberDirectoryRow): Partial<MemberUser> {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email ?? "",
    level_of_study: row.level_of_study,
    linkedin: row.linkedin,
    origin: row.origin,
    polito_id: row.polito_id,
    program: row.program,
    updated_at: row.updated_at,
  };
}

function toMemberRole(row: MemberDirectoryRow): Partial<Role> {
  return {
    id: row.role_id ?? undefined,
    member_id: row.role_member_id,
    dept_id: row.dept_id,
    division_id: row.division_id,
    title: row.title ?? "",
    started_at: row.started_at ?? "",
    leaved_at: row.leaved_at,
    type: row.type,
    departments: row.department_id
      ? {
          id: row.department_id,
          name: row.department_name ?? "",
          started_at: row.department_started_at ?? "",
          closed_at: row.department_closed_at,
          code: row.department_code,
        }
      : null,
    divisions: row.division_id
      ? {
          id: row.division_id,
          dept_id: row.division_dept_id,
          name: row.division_name ?? "",
          started_at: row.division_started_at ?? "",
          closed_at: row.division_closed_at,
          code: row.division_code,
        }
      : null,
  };
}

function createViewerAccess(userRoles: Role[]): ViewerAccess {
  const access: ViewerAccess = {
    canViewAll: false,
    departmentIds: new Set<number>(),
    divisionKeys: new Set<string>(),
  };

  for (const role of userRoles) {
    if (role.type === "president") {
      access.canViewAll = true;
      continue;
    }

    if (role.type === "head" && role.dept_id !== null) {
      access.departmentIds.add(role.dept_id);
      continue;
    }

    if (
      role.type === "lead" &&
      role.dept_id !== null &&
      role.division_id !== null
    ) {
      access.divisionKeys.add(`${role.dept_id}:${role.division_id}`);
    }
  }

  return access;
}

function canViewerAccessRole(
  access: ViewerAccess,
  role: Partial<Role>,
): boolean {
  if (access.canViewAll) {
    return true;
  }

  if (role.dept_id !== null && role.dept_id !== undefined) {
    if (access.departmentIds.has(role.dept_id)) {
      return true;
    }
  }

  if (
    role.dept_id !== null &&
    role.dept_id !== undefined &&
    role.division_id !== null &&
    role.division_id !== undefined
  ) {
    return access.divisionKeys.has(`${role.dept_id}:${role.division_id}`);
  }

  return false;
}

export async function getMembersByUserRole() {
  const currentMemberId = await getCurrentMemberId();

  if (!currentMemberId) {
    return { members: [], role: null };
  }

  const userRoles = await getRolesForMember(currentMemberId);

  if (userRoles.length === 0) {
    return { members: [], role: null };
  }

  const allMemberRows = await getMemberDirectoryRows();

  const membersMap = new Map<number, Member>();
  const memberUserEmails = new Map<number, Set<string>>();
  const memberRoleIds = new Map<number, Set<number>>();

  for (const row of allMemberRows) {
    let member = membersMap.get(row.member_id);

    if (!member) {
      member = {
        member_id: row.member_id,
        prt_email: row.prt_email,
        mobile_number: row.mobile_number,
        discord: row.discord,
        nda_signed_at: row.nda_signed_at,
        nda_name: row.nda_name,
        nda_confirmed_by: row.nda_confirmed_by,
        picture: row.picture,
        users: [],
        roles: [],
      };
      membersMap.set(row.member_id, member);
      memberUserEmails.set(row.member_id, new Set());
      memberRoleIds.set(row.member_id, new Set());
    }

    const seenEmails = memberUserEmails.get(row.member_id);
    if (row.user_id && row.email && seenEmails && !seenEmails.has(row.email)) {
      seenEmails.add(row.email);
      member.users?.push(toMemberUser(row));
    }

    const seenRoleIds = memberRoleIds.get(row.member_id);
    if (row.role_id && seenRoleIds && !seenRoleIds.has(row.role_id)) {
      seenRoleIds.add(row.role_id);
      member.roles?.push(toMemberRole(row));
    }
  }

  const viewerAccess = createViewerAccess(userRoles);
  const filteredMembers: Member[] = [];

  for (const member of Array.from(membersMap.values())) {
    if (!member.roles?.length || member.member_id === currentMemberId) {
      continue;
    }

    for (const role of member.roles) {
      if (canViewerAccessRole(viewerAccess, role)) {
        filteredMembers.push({
          ...member,
          roles: [role],
        });
      }
    }
  }

  return {
    members: filteredMembers,
    role: userRoles as Partial<Role>[],
  };
}
