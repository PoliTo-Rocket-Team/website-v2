import { fake, installFakes, SHARED_FAKES } from "./hooks";

// Import this first in a server-side test whose sessions are real Better
// Auth ones (issue #653). It swaps what ./install.ts swaps but the session:
// `@/lib/current-user` is the app's own, and reads the session cookies of
// the request the test is making (./fakes/request-headers.ts), so a session
// started through the tester sign-in or View as resolves exactly as on the
// server, cookie cache and all.

installFakes({
  ...SHARED_FAKES,
  "next/headers": fake("request-headers.ts"),
});
