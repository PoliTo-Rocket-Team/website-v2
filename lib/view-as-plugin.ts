import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { createAccessControl } from "better-auth/plugins/access";
import {
  VIEW_AS_REFUSAL_MESSAGES,
  VIEW_AS_STOP_REFUSAL_MESSAGES,
  viewAsStopOf,
  type StopSession,
  type ViewAsEntry,
  type ViewAsRefusal,
  type ViewAsStopRefusal,
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
//   POST /api/auth/view-as/stop              the banner's Stop (issue #899):
//                                            ends the View as session and
//                                            signs the acting account's own
//                                            session back in, also once the
//                                            View as session has run out; a
//                                            stop that ends a session is
//                                            logged once, and a refused one
//                                            is logged on the server.
//   POST /api/auth/admin/stop-impersonating  the admin plugin's own stop; a
//   POST /api/auth/sign-out                  stop that succeeds is logged
//                                            once, as is signing out of a
//                                            View as session. Both drop the
//                                            acting account's kept session
//                                            cookie, so nothing signs it back
//                                            in after them, and signing out
//                                            ends that kept session too.

const IMPERSONATE = "/admin/impersonate-user";
const STOPS: readonly string[] = ["/admin/stop-impersonating", "/sign-out"];

/** The admin plugin's cookie that keeps the acting account's own session, signed, while it views as someone. */
const ADMIN_SESSION_COOKIE = "admin_session";

/** The HTTP status each Stop refusal answers with. */
const STOP_REFUSAL_STATUS: Readonly<Record<ViewAsStopRefusal, "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN">> = {
  "signed-out": "UNAUTHORIZED",
  "not-viewing-as": "BAD_REQUEST",
  "own-session-gone": "UNAUTHORIZED",
  "other-acting-account": "FORBIDDEN",
};

/** Writes a failed View as stop to the server log: why it failed, and the accounts involved. */
function logStopFailure(reason: string, detail: Readonly<Record<string, string | null>>): void {
  console.error(`[view-as] stop failed: ${reason}`, detail);
}

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

/** Writes the stop's Activity log entry; a log that fails is written to the server log and never fails the stop, which has already ended the session. */
async function recordStop(gate: ViewAsGate, ending: Omit<ViewAsEntry, "event">): Promise<void> {
  try {
    await gate.record({ event: "stop", ...ending });
  } catch (error) {
    console.error(`[view-as] stop not written to the Activity log: ${error instanceof Error ? error.message : String(error)}`, ending);
  }
}

export function viewAsPlugin(gate: ViewAsGate) {
  return {
    id: "view-as",
    endpoints: {
      stopViewAs: createAuthEndpoint("/view-as/stop", { method: "POST", requireHeaders: true }, async (ctx) => {
        try {
          const keptCookie = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE);
          const kept = await ctx.getSignedCookie(keptCookie.name, ctx.context.secret);
          const [ownToken = "", dontRemember = ""] = typeof kept === "string" ? kept.split(":") : [];
          const ownFound = ownToken === "" ? null : await ctx.context.internalAdapter.findSession(ownToken);
          const own = ownFound !== null && new Date(ownFound.session.expiresAt) > new Date() ? { accountId: ownFound.user.id, found: ownFound } : null;

          const holdsSessionCookie = Boolean(await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret));
          const current = await getSessionFromCtx(ctx);
          const actingAccountId = current === null ? null : impersonatorOf(current.session);
          const session: StopSession<NonNullable<typeof current>> =
            current === null
              ? { kind: holdsSessionCookie ? "ended" : "signed-out" }
              : actingAccountId === null
                ? { kind: "plain" }
                : { kind: "viewing-as", session: current, actingAccountId };

          const stop = viewAsStopOf(session, own);
          if (stop.kind === "refused") {
            const message = VIEW_AS_STOP_REFUSAL_MESSAGES[stop.refusal];
            logStopFailure(message, {
              refusal: stop.refusal,
              sessionId: current?.session.id ?? null,
              personId: current?.user.id ?? null,
              actingAccountId,
              ownSessionAccountId: own?.accountId ?? null,
            });
            throw new APIError(STOP_REFUSAL_STATUS[stop.refusal], { message, code: stop.refusal.toUpperCase().replaceAll("-", "_") });
          }

          if (stop.kind === "end-and-return") {
            await ctx.context.internalAdapter.deleteSession(stop.ending.session.token);
            await recordStop(gate, { sessionId: stop.ending.session.id, personId: stop.ending.user.id, actingAccountId: stop.own.accountId });
          }
          await setSessionCookie(ctx, stop.own.found, dontRemember !== "");
          ctx.setCookie(keptCookie.name, "", { ...keptCookie.attributes, maxAge: 0 });
          if (dontRemember === "") {
            const { name, options } = ctx.context.authCookies.dontRememberToken;
            ctx.setCookie(name, "", { ...options, maxAge: 0 });
          }
          return ctx.json({ ended: stop.kind === "end-and-return", accountId: stop.own.accountId });
        } catch (error) {
          if (!(error instanceof APIError)) logStopFailure(error instanceof Error ? error.message : String(error), {});
          throw error;
        }
      }),
    },
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
            if (ctx.context.returned instanceof APIError) {
              if (ctx.path !== "/sign-out") logStopFailure(ctx.context.returned.message || String(ctx.context.returned.status), { path: ctx.path });
              return;
            }
            // The acting account's kept session cookie goes with the stop or sign-out, so /view-as/stop never signs it back in
            // afterwards. Signing out ends the kept session too: nobody is left signed in behind the one that signed out.
            const kept = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE);
            if (ctx.path === "/sign-out") {
              const keptValue = await ctx.getSignedCookie(kept.name, ctx.context.secret);
              const [keptToken = ""] = typeof keptValue === "string" ? keptValue.split(":") : [];
              if (keptToken !== "") await ctx.context.internalAdapter.deleteSession(keptToken);
            }
            ctx.setCookie(kept.name, "", { ...kept.attributes, maxAge: 0 });
            const ending = (ctx as Ending).viewAsEnding;
            if (ending !== undefined) await recordStop(gate, ending);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
