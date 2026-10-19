import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { ApplyPosition } from "./types";
import { getScopeInfoForCurrentUser, getScopeInfoForMember } from "./get-member-scopes";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { PUBLIC_POSITIONS_CACHE_TAG } from "@/lib/cache-tags";
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

// The tag lives in lib/cache-tags.ts, beside the other reads that carry it (issue #397).
export { PUBLIC_POSITIONS_CACHE_TAG };

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

function toApplyPosition(position: PositionSnapshotRow): ApplyPosition {
  return {
    ...position,
    div_code: position.div_code ?? "",
    dept_code: position.dept_code ?? "",
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

/**
 * The same switch for a member the caller has already resolved (the
 * dashboard's identity, issue #397), so the session is not read again.
 * `getScopeInfoForCurrentUser` reads the scope rows of the signed-in user's
 * member; this reads that member's rows directly.
 */
export async function getRecruitmentControlFor(memberId: number | null): Promise<RecruitmentControl> {
  const [scopeInfo, recruitment] = await Promise.all([
    getScopeInfoForMember(memberId, "positions"),
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
 * One position and the recruitment switch, read fresh for the submit (issue
 * #120), never from a cache: the submit must see a position closed a minute
 * ago. Deleted positions are read too, so the page can say the position is
 * not public rather than not found.
 */
export async function getPositionWithRecruitment(id: number): Promise<PositionWithRecruitment> {
  if (!isDatabaseConfigured()) {
    return { status: "database-not-configured" };
  }

  return queryPositionWithRecruitment(id);
}

/**
 * The same read for the position page (issue #395), cached under the public
 * tag, so a position edit, a division code change and the recruitment switch
 * refresh it with updateTag(PUBLIC_POSITIONS_CACHE_TAG) as they refresh
 * /apply. The submit still reads fresh (getPositionWithRecruitment).
 */
export async function getShownPositionWithRecruitment(id: number): Promise<PositionWithRecruitment> {
  if (!isDatabaseConfigured()) {
    return { status: "database-not-configured" };
  }

  return getShownPositionCached(id);
}

async function getShownPositionCached(id: number): Promise<PositionWithRecruitment> {
  "use cache";

  cacheTag(PUBLIC_POSITIONS_CACHE_TAG);
  cacheLife("weeks");

  return queryPositionWithRecruitment(id);
}

async function queryPositionWithRecruitment(id: number): Promise<PositionWithRecruitment> {
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
