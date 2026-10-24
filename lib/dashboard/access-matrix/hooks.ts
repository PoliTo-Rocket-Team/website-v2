import * as nodeModule from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// How a server-side test points the modules a server call reaches outside
// this repo's own code at the fakes in ./fakes (issue #477). ./install.ts and
// ./install-real-session.ts each register one set, first thing in a test
// file. Node runs each test file in its own process, so the swap ends with
// the file.

type ResolveHook = (
  specifier: string,
  context: unknown,
  next: (specifier: string, context: unknown) => unknown,
) => unknown;

// `registerHooks` is in Node 22.15 and later; the repo's @types/node predates it.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };

/** The URL of one fake in ./fakes. */
export const fake = (file: string) => pathToFileURL(join(__dirname, "fakes", file)).href;

/**
 * The fakes every server-side test takes: Next's cache, the database client
 * (a migrated in-memory Postgres, ./test-database.ts, issue #649) and the
 * file stores. The request and the session are each set's own.
 */
export const SHARED_FAKES: Readonly<Record<string, string>> = {
  "server-only": fake("server-only.ts"),
  "next/cache": fake("next-cache.ts"),
  "@/db/client": fake("db-client.ts"),
  "@/lib/storage/private-store": fake("files.ts"),
  "@/lib/storage/public-store": fake("public-store.ts"),
  "@vercel/blob": fake("files.ts"),
};

/** Answers each specifier in `fakes` with its fake, and every other one as Node would. */
export function installFakes(fakes: Readonly<Record<string, string>>): void {
  registerHooks({
    resolve(specifier, context, next) {
      const url = fakes[specifier];
      return url === undefined ? next(specifier, context) : { url, shortCircuit: true };
    },
  });
}
