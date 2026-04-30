import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
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

export const POSITIONS_CACHE_TAG = "apply-positions";
export const PUBLIC_POSITIONS_CACHE_TAG = "public-apply-positions";

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

async function queryPositionSnapshot(
  activeOnly = false,
): Promise<PositionSnapshotRow[]> {
  const db = getDb();

  const whereClauses = [
    eq(applyPositions.isDeleted, false),
    isNull(divisions.closedAt),
    isNull(departments.closedAt),
    activeOnly ? eq(applyPositions.status, true) : undefined,
  ];

  return db
    .select(basePositionSelection())
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(...whereClauses))
    .orderBy(asc(divisions.deptId), asc(applyPositions.title));
}

async function queryAllPositionSnapshot(): Promise<PositionSnapshotRow[]> {
  return queryPositionSnapshot();
}

async function queryActivePositionSnapshot(): Promise<PositionSnapshotRow[]> {
  return queryPositionSnapshot(true);
}

async function getAllPositionSnapshotCached(): Promise<PositionSnapshotRow[]> {
  "use cache";

  cacheTag(POSITIONS_CACHE_TAG);
  cacheLife("weeks");

  return queryAllPositionSnapshot();
}

async function getActivePositionSnapshotCached(): Promise<
  PositionSnapshotRow[]
> {
  "use cache";

  cacheTag(PUBLIC_POSITIONS_CACHE_TAG);
  cacheLife("weeks");

  return queryActivePositionSnapshot();
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

function filterPositionSnapshotByScope(
  positions: PositionSnapshotRow[],
  departmentIds: number[],
  divisionIds: number[],
): PositionSnapshotRow[] {
  if (!departmentIds.length && !divisionIds.length) {
    return [];
  }

  const departmentIdSet = new Set(departmentIds);
  const divisionIdSet = new Set(divisionIds);

  return positions.filter(
    (position) =>
      (position.division_id !== null &&
        divisionIdSet.has(position.division_id)) ||
      departmentIdSet.has(position.dept_id),
  );
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
  const allPositions = await getAllPositionSnapshotCached();
  const visiblePositions = hasFullVisibility
    ? allPositions
    : filterPositionSnapshotByScope(allPositions, departmentIds, divisionIds);

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

  const [allPositions, editableDivisions] = await Promise.all([
    getAllPositionSnapshotCached(),
    getEditableDivisionsForScope(scopeInfo),
  ]);
  const positions = hasFullVisibility
    ? allPositions
    : filterPositionSnapshotByScope(allPositions, departmentIds, divisionIds);

  return {
    editableDivisions,
    positions: mapPositionsWithEditScope(positions, scopeInfo),
  };
}

export async function getPublicPositions(): Promise<{
  positions: ApplyPosition[];
}> {
  const positions = await getActivePositionSnapshotCached();

  return {
    positions: positions.map((position) => toApplyPosition(position)),
  };
}
