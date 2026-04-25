import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { ApplyPosition } from "./types";
import { getCurrentMemberId } from "./get-memberId";
import {
  getEditableDivisionsForScope,
  getScopeInfoForCurrentUser,
  getScopeInfoForMember,
  isEmptyScopeInfo,
} from "./get-member-scopes";
import type { Division } from "@/db/types";
import { getDb } from "@/db/client";
import { applyPositions, departments, divisions } from "@/db/schema";

export const POSITIONS_CACHE_TAG = "positions";

export type PositionSnapshotRow = {
  id: number;
  status: boolean;
  division_id: number | null;
  title: string | null;
  description: string | null;
  required_skills: string[] | null;
  desirable_skills: string[] | null;
  custom_questions: string[] | null;
  created_at: string;
  requires_motivation_letter: boolean;
  is_deleted: boolean;
  div_name: string;
  div_code: string | null;
  dept_id: number;
  dept_name: string;
  dept_code: string | null;
};

type PositionSnapshotOptions = {
  departmentIds?: number[];
  divisionIds?: number[];
  activeOnly?: boolean;
};

function basePositionSelection() {
  return {
    id: applyPositions.id,
    status: applyPositions.status,
    division_id: applyPositions.divisionId,
    title: applyPositions.title,
    description: applyPositions.description,
    required_skills: applyPositions.requiredSkills,
    desirable_skills: applyPositions.desirableSkills,
    custom_questions: applyPositions.customQuestions,
    created_at: applyPositions.createdAt,
    requires_motivation_letter: applyPositions.requiresMotivationLetter,
    is_deleted: applyPositions.isDeleted,
    div_name: divisions.name,
    div_code: divisions.code,
    dept_id: departments.id,
    dept_name: departments.name,
    dept_code: departments.code,
  };
}

function buildPositionScopeFilter(
  departmentIds: number[],
  divisionIds: number[],
) {
  const scopeFilters = [];

  if (divisionIds.length) {
    scopeFilters.push(inArray(applyPositions.divisionId, divisionIds));
  }

  if (departmentIds.length) {
    scopeFilters.push(inArray(divisions.deptId, departmentIds));
  }

  return scopeFilters.length ? or(...scopeFilters) : undefined;
}

async function getPositionSnapshot(
  options: PositionSnapshotOptions = {},
): Promise<PositionSnapshotRow[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(POSITIONS_CACHE_TAG);

  const {
    departmentIds = [],
    divisionIds = [],
    activeOnly = false,
  } = options;
  const db = getDb();
  const scopeFilter = buildPositionScopeFilter(departmentIds, divisionIds);

  const whereClauses = [
    eq(applyPositions.isDeleted, false),
    isNull(divisions.closedAt),
    isNull(departments.closedAt),
    activeOnly ? eq(applyPositions.status, true) : undefined,
    scopeFilter,
  ];

  return db
    .select(basePositionSelection())
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(...whereClauses))
    .orderBy(asc(divisions.deptId), asc(applyPositions.title));
}

async function getScopedPositionSnapshot(
  departmentIds: number[],
  divisionIds: number[],
): Promise<PositionSnapshotRow[]> {
  if (!departmentIds.length && !divisionIds.length) {
    return [];
  }

  return getPositionSnapshot({ departmentIds, divisionIds });
}

async function getActivePositionSnapshot(): Promise<PositionSnapshotRow[]> {
  return getPositionSnapshot({ activeOnly: true });
}

function toApplyPosition(
  position: PositionSnapshotRow,
  canEdit?: boolean,
): ApplyPosition {
  return {
    ...position,
    div_code: position.div_code ?? "",
    dept_code: position.dept_code ?? "",
    canEdit,
  };
}

function mapPositionsWithEditScope(
  positions: PositionSnapshotRow[],
  scopeInfo: Awaited<ReturnType<typeof getScopeInfoForMember>>,
): ApplyPosition[] {
  return positions.map((position) => {
    const canEdit =
      scopeInfo.hasAdminEdit ||
      scopeInfo.hasOrgEdit ||
      (position.division_id !== null &&
        scopeInfo.editableDivisionIds.has(position.division_id)) ||
      scopeInfo.editableDepartmentIds.has(position.dept_id);

    return toApplyPosition(position, canEdit);
  });
}

export async function getPositionsByMemberScope(): Promise<{
  positions: ApplyPosition[];
}> {
  const memberId = await getCurrentMemberId();

  if (!memberId) {
    return { positions: [] };
  }

  const scopeInfo = await getScopeInfoForMember(memberId, "positions");
  if (isEmptyScopeInfo(scopeInfo)) {
    return { positions: [] };
  }

  const hasFullVisibility = scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess;
  const departmentIds = Array.from(scopeInfo.departmentIds);
  const divisionIds = Array.from(scopeInfo.divisionIds);

  const visiblePositions = hasFullVisibility
    ? await getPositionSnapshot()
    : await getScopedPositionSnapshot(departmentIds, divisionIds);

  if (!hasFullVisibility && visiblePositions.length === 0) {
    return { positions: [] };
  }

  return {
    positions: mapPositionsWithEditScope(visiblePositions, scopeInfo),
  };
}

export async function getPositionsPageData(): Promise<{
  editableDivisions: Division[];
  positions: ApplyPosition[];
}> {
  const scopeInfo = await getScopeInfoForCurrentUser("positions");
  if (isEmptyScopeInfo(scopeInfo)) {
    return {
      editableDivisions: [],
      positions: [],
    };
  }

  const hasFullVisibility = scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess;
  const departmentIds = Array.from(scopeInfo.departmentIds);
  const divisionIds = Array.from(scopeInfo.divisionIds);

  const [positions, editableDivisions] = await Promise.all([
    hasFullVisibility
      ? getPositionSnapshot()
      : getScopedPositionSnapshot(departmentIds, divisionIds),
    getEditableDivisionsForScope(scopeInfo),
  ]);

  return {
    editableDivisions,
    positions: mapPositionsWithEditScope(positions, scopeInfo),
  };
}

export async function getPublicPositions(): Promise<{
  positions: ApplyPosition[];
}> {
  const positions = await getActivePositionSnapshot();

  return {
    positions: positions.map((position) => toApplyPosition(position)),
  };
}
