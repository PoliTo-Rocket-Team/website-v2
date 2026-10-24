// Tester sign-in (issues #129, #230, #608). A reviewer or an agent signs in,
// without Google, as one of the seeded accounts of lib/seeded-accounts.ts and
// gets a real Better Auth session, so every page and write runs the real
// code. Every tester code path asks `testerSignInOn()` first. It is on in two
// places only: under `next dev` off Vercel (the Neon `development` branch,
// Owner decision on #597), and on a Vercel preview whose database is the
// shared `preview` branch. On production, on any other Vercel environment,
// on a preview pointed at another database and under the test runner it is
// off, so the sign-in route is not registered at all.

import { isPreviewDatabase } from "@/lib/seed/target";

/** The three variables the gate reads. */
export type GateEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
  readonly DATABASE_URL?: string;
};

function processGateEnv(): GateEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

/**
 * Whether tester sign-in is on: under `next dev` (NODE_ENV "development")
 * with no Vercel environment, or on a Vercel preview whose `DATABASE_URL` is
 * the shared `preview` branch (`isPreviewDatabase`). Never on production or
 * any other Vercel environment.
 */
export function testerSignInOn(env: GateEnv = processGateEnv()): boolean {
  const localDev = env.NODE_ENV === "development" && !env.VERCEL_ENV;
  const sharedPreview = env.VERCEL_ENV === "preview" && isPreviewDatabase(env.DATABASE_URL);
  return localDev || sharedPreview;
}

export const TESTER_KEYS = [
  "applicant",
  "member",
  "division-lead",
  "department-head",
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

// Seeded by db/seed/people.ts, which reads these ids and emails. Four of them
// are also seats of lib/seeded-accounts.ts, whose table the sign-in lists.
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
    sees: "A member of Test Bench with no scopes. Reaches /dashboard with no edit rights.",
  },
  "division-lead": {
    key: "division-lead",
    id: "7e57e500-0000-4000-8000-000000000003",
    email: "division-lead.tester@example.com",
    name: "Tester Division Lead",
    sees: "Leads Test Bench. Edits that division's positions and applications by the lead role alone.",
  },
  "department-head": {
    key: "department-head",
    id: "7e57e500-0000-4000-8000-000000000005",
    email: "department-head.tester@example.com",
    name: "Tester Department Head",
    sees: "Heads Research and Development, whose one division has nobody yet (issue #230).",
  },
  "operations-lead": {
    key: "operations-lead",
    id: "7e57e500-0000-4000-8000-000000000004",
    email: "operations-lead.tester@example.com",
    name: "Tester Operations Lead",
    sees: "Holds the operations lead's full-access seat, by the role alone.",
  },
};

export function isTesterKey(value: string): value is TesterKey {
  return (TESTER_KEYS as readonly string[]).includes(value);
}
