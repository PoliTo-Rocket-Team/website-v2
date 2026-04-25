import "server-only";

import { cacheLife, cacheTag, revalidatePath } from "next/cache";
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

function nowMs() {
  return performance.now();
}

function formatMs(value: number) {
  return `${value.toFixed(1)}ms`;
}

function logPositionsTiming(
  label: string,
  timings: Record<string, number>,
  extra?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const summary = Object.entries(timings)
    .map(([key, value]) => `${key}=${formatMs(value)}`)
    .join(" ");

  console.info(`[positions] ${label} ${summary}`, extra ?? "");
}

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

async function getPositionSnapshot(): Promise<PositionSnapshotRow[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(POSITIONS_CACHE_TAG);

  const db = getDb();

  return db
    .select(basePositionSelection())
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(
      and(
        eq(applyPositions.isDeleted, false),
        isNull(divisions.closedAt),
        isNull(departments.closedAt),
      ),
    )
    .orderBy(asc(divisions.deptId), asc(applyPositions.title));
}

async function getScopedPositionSnapshot(
  departmentIds: number[],
  divisionIds: number[],
): Promise<PositionSnapshotRow[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(POSITIONS_CACHE_TAG);

  if (!departmentIds.length && !divisionIds.length) {
    return [];
  }

  const db = getDb();
  const scopeFilters = [];

  if (divisionIds.length) {
    scopeFilters.push(inArray(applyPositions.divisionId, divisionIds));
  }

  if (departmentIds.length) {
    scopeFilters.push(inArray(divisions.deptId, departmentIds));
  }

  return db
    .select(basePositionSelection())
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(
      and(
        eq(applyPositions.isDeleted, false),
        isNull(divisions.closedAt),
        isNull(departments.closedAt),
        or(...scopeFilters),
      ),
    )
    .orderBy(asc(divisions.deptId), asc(applyPositions.title));
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

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  const cause =
    "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;

  if (
    message.includes("ECONNREFUSED") ||
    message.includes("connect ECONNREFUSED")
  ) {
    return true;
  }

  return cause instanceof Error
    ? cause.message.includes("ECONNREFUSED") ||
        cause.message.includes("connect ECONNREFUSED")
    : false;
}

export function revalidatePositionsPage() {
  revalidatePath("/dashboard/positions");
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
  databaseUnavailable: boolean;
  positions: ApplyPosition[];
}> {
  const requestStartedAt = nowMs();
  const memberId = await getCurrentMemberId();
  const memberIdAt = nowMs();

  if (!memberId) {
    logPositionsTiming("scoped.no-member", {
      total: memberIdAt - requestStartedAt,
      getCurrentMemberId: memberIdAt - requestStartedAt,
    });
    return { databaseUnavailable: false, positions: [] };
  }

  const scopeInfo = await getScopeInfoForMember(memberId, "positions");
  const scopeAt = nowMs();
  const hasFullVisibility = scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess;
  const departmentIds = Array.from(scopeInfo.departmentIds);
  const divisionIds = Array.from(scopeInfo.divisionIds);

  try {
    const visiblePositions = hasFullVisibility
      ? await getPositionSnapshot()
      : await getScopedPositionSnapshot(departmentIds, divisionIds);
    const positionsAt = nowMs();

    if (!hasFullVisibility && visiblePositions.length === 0) {
      logPositionsTiming(
        "scoped.empty",
        {
          total: positionsAt - requestStartedAt,
          getCurrentMemberId: memberIdAt - requestStartedAt,
          getScopeInfo: scopeAt - memberIdAt,
          getPositions: positionsAt - scopeAt,
        },
        {
          hasFullVisibility,
          departmentIds: departmentIds.length,
          divisionIds: divisionIds.length,
        },
      );
      return { databaseUnavailable: false, positions: [] };
    }

    const mappedPositions = mapPositionsWithEditScope(visiblePositions, scopeInfo);
    const mappedAt = nowMs();

    logPositionsTiming(
      "scoped.success",
      {
        total: mappedAt - requestStartedAt,
        getCurrentMemberId: memberIdAt - requestStartedAt,
        getScopeInfo: scopeAt - memberIdAt,
        getPositions: positionsAt - scopeAt,
        mapPositions: mappedAt - positionsAt,
      },
      {
        hasFullVisibility,
        departmentIds: departmentIds.length,
        divisionIds: divisionIds.length,
        rows: mappedPositions.length,
      },
    );

    return {
      databaseUnavailable: false,
      positions: mappedPositions,
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    console.warn("Database unavailable while loading scoped positions");
    return { databaseUnavailable: true, positions: [] };
  }
}

export async function getPositionsPageData(): Promise<{
  databaseUnavailable: boolean;
  editableDivisions: Division[];
  positions: ApplyPosition[];
}> {
  const requestStartedAt = nowMs();
  const scopeInfo = await getScopeInfoForCurrentUser("positions");
  const scopeAt = nowMs();
  if (isEmptyScopeInfo(scopeInfo)) {
    logPositionsTiming("page.empty-scope", {
      total: scopeAt - requestStartedAt,
      getScopeInfo: scopeAt - requestStartedAt,
    });
    return {
      databaseUnavailable: false,
      editableDivisions: [],
      positions: [],
    };
  }

  const hasFullVisibility = scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess;
  const departmentIds = Array.from(scopeInfo.departmentIds);
  const divisionIds = Array.from(scopeInfo.divisionIds);

  try {
    const [positions, editableDivisions] = await Promise.all([
      hasFullVisibility
        ? getPositionSnapshot()
        : getScopedPositionSnapshot(departmentIds, divisionIds),
      getEditableDivisionsForScope(scopeInfo),
    ]);
    const queriesAt = nowMs();

    const mappedPositions = mapPositionsWithEditScope(positions, scopeInfo);
    const mappedAt = nowMs();

    logPositionsTiming(
      "page.success",
      {
        total: mappedAt - requestStartedAt,
        getScopeInfo: scopeAt - requestStartedAt,
        getPageQueries: queriesAt - scopeAt,
        mapPositions: mappedAt - queriesAt,
      },
      {
        hasFullVisibility,
        departmentIds: departmentIds.length,
        divisionIds: divisionIds.length,
        rows: mappedPositions.length,
        editableDivisions: editableDivisions.length,
      },
    );

    return {
      databaseUnavailable: false,
      editableDivisions,
      positions: mappedPositions,
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    console.warn("Database unavailable while loading positions dashboard data");
    return {
      databaseUnavailable: true,
      editableDivisions: [],
      positions: [],
    };
  }
}

export async function getPublicPositions(): Promise<{
  databaseUnavailable: boolean;
  positions: ApplyPosition[];
}> {
  try {
    const positions = await getPositionSnapshot();

    return {
      databaseUnavailable: false,
      positions: positions
        .filter((position) => position.status)
        .map((position) => toApplyPosition(position)),
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    console.warn("Database unavailable while loading public positions");
    return { databaseUnavailable: true, positions: [] };
  }
}
