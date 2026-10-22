import type { DashboardData } from "./data";

/**
 * How a dashboard request opens. A request with no session token is signed
 * out and goes to /login. A request that holds a token but resolves to no
 * account (an expired or unknown session, no `users` row, no database) is
 * never sent to /login: the proxy sends a token holder on /login straight
 * back to /dashboard, so that would loop. It gets its own signed-in state.
 */
export type DashboardOpening =
  | { readonly kind: "open"; readonly data: DashboardData }
  | { readonly kind: "signed-out" }
  | { readonly kind: "account-unresolved" };

export function dashboardOpening(
  data: DashboardData | null,
  holdsSessionToken: boolean,
): DashboardOpening {
  if (data !== null) return { kind: "open", data };
  return holdsSessionToken ? { kind: "account-unresolved" } : { kind: "signed-out" };
}
