// Shared by lib/dev-tester.test.ts and lib/dev-tester-plugin.test.ts: an
// in-memory Better Auth instance holding every seeded account of
// lib/seeded-accounts.ts, and the environments the tester sign-in gate reads.
// Nothing here is a real secret or reads .env.

import { memoryAdapter } from "better-auth/adapters/memory";
import type { TesterDirectory } from "./dev-tester-plugin";
import type { ViewAsGate } from "./view-as-plugin";
import { PREVIEW_ENDPOINT } from "./seed/target";
import { SEATS, SEEDED_ACCOUNTS } from "./seeded-accounts";

export const TEST_ENV = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "dev-tester-test-secret-0123456789abcdef",
};

export const BASE = "http://localhost:3000/api/auth";
export const ORIGIN = "http://localhost:3000";

/** The shared `preview` branch, pooled and direct; no password. */
export const PREVIEW_DB = `postgresql://app@${PREVIEW_ENDPOINT}-pooler.c-2.eu-central-1.aws.neon.tech/neondb`;
export const PREVIEW_DB_DIRECT = `postgresql://app@${PREVIEW_ENDPOINT}.c-2.eu-central-1.aws.neon.tech/neondb`;
/** A Neon endpoint whose id only starts like the `preview` branch's. */
export const LOOKALIKE_DB = `postgresql://app@${PREVIEW_ENDPOINT}x.c-2.eu-central-1.aws.neon.tech/neondb`;
/** A Neon branch that is not `preview`, standing in for production or any other one. */
export const OTHER_DB = "postgresql://app@ep-other-branch-a1b2c3d4-pooler.c-2.eu-central-1.aws.neon.tech/neondb";

export type EnvVars = Record<string, string | undefined>;

/** Sets each variable, deleting the ones given as undefined. */
export function setEnv(vars: EnvVars): void {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** A copy of process.env now, and the function that puts it back. */
export function envRestorer(): () => void {
  const saved = { ...process.env };
  return () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  };
}

/** Where the gate is on: `next dev` off Vercel, and a preview build of the shared `preview` database. */
export const GATE_ON: readonly EnvVars[] = [
  { NODE_ENV: "development", VERCEL_ENV: undefined, DATABASE_URL: undefined },
  { NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: PREVIEW_DB },
  { NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: PREVIEW_DB_DIRECT },
];

/** Where the gate is off: production, every other Vercel environment, a preview on another database, and the test runner. */
export const GATE_OFF: readonly EnvVars[] = [
  { NODE_ENV: "production", VERCEL_ENV: undefined, DATABASE_URL: undefined },
  { NODE_ENV: "production", VERCEL_ENV: "production", DATABASE_URL: PREVIEW_DB },
  { NODE_ENV: "production", VERCEL_ENV: "production", DATABASE_URL: OTHER_DB },
  { NODE_ENV: "development", VERCEL_ENV: "development", DATABASE_URL: PREVIEW_DB },
  { NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: OTHER_DB },
  { NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: undefined },
  { NODE_ENV: "development", VERCEL_ENV: "preview", DATABASE_URL: OTHER_DB },
  { NODE_ENV: "test", VERCEL_ENV: undefined, DATABASE_URL: undefined },
];

export type MemoryDb = Record<string, Record<string, unknown>[]>;

/** An in-memory database holding every seeded account's `better_auth.user` row, admin testers stored as admins. */
export function seededMemoryDb(): MemoryDb {
  const now = new Date();
  return {
    user: SEEDED_ACCOUNTS.map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      role: account.kind === "admin-tester" ? account.storedRole : null,
    })),
    session: [],
    account: [],
    verification: [],
  };
}

/** The member ids the in-memory database knows: each member seat's, as its `users` row would name it. */
export const SEAT_DIRECTORY: TesterDirectory = {
  memberUserId: async (memberId) => SEATS.find((seat) => seat.memberId === memberId)?.id ?? null,
};

/** The auth instance getAuth() builds, over an in-memory database, under the environment set now. */
export async function memoryAuth(db: MemoryDb = seededMemoryDb(), viewAs?: ViewAsGate, testers: TesterDirectory = SEAT_DIRECTORY) {
  const { createAuth } = await import("./auth");
  return createAuth(memoryAdapter(db), viewAs, testers);
}

/** The cookies a browser keeps across calls: each Set-Cookie line replaces one, and an expired one is gone. */
export class Jar {
  private readonly cookies = new Map<string, string>();
  take(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const at = pair.indexOf("=");
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      const expired = value === "" || attributes.some((a) => a.toLowerCase() === "max-age=0");
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  headers(): Headers {
    return new Headers({ cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "), origin: ORIGIN });
  }
}
