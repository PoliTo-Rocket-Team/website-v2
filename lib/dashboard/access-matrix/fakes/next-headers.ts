import { signedInUser } from "../session";

// Stands in for `next/headers` in the server-side access tests: no test
// developer cookie, and a session cookie only while someone is signed in, so
// `openDashboard` takes the database path and tells signed out from an
// account that did not resolve.

const SESSION = "better-auth.session_token";

export async function cookies() {
  return {
    get: (name: string) => (name === SESSION && signedInUser() !== null ? { name, value: "session" } : undefined),
    getAll: () => [],
    has: (name: string) => name === SESSION && signedInUser() !== null,
    set: () => {},
    delete: () => {},
  };
}

export async function headers(): Promise<Headers> {
  return new Headers(signedInUser() === null ? {} : { cookie: `${SESSION}=session` });
}
