import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db/client";
import { departments, divisions, members, roles, users } from "@/db/schema";
import { auth } from "@/lib/auth";

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

const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

async function getMemberByUserId(userId: string) {
  "use cache";
  cacheLife("hours");

  const db = getDb();
  const [userData] = await db
    .select({ member: users.member })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userData;
}

async function getRolesForMember(memberId: number) {
  "use cache";
  cacheLife("hours");

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
  "use cache";
  cacheLife("hours");

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

export async function getMembersByUserRole() {
  const session = await getSession();
  const userId = session?.userId;

  if (!userId) {
    return { members: [], role: null };
  }

  const userData = await getMemberByUserId(userId);

  if (!userData?.member) {
    return { members: [], role: null };
  }

  const userRoles = await getRolesForMember(userData.member);

  if (userRoles.length === 0) {
    return { members: [], role: null };
  }

  const allMemberRows = await getMemberDirectoryRows();

  const membersMap = new Map<number, Member>();

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
    }

    if (
      row.user_id &&
      !member.users?.some((existing) => existing.email === row.email)
    ) {
      member.users?.push({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email ?? "",
        level_of_study: row.level_of_study,
        linkedin: row.linkedin,
        origin: row.origin,
        polito_id: row.polito_id,
        program: row.program,
        updated_at: row.updated_at,
      });
    }

    if (
      row.role_id &&
      !member.roles?.some((existing) => existing.id === row.role_id)
    ) {
      member.roles?.push({
        id: row.role_id,
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
      });
    }
  }

  const filteredMembers: Member[] = [];

  for (const userRole of userRoles) {
    for (const member of Array.from(membersMap.values())) {
      if (!member.roles?.length || member.member_id === userData.member) {
        continue;
      }

      for (const role of member.roles ?? []) {
        if (userRole.type === "president") {
          filteredMembers.push({
            ...member,
            roles: [role as Partial<Role>],
          });
        } else if (
          userRole.type === "head" &&
          role.dept_id === userRole.dept_id
        ) {
          filteredMembers.push({
            ...member,
            roles: [role as Partial<Role>],
          });
        } else if (
          userRole.type === "lead" &&
          role.division_id === userRole.division_id &&
          role.dept_id === userRole.dept_id
        ) {
          filteredMembers.push({
            ...member,
            roles: [role as Partial<Role>],
          });
        }
      }
    }
  }

  return {
    members: filteredMembers,
    role: userRoles as Partial<Role>[],
  };
}
