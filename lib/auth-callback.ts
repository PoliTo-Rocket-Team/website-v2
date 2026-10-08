// Where a sign-in sends the user back to: the `cb` query value, when it is a
// path on this site. Anything else (an absolute URL, a protocol-relative
// `//host`, a value the URL parser turns into one, or a sign-in page, which
// would loop) falls back to the dashboard.
export const DEFAULT_CALLBACK = "/dashboard";

const SIGN_IN_PATHS = ["/login", "/sign-in", "/sign-up"];

// A placeholder origin to resolve `cb` against. The URL parser strips tabs and
// newlines and reads `\` as `/`, so `/\t/evil.com` resolves off-site; checking
// the resolved origin catches every such form, not only the ones we list.
const SITE = "https://site.invalid";

export function callbackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_CALLBACK;
  let url: URL;
  try {
    url = new URL(raw, SITE);
  } catch {
    return DEFAULT_CALLBACK;
  }
  if (url.origin !== SITE) return DEFAULT_CALLBACK;
  const { pathname } = url;
  if (SIGN_IN_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return DEFAULT_CALLBACK;
  }
  return pathname + url.search + url.hash;
}
