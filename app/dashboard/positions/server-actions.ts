"use server";

import { and, eq, isNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import { POSITIONS_CACHE_TAG } from "@/app/actions/get-apply-positions";
import { ApplyPosition } from "@/app/actions/types";
import { getDb } from "@/db/client";
import { applyPositions, departments, divisions } from "@/db/schema";
import { withAuditUser } from "@/lib/db-audit";

type PositionMutation = Partial<{
  title: string;
  description: string;
  status: boolean;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
}>;

async function getPositionById(id: number): Promise<ApplyPosition | null> {
  const db = getDb();
  const [row] = await db
    .select({
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
    })
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

  return row
    ? {
        ...row,
        div_code: row.div_code ?? "",
        dept_code: row.dept_code ?? "",
        canEdit: true,
      }
    : null;
}

export async function handleDelete(id: number) {
  await withAuditUser(async (tx) => {
    await tx
      .update(applyPositions)
      .set({ isDeleted: true })
      .where(eq(applyPositions.id, id));
  });

  updateTag(POSITIONS_CACHE_TAG);
}

export async function handleEditPosition(
  id: number,
  updatedData: PositionMutation,
) {
  await withAuditUser(async (tx) => {
    await tx
      .update(applyPositions)
      .set({
        title: updatedData.title,
        description: updatedData.description,
        status: updatedData.status,
        requiredSkills: updatedData.required_skills,
        desirableSkills: updatedData.desirable_skills,
        customQuestions: updatedData.custom_questions,
      })
      .where(eq(applyPositions.id, id));
  });

  updateTag(POSITIONS_CACHE_TAG);
}

export async function handleAddPosition(data: {
  title: string;
  description: string;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
  requires_motivation_letter: boolean;
  division_id: number;
}): Promise<ApplyPosition> {
  const insertedData = await withAuditUser(async (tx) => {
    const [row] = await tx
      .insert(applyPositions)
      .values({
        title: data.title,
        description: data.description,
        requiredSkills: data.required_skills,
        desirableSkills: data.desirable_skills,
        customQuestions: data.custom_questions,
        requiresMotivationLetter: data.requires_motivation_letter,
        divisionId: data.division_id,
        status: true,
        isDeleted: false,
      })
      .returning({ id: applyPositions.id });

    return row;
  });

  if (!insertedData) {
    throw new Error("No data returned after inserting position");
  }

  const applyPosition = await getPositionById(insertedData.id);

  if (!applyPosition) {
    throw new Error("Inserted position could not be loaded");
  }

  updateTag(POSITIONS_CACHE_TAG);

  return applyPosition;
}
