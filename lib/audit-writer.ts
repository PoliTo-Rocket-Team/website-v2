// Who a signed-in write is logged under (lib/db-audit.ts), kept apart from
// that file, which talks to the database, so the rule is tested on its own.

import type { CurrentUser } from "@/lib/session-user";

/**
 * The people a write is logged under: `userId`, the signed-in person, and in
 * a View as session (issue #605) `actingAccountId`, the account viewing as
 * them. Both come from the server's session, never from the request.
 */
export type AuditWriter = { readonly userId: string; readonly actingAccountId: string | null };

/** The settings lib/db-audit.ts sets before an audited write, which `public.log_db_changes()` stores (drizzle/0061). */
export const AUDIT_SETTINGS = {
  writer: "request.jwt.claim.sub",
  actingAccount: "request.acting_account",
} as const;

/** Who a write by `user` is logged under, or null when nobody is signed in. */
export function auditWriterFor(user: CurrentUser | null): AuditWriter | null {
  return user === null ? null : { userId: user.id, actingAccountId: user.actingAccountId };
}
