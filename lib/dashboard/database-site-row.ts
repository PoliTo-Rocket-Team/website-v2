import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betterAuthUsers, users } from "@/db/schema";
import { siteRowStepOf, type SiteRowStep } from "./site-row";

// The site row a new session repairs before the dashboard reads it (issue
// #910); the rule is ./site-row.ts. lib/auth.ts runs this from Better Auth's
// session hook, before any request of that session reads the identity
// (./database.ts `readIdentity`). Not marked server-only, as lib/auth.ts is
// not. Nobody is signed in yet, so the writes are logged under no account,
// as the `sync_auth_users` trigger's own are.

/** A `users` row's id, named with its table, so a subquery on another table cannot read it as its own. */
const rowId = sql`${users}.${sql.identifier(users.id.name)}`;

/** Whether a login holds the `users` row: a `better_auth."user"` with its id. */
const heldByLogin = sql<boolean>`exists (select 1 from ${betterAuthUsers} as login where login.id = ${rowId})`;

/** The row's email matches `email` whatever the case and the spaces around either (`sameEmail`). */
const emailIs = (email: string): SQL => sql`lower(trim(${users.email})) = lower(trim(${email}))`;

/**
 * Postgres' foreign_key_violation. `applications.user_id`,
 * `application_files.user_id` and `logs.changed_by` reference `users.id`
 * with no `ON UPDATE CASCADE`, so a row they point at cannot take a new id.
 */
const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === FOREIGN_KEY_VIOLATION) return true;
  }
  return false;
}

/**
 * Gives the login `loginId` a `public.users` row when it has none, and
 * answers the step it took; null when no such login exists. The rows are
 * read first and the step chosen on them (`siteRowStepOf`). Taking over a
 * row is guarded again in the write: it lands only while the row is still
 * free, unclosed and on the login's email, and while the login still has no
 * row. A row whose id other tables still reference without following an id
 * change refuses the take-over, and is then left as it is. Whenever the
 * take-over does not land, a fresh row is inserted unless the login has one
 * by then, so a take-over another sign-in raced past or the database refused
 * ends with a fresh row, and two sessions opened at once leave one row.
 */
export async function ensureSiteRow(loginId: string): Promise<SiteRowStep | null> {
  const db = getDb();
  const [login] = await db
    .select({ id: betterAuthUsers.id, email: betterAuthUsers.email })
    .from(betterAuthUsers)
    .where(eq(betterAuthUsers.id, loginId))
    .limit(1);
  if (login === undefined) return null;

  const rows = await db
    .select({ id: users.id, email: users.email, heldByLogin, closed: sql<boolean>`${users.deletedAt} is not null` })
    .from(users)
    .where(or(eq(users.id, login.id), emailIs(login.email)));
  const step = siteRowStepOf(login, rows);
  if (step.kind === "present") return step;

  // Id and email only, as the trigger makes a row.
  const create = db
    .insert(users)
    .values({ id: login.id, email: login.email, updatedAt: sql`now()` })
    .onConflictDoNothing({ target: users.id });
  if (step.kind === "create") {
    await create;
    return step;
  }
  const attached = await db
    .update(users)
    .set({ id: login.id, updatedAt: sql`now()` })
    .where(
      and(
        eq(users.id, step.rowId),
        isNull(users.deletedAt),
        emailIs(login.email),
        sql`not ${heldByLogin}`,
        sql`not exists (select 1 from ${users} as own where own.id = ${login.id})`,
      ),
    )
    .returning({ id: users.id })
    .catch((error: unknown) => {
      if (isForeignKeyViolation(error)) return [];
      throw error;
    });
  if (attached.length === 1) return step;
  await create;
  return { kind: "create" };
}
