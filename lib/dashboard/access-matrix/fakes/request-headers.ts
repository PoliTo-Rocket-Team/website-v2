// Stands in for `next/headers` in a server-side test with real sessions
// (../install-real-session.ts, issue #653): the request carries the cookies
// the test hands it, as a browser sends the cookies it was set.

let current = new Headers();

/** The next calls run as a request carrying these headers: a browser's cookies, from the Set-Cookie lines it was sent. */
export function sendRequestWith(headers: Headers): void {
  current = new Headers(headers);
}

function cookieList(): { name: string; value: string }[] {
  const header = current.get("cookie") ?? "";
  return header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => {
      const at = part.indexOf("=");
      return { name: part.slice(0, at), value: part.slice(at + 1) };
    });
}

export async function cookies() {
  return {
    get: (name: string) => cookieList().find((c) => c.name === name),
    getAll: () => cookieList(),
    has: (name: string) => cookieList().some((c) => c.name === name),
    set: () => {},
    delete: () => {},
  };
}

export async function headers(): Promise<Headers> {
  return new Headers(current);
}
