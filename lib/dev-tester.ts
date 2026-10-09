// Local-only tester sign-in (issue #129). On `next dev`, a reviewer can sign
// in as one of four seeded testers to see signed-in pages without a Google
// account. Every tester code path asks `testerSignInOn()` first; on previews,
// production and under the test runner it is off, so the sign-in route is not
// registered at all.

/** The two variables the gate reads. */
export type GateEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
};

function processGateEnv(): GateEnv {
  return { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
}

/**
 * Whether tester sign-in is on: only under `next dev` (NODE_ENV
 * "development") and never on a Vercel deploy (VERCEL_ENV set).
 */
export function testerSignInOn(env: GateEnv = processGateEnv()): boolean {
  return env.NODE_ENV === "development" && !env.VERCEL_ENV;
}

export const TESTER_KEYS = [
  "applicant",
  "member",
  "division-lead",
  "operations-lead",
] as const;

export type TesterKey = (typeof TESTER_KEYS)[number];

export type Tester = {
  readonly key: TesterKey;
  /** Shared by the `better_auth.user` and `public.users` rows. */
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** What signing in as this tester shows, in one line. */
  readonly sees: string;
};

// Seeded by db/seed.sql; the ids and emails there must match these.
export const TESTERS: Readonly<Record<TesterKey, Tester>> = {
  applicant: {
    key: "applicant",
    id: "7e57e500-0000-4000-8000-000000000001",
    email: "applicant.tester@example.com",
    name: "Tester Applicant",
    sees: "Not a member. Sees the application form on an open /apply/<slug>.",
  },
  member: {
    key: "member",
    id: "7e57e500-0000-4000-8000-000000000002",
    email: "member.tester@example.com",
    name: "Tester Member",
    sees: "A member of Mission Analysis with no scopes. Reaches /dashboard with no edit rights.",
  },
  "division-lead": {
    key: "division-lead",
    id: "7e57e500-0000-4000-8000-000000000003",
    email: "division-lead.tester@example.com",
    name: "Tester Division Lead",
    sees: "Leads Mission Analysis. Edits that division's positions and applications.",
  },
  "operations-lead": {
    key: "operations-lead",
    id: "7e57e500-0000-4000-8000-000000000004",
    email: "operations-lead.tester@example.com",
    name: "Tester Operations Lead",
    sees: "In Operations, with org-wide edit on positions (the recruitment switch).",
  },
};

export function isTesterKey(value: string): value is TesterKey {
  return (TESTER_KEYS as readonly string[]).includes(value);
}
