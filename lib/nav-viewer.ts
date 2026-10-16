import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { members, users } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import { dummyNavViewer } from "@/lib/dummy-data";
import type { NavViewer } from "@/lib/nav-viewer-shape";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";

/**
 * Who the navbar shows as signed in (issues #157, #261): a test developer
 * (previews and `next dev` only, lib/test-developer.ts), else the signed-in
 * account, else nobody. Read at request time by GET /api/viewer, never by a
 * page, so the pages that carry the navbar stay prerendered.
 */
export async function navViewer(): Promise<NavViewer | null> {
  const kind = testDeveloperViewer((await cookies()).get(TEST_DEVELOPER_COOKIE)?.value);
  if (kind !== null) return dummyNavViewer(kind);
  const user = await getCurrentUser();
  return user === null ? null : accountNavViewer(user);
}

/** The account's team address and photo, from its member row; the sign-in address when it has no team one. */
async function accountNavViewer(user: CurrentUser): Promise<NavViewer | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb()
    .select({ email: users.email, prt_email: members.prtEmail, picture: members.picture })
    .from(users)
    .leftJoin(members, eq(users.member, members.memberId))
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) return null;
  const teamEmail = row.prt_email?.trim() ? row.prt_email : null;
  const photoUrl = row.picture?.trim() ? row.picture : null;
  return { name: user.name, email: teamEmail ?? row.email, photoUrl, session: "account" };
}
