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
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  applyPositions,
  departments,
  divisions,
  recruitmentSetting,
} from "@/db/schema";
import {
  DEFAULT_RECRUITMENT,
  isPublic,
  type Recruitment,
} from "@/lib/apply/positions";
import {
  canSwitchRecruitment,
  type RecruitmentControl,
} from "@/lib/apply/recruitment-switch";

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

async function queryPositionSnapshot(): Promise<PositionSnapshotRow[]> {
  const db = getDb();

  const whereClauses = [
    eq(applyPositions.isDeleted, false),
    isNull(divisions.closedAt),
    isNull(departments.closedAt),
  ];

  return db
    .select(basePositionSelection())
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(...whereClauses))
    .orderBy(asc(divisions.deptId), asc(applyPositions.title));
}

/** Postgres' "undefined_table" error: the recruitment migration has not run here yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

// The stored recruitment switch. No row, or no table on a database the
// migration has not reached yet, reads as the default: recruitment on. Only
// the missing table is caught; any other error still throws.
async function queryRecruitment(): Promise<Recruitment> {
  const db = getDb();

  try {
    const [row] = await db
      .select({ isOpen: recruitmentSetting.isOpen })
      .from(recruitmentSetting)
      .limit(1);
    return row ?? DEFAULT_RECRUITMENT;
  } catch (error) {
    if (isUndefinedTable(error)) return DEFAULT_RECRUITMENT;
    throw error;
  }
}

async function getAllPositionSnapshotCached(): Promise<PositionSnapshotRow[]> {
  "use cache";

  cacheTag(POSITIONS_CACHE_TAG);
  cacheLife("weeks");

  return queryPositionSnapshot();
}

// The public read: the positions and the recruitment switch under one tag, so
// a position edit and the dashboard switch (#121) both refresh /apply with
// updateTag(PUBLIC_POSITIONS_CACHE_TAG).
async function getPublicSnapshotCached(): Promise<{
  positions: PositionSnapshotRow[];
  recruitment: Recruitment;
}> {
  "use cache";

  cacheTag(PUBLIC_POSITIONS_CACHE_TAG);
  cacheLife("weeks");

  const [positions, recruitment] = await Promise.all([
    queryPositionSnapshot(),
    queryRecruitment(),
  ]);
  return { positions, recruitment };
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

/**
 * The dashboard's recruitment switch: its stored state, read fresh, and
 * whether the signed-in member may change it. Everyone else sees it read-only.
 */
export async function getRecruitmentControl(): Promise<RecruitmentControl> {
  const [scopeInfo, recruitment] = await Promise.all([
    getScopeInfoForCurrentUser("positions"),
    queryRecruitment(),
  ]);

  return { recruitment, canSwitch: canSwitchRecruitment(scopeInfo) };
}

export type PublicPositions =
  | { status: "available"; positions: ApplyPosition[] }
  | { status: "database-not-configured" };

export async function getPublicPositions(): Promise<PublicPositions> {
  if (!isDatabaseConfigured()) {
    return { status: "database-not-configured" };
  }

  const { positions, recruitment } = await getPublicSnapshotCached();

  return {
    status: "available",
    positions: positions
      .filter((position) => isPublic(position, recruitment))
      .map((position) => toApplyPosition(position)),
  };
}

export type PositionWithRecruitment =
  | { status: "found"; position: ApplyPosition; recruitment: Recruitment }
  | { status: "missing" }
  | { status: "database-not-configured" };

/**
 * One position and the recruitment switch, read fresh for the position page
 * and the submit (issue #120), never from the cached snapshot: the submit
 * must see a position closed a minute ago. Deleted positions are read too,
 * so the page can say the position is not public rather than not found.
 */
export async function getPositionWithRecruitment(id: number): Promise<PositionWithRecruitment> {
  if (!isDatabaseConfigured()) {
    return { status: "database-not-configured" };
  }

  const [[row], recruitment] = await Promise.all([
    getDb()
      .select(basePositionSelection())
      .from(applyPositions)
      .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
      .innerJoin(departments, eq(divisions.deptId, departments.id))
      .where(eq(applyPositions.id, id))
      .limit(1),
    queryRecruitment(),
  ]);

  return row === undefined
    ? { status: "missing" }
    : { status: "found", position: toApplyPosition(row), recruitment };
}
