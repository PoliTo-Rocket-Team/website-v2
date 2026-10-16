import "server-only";

import { randomUUID } from "node:crypto";
import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { alumniEntries, alumniImportedRoles, alumniRoleFixes, departments, divisions, roles, users } from "@/db/schema";
import { currentAcademicYearStart } from "@/lib/about/academic-year";
import {
  alumniOf,
  type AlumniEntry,
  type AlumniRecord,
  type Alumnus,
  type AlumnusKey,
  type EntryWho,
} from "@/lib/about/alumni-record";
import type { FounderMark } from "@/lib/about/alumni-types";
import { runAuditBatch } from "@/lib/db-audit";
import { publicPathname } from "@/lib/storage/pathname";
import { deletePublicFile, uploadPublicFile } from "@/lib/storage/public-store";
import { canReach } from "./access";
import { alumniDirectory, checkAdvisor, checkAlumnusFix, alumnusRow, type AlumniDirectory } from "./alumni";
import { storedPhotoPathname } from "./database-self";
import { checkPhoto } from "./self";
import type { ViewerStanding } from "./viewer";
import { TEAM_ROSTER_CACHE_TAG } from "./team-database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The database side of the Alumni pages (issue #257): one cached read of the
// record the public page and the dashboard both build from, and the writes
// of boards 78b and 78c. Every write here touches the alumni tables only:
// never `roles`, `divisions` or `scopes`.

/** Tag for the alumni read; a fix, an added advisor, or a change to who is on the team refreshes it. */
export const ALUMNI_CACHE_TAG = "alumni-page";

const FOUNDER_OF: Readonly<Record<"founder" | "co_founder", FounderMark>> = { founder: "founder", co_founder: "co-founder" };
const FOUNDER_COLUMN: Readonly<Record<FounderMark, "founder" | "co_founder">> = { founder: "founder", "co-founder": "co_founder" };

type EntryRow = typeof alumniEntries.$inferSelect;

function whoOf(row: EntryRow): EntryWho | null {
  switch (row.kind) {
    case "member":
      return row.memberId === null ? null : { kind: "member", memberId: row.memberId, keptName: row.recordName };
    case "imported":
      return row.recordName === null ? null : { kind: "imported", name: row.recordName };
    case "advisor":
      return row.recordName === null || row.advisorRole === null || row.advisorFrom === null || row.advisorTo === null
        ? null
        : { kind: "advisor", name: row.recordName, role: row.advisorRole, from: row.advisorFrom, to: row.advisorTo };
  }
}

async function queryAlumniRecord(): Promise<AlumniRecord> {
  const db = getDb();
  const [departmentRows, divisionRows, roleRows, personRows, entryRows, fixRows, importedRows] = await Promise.all([
    // Closed departments and divisions stay on the page as names.
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.id)),
    db.select({ id: divisions.id, name: divisions.name, departmentId: divisions.deptId }).from(divisions).orderBy(asc(divisions.id)),
    db
      .select({
        memberId: roles.memberId,
        type: roles.type,
        title: roles.title,
        startedAt: roles.startedAt,
        leftAt: roles.leavedAt,
        departmentId: roles.deptId,
        divisionId: roles.divisionId,
      })
      .from(roles),
    db
      .select({ memberId: users.member, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(isNotNull(users.member)),
    db.select().from(alumniEntries).orderBy(asc(alumniEntries.id)),
    db.select().from(alumniRoleFixes),
    db.select().from(alumniImportedRoles).orderBy(asc(alumniImportedRoles.position)),
  ]);
  const entries = entryRows.flatMap((row): AlumniEntry[] => {
    const who = whoOf(row);
    if (who === null) return [];
    return [
      {
        id: row.id,
        who,
        name: row.name,
        founder: row.founder === null ? null : FOUNDER_OF[row.founder],
        photo: row.photo,
        shown: row.shown,
        removed: row.removedAt !== null,
        fixes: fixRows.filter((f) => f.entryId === row.id).map((f) => ({ year: f.year, group: f.groupName, role: f.role })),
      },
    ];
  });
  return {
    units: { departments: departmentRows, divisions: divisionRows },
    roles: roleRows.flatMap((r) => (r.memberId === null ? [] : [{ ...r, memberId: r.memberId }])),
    people: personRows.flatMap((p) =>
      p.memberId === null
        ? []
        : [{ memberId: p.memberId, name: [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || null, email: p.email }],
    ),
    entries,
    imported: importedRows.map((r) => ({ entryId: r.entryId, year: r.year, group: r.groupName, role: r.role, position: r.position })),
  };
}

/** The record, cached and tagged (ADR 0003: full-directory reads are cached, never per view). */
export async function readAlumniRecord(): Promise<AlumniRecord> {
  "use cache";
  cacheTag(ALUMNI_CACHE_TAG, TEAM_ROSTER_CACHE_TAG);
  cacheLife("hours");
  return queryAlumniRecord();
}

/** Everyone the record lists, this academic year included. */
export async function readAlumni(): Promise<Alumnus[]> {
  const [record, year] = await Promise.all([readAlumniRecord(), currentAcademicYearStart()]);
  return alumniOf(record, year);
}

/** Board 78, for a viewer who reaches it. */
export async function readAlumniDirectory(viewer: ViewerStanding): Promise<AlumniDirectory> {
  return alumniDirectory(canReach(viewer, "alumni") ? await readAlumni() : [], await currentAcademicYearStart());
}

/** Fresh, not cached: a write checks against the record as it is now. */
async function findAlumnus(key: AlumnusKey): Promise<Alumnus | null> {
  const alumni = alumniOf(await queryAlumniRecord(), await currentAcademicYearStart());
  return alumni.find((a) => a.key === key && !a.removed) ?? null;
}

function refreshAlumni(): void {
  updateTag(ALUMNI_CACHE_TAG);
}

/** The entry a key names, as SQL: by member for `m12`, by id for `e5`. */
function entryMatch(key: AlumnusKey) {
  const id = Number(key.slice(1));
  return key.startsWith("m") ? eq(alumniEntries.memberId, id) : eq(alumniEntries.id, id);
}

function entryIdOf(key: AlumnusKey) {
  return sql`(select ${alumniEntries.id} from ${alumniEntries} where ${entryMatch(key)})`;
}

type EntrySet = Partial<Pick<EntryRow, "name" | "founder" | "photo" | "shown" | "removedAt">>;

/**
 * Sets columns on the person's entry: a member with none yet gets one, keyed
 * by their member row, so the batch never needs the id it would return.
 */
function upsertEntry(db: ReturnType<typeof getDb>, key: AlumnusKey, set: EntrySet) {
  if (key.startsWith("e")) return db.update(alumniEntries).set(set).where(entryMatch(key));
  return db
    .insert(alumniEntries)
    .values({ kind: "member", memberId: Number(key.slice(1)), ...set })
    .onConflictDoUpdate({ target: alumniEntries.memberId, set });
}

async function setAlumnusShown(viewer: ViewerStanding, key: AlumnusKey, shown: boolean): Promise<boolean> {
  if (!canReach(viewer, "alumni") || (await findAlumnus(key)) === null) return false;
  await runAuditBatch((db) => [upsertEntry(db, key, { shown })]);
  refreshAlumni();
  return true;
}

/** Board 78b's Save: the entry and its per-year role text, in one batch. Roles, divisions and access are not touched. */
async function fixAlumnus(viewer: ViewerStanding, key: AlumnusKey, input: unknown): Promise<WriteResult<null>> {
  if (!canReach(viewer, "alumni")) return refused("You cannot edit the Alumni page.");
  const person = await findAlumnus(key);
  if (person === null) return refused("They are not on the Alumni page.");
  const checked = checkAlumnusFix(input, alumnusRow(person));
  if (!checked.ok) return checked;
  const fix = checked.value;
  await runAuditBatch((db) => [
    upsertEntry(db, key, { shown: fix.shown, name: fix.name, founder: fix.founder === null ? null : FOUNDER_COLUMN[fix.founder] }),
    db.delete(alumniRoleFixes).where(eq(alumniRoleFixes.entryId, entryIdOf(key))),
    ...(fix.fixes.length === 0
      ? []
      : [
          db.insert(alumniRoleFixes).values(
            fix.fixes.map((f) => ({ entryId: entryIdOf(key), year: f.year, groupName: f.group, role: f.role })),
          ),
        ]),
  ]);
  refreshAlumni();
  return written(null);
}

async function uploadAlumniPhoto(photo: Upload): Promise<WriteResult<string>> {
  const error = checkPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
  if (error !== null) return refused(error);
  const ext = photo.contentType === "image/png" ? "png" : "jpg";
  const { url } = await uploadPublicFile(publicPathname("photo", `alumni-${randomUUID()}.${ext}`), photo.bytes, photo.contentType);
  return written(url);
}

/** The fix panel's photo: a new one replaces the old, whose stored file goes; null removes it. */
async function setAlumnusPhoto(viewer: ViewerStanding, key: AlumnusKey, photo: Upload | null): Promise<WriteResult<null>> {
  if (!canReach(viewer, "alumni")) return refused("You cannot edit the Alumni page.");
  const person = await findAlumnus(key);
  if (person === null) return refused("They are not on the Alumni page.");
  const uploaded = photo === null ? written(null) : await uploadAlumniPhoto(photo);
  if (!uploaded.ok) return uploaded;
  await runAuditBatch((db) => [upsertEntry(db, key, { photo: uploaded.value })]);
  const old = storedPhotoPathname(person.photo);
  if (old !== null) await deletePublicFile(old).catch(() => undefined);
  refreshAlumni();
  return written(null);
}

/** Board 78c: an external advisor, in the Advisors group and no other. */
async function addAdvisor(viewer: ViewerStanding, input: unknown, photo: Upload | null): Promise<WriteResult<null>> {
  if (!canReach(viewer, "alumni")) return refused("You cannot edit the Alumni page.");
  const checked = checkAdvisor(input, await currentAcademicYearStart());
  if (!checked.ok) return checked;
  const uploaded = photo === null ? written(null) : await uploadAlumniPhoto(photo);
  if (!uploaded.ok) return uploaded;
  const { name, role, from, to } = checked.value;
  await runAuditBatch((db) => [
    db.insert(alumniEntries).values({
      kind: "advisor",
      recordName: name,
      advisorRole: role,
      advisorFrom: from,
      advisorTo: to,
      photo: uploaded.value,
    }),
  ]);
  refreshAlumni();
  return written(null);
}

/** The Alumni page's writes on the database, for one viewer. */
export function databaseAlumniWrites(viewer: ViewerStanding) {
  return {
    setAlumnusShown: (key: AlumnusKey, shown: boolean) => setAlumnusShown(viewer, key, shown),
    fixAlumnus: (key: AlumnusKey, input: unknown) => fixAlumnus(viewer, key, input),
    setAlumnusPhoto: (key: AlumnusKey, photo: Upload | null) => setAlumnusPhoto(viewer, key, photo),
    addAdvisor: (input: unknown, photo: Upload | null) => addAdvisor(viewer, input, photo),
  };
}
