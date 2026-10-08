// Where a sign-in sends the user back to: the `cb` query value, when it is a
// path on this site. Anything else (an absolute URL, a protocol-relative
// `//host`, or a sign-in page, which would loop) falls back to the dashboard.
export const DEFAULT_CALLBACK = "/dashboard";

const SIGN_IN_PATHS = ["/login", "/sign-in", "/sign-up"];

export function callbackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_CALLBACK;
  }
  const path = raw.split(/[?#]/, 1)[0];
  if (SIGN_IN_PATHS.some(p => path === p || path.startsWith(`${p}/`))) {
    return DEFAULT_CALLBACK;
  }
  return raw;
}
