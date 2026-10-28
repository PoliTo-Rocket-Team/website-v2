import { fake, installFakes, SHARED_FAKES } from "./hooks";

// Import this first in a server-side access test (issue #477). It points the
// modules a server call reaches outside this repo's own code at the fakes
// beside it: the database client, the session, Next's cache and request
// headers and the file stores. The database client answers a migrated
// in-memory Postgres (./test-database.ts, issue #649), so every loader, rule,
// action and route, the audited writes of lib/db-audit.ts included, runs as
// it does on the server. The session is the one the test names (./session.ts).
// Node runs each test file in its own process, so the swap ends with the file.

installFakes({
  ...SHARED_FAKES,
  "next/headers": fake("next-headers.ts"),
  "@/lib/current-user": fake("current-user.ts"),
});
