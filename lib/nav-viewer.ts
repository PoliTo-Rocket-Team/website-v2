import "server-only";

import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { members, users } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import type { NavViewer } from "@/lib/nav-viewer-shape";

/**
 * Who the navbar shows as signed in (issues #157, #261): the signed-in
 * account, else nobody. Read at request time by GET /api/viewer, never
 * by a page, so the pages that carry the navbar stay prerendered.
 */
export async function navViewer(): Promise<NavViewer | null> {
  const user = await getCurrentUser();
  return user === null ? null : personNavViewer(user);
}

/**
 * The person's sign-in address, always, so the menu tells which Google account
 * is active (issue #683); the member row gives only the photo.
 */
async function personNavViewer(user: CurrentUser): Promise<NavViewer | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb()
    .select({
      email: users.email,
      picture: members.picture,
    })
    .from(users)
    .leftJoin(members, eq(users.member, members.memberId))
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) return null;
  const photoUrl = row.picture?.trim() ? row.picture : null;
  return { name: user.name, email: row.email, photoUrl };
}
