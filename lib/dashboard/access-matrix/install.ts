import * as nodeModule from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Import this first in a server-side access test (issue #477). It points the
// modules a server call reaches outside this repo's own code at the fakes
// beside it: the database client, the session, Next's cache and request
// headers and the file stores. The database client answers a migrated
// in-memory Postgres (./test-database.ts, issue #649), so every loader, rule,
// action and route, the audited writes of lib/db-audit.ts included, runs as
// it does on the server. Node runs each test file in its own process, so the
// swap ends with the file.

type ResolveHook = (
  specifier: string,
  context: unknown,
  next: (specifier: string, context: unknown) => unknown,
) => unknown;

// `registerHooks` is in Node 22.15 and later; the repo's @types/node predates it.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };

const fake = (file: string) => pathToFileURL(join(__dirname, "fakes", file)).href;

const FAKES: Readonly<Record<string, string>> = {
  "server-only": fake("server-only.ts"),
  "next/cache": fake("next-cache.ts"),
  "next/headers": fake("next-headers.ts"),
  "@/db/client": fake("db-client.ts"),
  "@/lib/current-user": fake("current-user.ts"),
  "@/lib/storage/private-store": fake("files.ts"),
  "@/lib/storage/public-store": fake("public-store.ts"),
  "@vercel/blob": fake("files.ts"),
};

registerHooks({
  resolve(specifier, context, next) {
    const url = FAKES[specifier];
    return url === undefined ? next(specifier, context) : { url, shortCircuit: true };
  },
});
