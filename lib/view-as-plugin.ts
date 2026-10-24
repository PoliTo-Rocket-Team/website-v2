import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { createAccessControl } from "better-auth/plugins/access";
import {
  VIEW_AS_REFUSAL_MESSAGES,
  type ViewAsEntry,
  type ViewAsRefusal,
} from "@/lib/dashboard/view-as";
import { impersonatorOf } from "@/lib/session-user";

// View as on Better Auth's admin plugin (issue #604, epic #597). The admin
// plugin starts and stops the impersonated session; this plugin stands in
// front of it:
//
//   POST /api/auth/admin/impersonate-user    asks the View as gate first
//                                            (lib/dashboard/view-as.ts) and
//                                            refuses before any session is
//                                            made; a start that succeeds is
//                                            logged once.
//   POST /api/auth/admin/stop-impersonating  a stop that succeeds is logged
//   POST /api/auth/sign-out                  once, as is signing out of a
//                                            View as session.

const IMPERSONATE = "/admin/impersonate-user";
const STOPS: readonly string[] = ["/admin/stop-impersonating", "/sign-out"];

/**
 * The admin plugin's own role table. Every role holds "impersonate" and
 * nothing else, so the plugin's check never decides who may start View as
 * (the gate below does, from the IT lead seat), and every other admin
 * endpoint (list, create, ban, set role, set password, remove) is refused to
 * everyone.
 */
const viewAsAccess = createAccessControl({ user: ["impersonate"] } as const);
const viewAsRole = viewAsAccess.newRole({ user: ["impersonate"] });
export const VIEW_AS_ADMIN_ROLES = { admin: viewAsRole, user: viewAsRole };
export const VIEW_AS_ACCESS = viewAsAccess;

/** How long a View as session lasts before the acting account signs in as themselves again: one hour. */
export const VIEW_AS_SESSION_SECONDS = 60 * 60;

/** What the plugin asks the server: who may start View as, and where each start and stop is logged. */
export type ViewAsGate = {
  readonly refusal: (start: {
    readonly actingAccountId: string;
    readonly viewingAs: boolean;
    readonly personId: string;
  }) => Promise<ViewAsRefusal | null>;
  readonly record: (entry: ViewAsEntry) => Promise<void>;
};

/** The View as session a stop is ending, carried from the before hook to the after hook. */
type Ending = { readonly viewAsEnding?: Omit<ViewAsEntry, "event"> };

/** The View as session a successful start answers with; null for an error or any other answer. */
function startedSession(returned: unknown): Omit<ViewAsEntry, "event"> | null {
  if (returned === null || typeof returned !== "object" || returned instanceof APIError) return null;
  const session = (returned as { session?: unknown }).session;
  if (session === null || typeof session !== "object") return null;
  const { id, userId } = session as { id?: unknown; userId?: unknown };
  const actingAccountId = impersonatorOf(session);
  if (typeof id !== "string" || typeof userId !== "string" || actingAccountId === null) return null;
  return { sessionId: id, personId: userId, actingAccountId };
}

export function viewAsPlugin(gate: ViewAsGate) {
  return {
    id: "view-as",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === IMPERSONATE,
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            const personId = typeof ctx.body?.userId === "string" || typeof ctx.body?.userId === "number" ? String(ctx.body.userId) : "";
            const refusal: ViewAsRefusal | null =
              session === null
                ? "signed-out"
                : await gate.refusal({
                    actingAccountId: session.user.id,
                    viewingAs: impersonatorOf(session.session) !== null,
                    personId,
                  });
            if (refusal === "signed-out") throw new APIError("UNAUTHORIZED", { message: VIEW_AS_REFUSAL_MESSAGES[refusal] });
            if (refusal !== null) throw new APIError("FORBIDDEN", { message: VIEW_AS_REFUSAL_MESSAGES[refusal] });
          }),
        },
        {
          matcher: (ctx) => STOPS.includes(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            const actingAccountId = session === null ? null : impersonatorOf(session.session);
            if (session === null || actingAccountId === null) return;
            const ending: Ending = { viewAsEnding: { sessionId: session.session.id, personId: session.user.id, actingAccountId } };
            return { context: ending };
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === IMPERSONATE,
          handler: createAuthMiddleware(async (ctx) => {
            const started = startedSession(ctx.context.returned);
            if (started === null) return;
            await gate.record({ event: "start", ...started });
          }),
        },
        {
          matcher: (ctx) => STOPS.includes(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const ending = (ctx as Ending).viewAsEnding;
            if (ending === undefined || ctx.context.returned instanceof APIError) return;
            await gate.record({ event: "stop", ...ending });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
