import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Division, Scope } from "@/db/types";
import { getCurrentMemberId, getCurrentUserId } from "./get-memberId";
import { getDb } from "@/db/client";
import { departments, divisions, scopes, users } from "@/db/schema";

const SCOPES_CACHE_TAG = "member-scopes";
const DIVISIONS_CACHE_TAG = "open-divisions";

export type ScopeInfo = {
  hasAdminAccess: boolean;
  hasOrgAccess: boolean;
  hasAdminEdit: boolean;
  hasOrgEdit: boolean;
  departmentIds: Set<number>;
  divisionIds: Set<number>;
  editableDepartmentIds: Set<number>;
  editableDivisionIds: Set<number>;
};

function createEmptyScopeInfo(): ScopeInfo {
  return {
    hasAdminAccess: false,
    hasOrgAccess: false,
    hasAdminEdit: false,
    hasOrgEdit: false,
    departmentIds: new Set<number>(),
    divisionIds: new Set<number>(),
    editableDepartmentIds: new Set<number>(),
    editableDivisionIds: new Set<number>(),
  };
}

export function isEmptyScopeInfo(scopeInfo: ScopeInfo): boolean {
  return (
    !scopeInfo.hasAdminAccess &&
    !scopeInfo.hasOrgAccess &&
    !scopeInfo.hasAdminEdit &&
    !scopeInfo.hasOrgEdit &&
    scopeInfo.departmentIds.size === 0 &&
    scopeInfo.divisionIds.size === 0 &&
    scopeInfo.editableDepartmentIds.size === 0 &&
    scopeInfo.editableDivisionIds.size === 0
  );
}

function toScopeRow(scope: typeof scopes.$inferSelect): Scope {
  return {
    id: scope.id,
    member_id: scope.memberId,
    given_by: scope.givenBy,
    scope: scope.scope,
    target: scope.target,
    access_level: scope.accessLevel,
    dept_id: scope.deptId,
    division_id: scope.divisionId,
  };
}

function normalizeDivision(row: {
  id: number;
  name: string;
  code: string | null;
  dept_id: number | null;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
}): Division {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    dept_id: row.dept_id,
    departments: row.department_id
      ? [
          {
            id: row.department_id,
            name: row.department_name ?? "",
            code: row.department_code ?? "",
          },
        ]
      : null,
  };
}

function buildDivisionScopeFilter(
  departmentIds: number[],
  divisionIds: number[],
) {
  const scopeFilters = [];

  if (divisionIds.length) {
    scopeFilters.push(inArray(divisions.id, divisionIds));
  }

  if (departmentIds.length) {
    scopeFilters.push(inArray(divisions.deptId, departmentIds));
  }

  return scopeFilters.length ? or(...scopeFilters) : undefined;
}

function buildScopeInfo(scopesData: Scope[], target: string): ScopeInfo {
  return scopesData.reduce<ScopeInfo>((acc, scope) => {
    const isTargetMatch = scope.target === "all" || scope.target === target;
    if (!isTargetMatch) {
      return acc;
    }

    if (scope.scope === "admin") {
      acc.hasAdminAccess = true;
      if (scope.access_level === "edit") acc.hasAdminEdit = true;
    } else if (scope.scope === "org") {
      acc.hasOrgAccess = true;
      if (scope.access_level === "edit") acc.hasOrgEdit = true;
    } else if (scope.scope === "department" && scope.dept_id !== null) {
      acc.departmentIds.add(scope.dept_id);
      if (scope.access_level === "edit") {
        acc.editableDepartmentIds.add(scope.dept_id);
      }
    } else if (scope.scope === "division" && scope.division_id !== null) {
      acc.divisionIds.add(scope.division_id);
      if (scope.access_level === "edit") {
        acc.editableDivisionIds.add(scope.division_id);
      }
    }

    return acc;
  }, createEmptyScopeInfo());
}

async function getScopeRowsForMember(memberId: number): Promise<Scope[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(SCOPES_CACHE_TAG);

  const db = getDb();
  const scopeRows = await db
    .select()
    .from(scopes)
    .where(eq(scopes.memberId, memberId));

  return scopeRows.map(toScopeRow);
}

async function getScopeRowsForUserId(userId: string): Promise<Scope[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(SCOPES_CACHE_TAG);

  const db = getDb();
  const scopeRows = await db
    .select({ scope: scopes })
    .from(scopes)
    .innerJoin(users, eq(scopes.memberId, users.member))
    .where(eq(users.id, userId));

  return scopeRows.map((row) => toScopeRow(row.scope));
}

async function getOpenDivisions(): Promise<Division[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(DIVISIONS_CACHE_TAG);

  const db = getDb();
  const divisionRows = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      code: divisions.code,
      dept_id: divisions.deptId,
      department_id: departments.id,
      department_name: departments.name,
      department_code: departments.code,
    })
    .from(divisions)
    .leftJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(isNull(divisions.closedAt), isNull(departments.closedAt)))
    .orderBy(asc(divisions.id));

  return divisionRows.map(normalizeDivision);
}

async function getScopedOpenDivisions(
  departmentIds: number[],
  divisionIds: number[],
): Promise<Division[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(DIVISIONS_CACHE_TAG);

  if (!departmentIds.length && !divisionIds.length) {
    return [];
  }

  const db = getDb();
  const scopeFilter = buildDivisionScopeFilter(departmentIds, divisionIds);

  const divisionRows = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      code: divisions.code,
      dept_id: divisions.deptId,
      department_id: departments.id,
      department_name: departments.name,
      department_code: departments.code,
    })
    .from(divisions)
    .leftJoin(departments, eq(divisions.deptId, departments.id))
    .where(
      and(
        isNull(divisions.closedAt),
        isNull(departments.closedAt),
        scopeFilter,
      ),
    )
    .orderBy(asc(divisions.id));

  return divisionRows.map(normalizeDivision);
}

export async function getScopeInfoForMember(
  memberId: number | null,
  target: string,
): Promise<ScopeInfo> {
  if (!memberId) {
    return createEmptyScopeInfo();
  }

  const scopesData = await getScopeRowsForMember(memberId);
  return buildScopeInfo(scopesData, target);
}

export async function getScopeInfoForCurrentUser(
  target: string,
): Promise<ScopeInfo> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return createEmptyScopeInfo();
  }

  const scopesData = await getScopeRowsForUserId(userId);
  return buildScopeInfo(scopesData, target);
}

export async function getEditableDivisionsForScope(
  scopeInfo: ScopeInfo,
): Promise<Division[]> {
  const hasFullAccess =
    scopeInfo.hasAdminAccess || scopeInfo.hasAdminEdit || scopeInfo.hasOrgEdit;
  const divisionIds = Array.from(scopeInfo.editableDivisionIds);
  const departmentIds = Array.from(scopeInfo.editableDepartmentIds);

  if (!hasFullAccess && !divisionIds.length && !departmentIds.length) {
    return [];
  }

  if (hasFullAccess) {
    return getOpenDivisions();
  }

  return getScopedOpenDivisions(departmentIds, divisionIds);
}

export async function getMemberScopes(): Promise<{ scope: Scope[] }>;
export async function getMemberScopes(
  target: string,
): Promise<{ scope: ScopeInfo }>;
export async function getMemberScopes(
  target?: string,
): Promise<{ scope: Scope[] | ScopeInfo }> {
  const memberId = await getCurrentMemberId();

  if (!memberId) {
    return target ? { scope: createEmptyScopeInfo() } : { scope: [] };
  }

  const scopesData = await getScopeRowsForMember(memberId);

  if (!target) {
    return { scope: scopesData };
  }

  return { scope: await getScopeInfoForMember(memberId, target) };
}

export async function getEditableDivisions(): Promise<Division[]> {
  const memberId = await getCurrentMemberId();
  const scopeInfo = await getScopeInfoForMember(memberId, "positions");
  return getEditableDivisionsForScope(scopeInfo);
}
