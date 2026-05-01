"use server";

import "server-only";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import {
  applicationFiles,
  applications,
  applyPositions,
  departments,
  divisions,
  members,
  users,
} from "@/db/schema";
import {
  getScopeInfoForCurrentUser,
  isEmptyScopeInfo,
  type ScopeInfo,
} from "./get-member-scopes";
import type { Applications } from "./types";

type ApplicationRow = Awaited<ReturnType<typeof getApplicationRows>>[number];

async function getApplicationRows(scopeInfo: ScopeInfo) {
  const db = getDb();
  const cvFiles = alias(applicationFiles, "cv_files");
  const mlFiles = alias(applicationFiles, "ml_files");

  const filters = [isNull(divisions.closedAt), isNull(departments.closedAt)];

  if (!(scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess)) {
    const departmentIds = Array.from(scopeInfo.departmentIds);
    const divisionIds = Array.from(scopeInfo.divisionIds);

    if (!departmentIds.length && !divisionIds.length) {
      return [];
    }

    if (departmentIds.length && divisionIds.length) {
      filters.push(
        or(
          inArray(divisions.id, divisionIds),
          inArray(divisions.deptId, departmentIds),
        )!,
      );
    } else if (divisionIds.length) {
      filters.push(inArray(divisions.id, divisionIds));
    } else if (departmentIds.length) {
      filters.push(inArray(divisions.deptId, departmentIds));
    }
  }

  return db
    .select({
      id: applications.id,
      user_id: applications.userId,
      applied_at: applications.appliedAt,
      status: applications.status,
      custom_answers: applications.customAnswers,
      cv_name: applications.cvName,
      ml_name: applications.mlName,
      user_email: users.email,
      user_first_name: users.firstName,
      user_last_name: users.lastName,
      user_origin: users.origin,
      user_level_of_study: users.levelOfStudy,
      user_polito_id: users.politoId,
      user_program: users.program,
      user_mobile_number: members.mobileNumber,
      position_title: applyPositions.title,
      division: divisions.name,
      div_id: divisions.id,
      department: departments.name,
      dept_id: departments.id,
      cv_file_name: cvFiles.originalFilename,
      cv_file_hash: cvFiles.fileHash,
      ml_file_name: mlFiles.originalFilename,
      ml_file_hash: mlFiles.fileHash,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .leftJoin(members, eq(users.member, members.memberId))
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .leftJoin(cvFiles, eq(applications.cvFileId, cvFiles.id))
    .leftJoin(mlFiles, eq(applications.coverLetterFileId, mlFiles.id))
    .where(and(...filters))
    .orderBy(desc(applications.appliedAt), asc(applications.id));
}

function normalizeNamePart(value: string | null | undefined) {
  return value?.toLowerCase().trim().replace(/\s+/g, " ") || "";
}

function areNamesRelated(a: ApplicationRow, b: ApplicationRow) {
  const aFull = `${normalizeNamePart(a.user_first_name)} ${normalizeNamePart(a.user_last_name)}`.trim();
  const bFull = `${normalizeNamePart(b.user_first_name)} ${normalizeNamePart(b.user_last_name)}`.trim();

  if (!aFull || !bFull) {
    return false;
  }

  return aFull === bFull || aFull.includes(bFull) || bFull.includes(aFull);
}

function toRelatedApplication(row: ApplicationRow) {
  return {
    id: row.id,
    status: row.status,
    applied_at: row.applied_at,
    position_title: row.position_title ?? "",
    division: row.division ?? "",
    department: row.department ?? "",
    division_lead_name: undefined,
    user_email: row.user_email ?? "",
    user_first_name: row.user_first_name ?? "",
    user_last_name: row.user_last_name ?? "",
  };
}

function transformApplications(rows: ApplicationRow[]): Applications[] {
  const applicationsByUser = new Map<string, ApplicationRow[]>();

  for (const row of rows) {
    const key = row.user_id ?? `unknown-${row.id}`;
    const existing = applicationsByUser.get(key) ?? [];
    existing.push(row);
    applicationsByUser.set(key, existing);
  }

  return rows.map((row) => {
    const sameUserRows = applicationsByUser.get(row.user_id ?? `unknown-${row.id}`) ?? [];
    const otherApplications = sameUserRows
      .filter((candidate) => candidate.id !== row.id)
      .map(toRelatedApplication);

    const similarApplications = rows
      .filter((candidate) => candidate.id !== row.id)
      .filter((candidate) => candidate.user_id !== row.user_id)
      .filter((candidate) => areNamesRelated(row, candidate))
      .map(toRelatedApplication);

    return {
      id: row.id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      status: row.status,
      custom_answers: row.custom_answers ?? [],
      user_email: row.user_email ?? "",
      user_first_name: row.user_first_name ?? "",
      user_last_name: row.user_last_name ?? "",
      user_origin: row.user_origin ?? "",
      user_level_of_study: row.user_level_of_study ?? "",
      user_polito_id: row.user_polito_id ?? "",
      user_program: row.user_program ?? "",
      user_gender: "",
      user_date_of_birth: "",
      user_mobile_number: row.user_mobile_number ?? "",
      user_polito_email: "",
      position_title: row.position_title ?? "",
      division: row.division ?? "",
      div_id: row.div_id ?? 0,
      department: row.department ?? "",
      dept_id: row.dept_id ?? 0,
      cv_name: row.cv_file_name ?? row.cv_name ?? null,
      cv_file_hash: row.cv_file_hash ?? null,
      ml_name: row.ml_file_name ?? row.ml_name ?? null,
      ml_file_hash: row.ml_file_hash ?? null,
      other_applications: otherApplications,
      similar_applications: similarApplications,
    };
  });
}

export async function getApplicationsByMemberScope(): Promise<{
  applications: Applications[];
}> {
  const scopeInfo = await getScopeInfoForCurrentUser("applications");

  if (isEmptyScopeInfo(scopeInfo)) {
    return { applications: [] };
  }

  const rows = await getApplicationRows(scopeInfo);
  return { applications: transformApplications(rows) };
}
