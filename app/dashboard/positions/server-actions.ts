"use server";

import { and, eq, isNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import {
  POSITIONS_CACHE_TAG,
  PUBLIC_POSITIONS_CACHE_TAG,
  type PositionSnapshotRow,
} from "@/app/actions/get-apply-positions";
import { ApplyPosition } from "@/app/actions/types";
import { getDb } from "@/db/client";
import { applyPositions, departments, divisions } from "@/db/schema";
import { getAuditDb } from "@/lib/db-audit";

type PositionMutation = Partial<{
  title: string;
  description: string;
  status: boolean;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
}>;

type NewPositionInput = {
  title: string;
  description: string;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
  requires_motivation_letter: boolean;
  division_id: number;
};

function getPositionSelection() {
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

function toApplyPosition(row: PositionSnapshotRow): ApplyPosition {
  return {
    ...row,
    div_code: row.div_code ?? "",
    dept_code: row.dept_code ?? "",
    canEdit: true,
  };
}

function buildPositionMutation(updatedData: PositionMutation) {
  return {
    title: updatedData.title,
    description: updatedData.description,
    status: updatedData.status,
    requiredSkills: updatedData.required_skills,
    desirableSkills: updatedData.desirable_skills,
    customQuestions: updatedData.custom_questions,
  };
}

function buildNewPositionValues(data: NewPositionInput) {
  return {
    title: data.title,
    description: data.description,
    requiredSkills: data.required_skills,
    desirableSkills: data.desirable_skills,
    customQuestions: data.custom_questions,
    requiresMotivationLetter: data.requires_motivation_letter,
    divisionId: data.division_id,
    status: true,
    isDeleted: false,
  };
}

async function getPositionById(id: number): Promise<ApplyPosition | null> {
  const db = getDb();
  const [row] = await db
    .select(getPositionSelection())
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(
      and(
        eq(applyPositions.id, id),
        isNull(divisions.closedAt),
        isNull(departments.closedAt),
      ),
    )
    .limit(1);

  return row ? toApplyPosition(row) : null;
}

function invalidatePositionCaches() {
  updateTag(POSITIONS_CACHE_TAG);
  updateTag(PUBLIC_POSITIONS_CACHE_TAG);
}

export async function handleDelete(id: number) {
  const db = await getAuditDb();

  await db
    .update(applyPositions)
    .set({ isDeleted: true })
    .where(eq(applyPositions.id, id));

  invalidatePositionCaches();
}

export async function handleEditPosition(
  id: number,
  updatedData: PositionMutation,
) {
  const db = await getAuditDb();

  await db
    .update(applyPositions)
    .set(buildPositionMutation(updatedData))
    .where(eq(applyPositions.id, id));

  invalidatePositionCaches();
}

export async function handleAddPosition(
  data: NewPositionInput,
): Promise<ApplyPosition> {
  const db = await getAuditDb();
  const insertedRows = await db
    .insert(applyPositions)
    .values(buildNewPositionValues(data))
    .returning({ id: applyPositions.id });
  const [insertedData] = insertedRows;

  if (!insertedData) {
    throw new Error("No data returned after inserting position");
  }

  const applyPosition = await getPositionById(insertedData.id);

  if (!applyPosition) {
    throw new Error("Inserted position could not be loaded");
  }

  invalidatePositionCaches();

  return applyPosition;
}
