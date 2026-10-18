import { team } from "./team";
import type { Person, Photo } from "./types";

// This year's team members whose photo the current public site shows (issue
// #371). The Team page draws a member's circle from `members.picture`, so a
// member who never uploaded a photo shows the PRT mark there, even when the
// site already holds their photo in public/team/. team.ts names each of them
// with that photo; the seed writes it on their member row for previews, and
// migration drizzle/0041_current_site_photos.sql holds `memberPhotoSql`,
// which writes it on the matching member row in production. Advisors are not
// members: their photos are on their alumni entries (drizzle/0035).

/** A member, by the name team.ts gives them, and their photo in public/team/. */
export type MemberPhoto = { readonly name: string; readonly photo: Photo };

const isSitePhoto = (photo: Person["photo"]): photo is Photo => photo?.startsWith("/team/") ?? false;

/** Everyone team.ts places on the org chart or in Departments with a photo of the site, once each, in page order. */
function membersWithPhotos(): MemberPhoto[] {
  const people: Person[] = [team.orgChart.leader, ...team.orgChart.leaders];
  for (const group of team.departments.groups)
    for (const member of group.members) people.push(member, ...(member.kind === "head" ? member.leads : []));
  const byName = new Map<string, MemberPhoto>();
  for (const { name, photo } of people) if (isSitePhoto(photo) && !byName.has(name)) byName.set(name, { name, photo });
  return [...byName.values()];
}

export const memberPhotos: readonly MemberPhoto[] = membersWithPhotos();

/** A SQL string literal, its quotes doubled. */
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** How the statement reads a user's name: first and last name, trimmed and lower case. */
const nameIn = (table: string) => `lower(btrim(concat_ws(' ', "${table}"."first_name", "${table}"."last_name")))`;

/**
 * One statement that gives each member their photo when their row has none:
 * a member who uploaded their own keeps it. A member is matched by their
 * user's name, and only when exactly one live user has that name, so a
 * shared name writes nothing.
 */
export function memberPhotoSql(photos: readonly MemberPhoto[] = memberPhotos): string {
  const rows = photos.map(({ name, photo }) => `(${literal(name.toLowerCase())}, ${literal(photo)})`).join(", ");
  return [
    `UPDATE "members" SET "picture" = "photo"."src"`,
    `FROM "users", (VALUES ${rows}) AS "photo" ("name", "src")`,
    `WHERE "users"."member" = "members"."member_id"`,
    `AND "users"."deleted_at" IS NULL`,
    `AND ${nameIn("users")} = "photo"."name"`,
    `AND (SELECT count(*) FROM "users" AS "same" WHERE "same"."deleted_at" IS NULL AND ${nameIn("same")} = "photo"."name") = 1`,
    `AND ("members"."picture" IS NULL OR btrim("members"."picture") = '');`,
  ].join("\n");
}
