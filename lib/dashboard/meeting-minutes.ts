// The Meeting Minutes & Requests page's external links: what a link may be,
// and the page built from the configured ones. The links themselves are in
// ./meeting-minutes-links.ts, a server-only module.

/** One meeting minutes folder, as configured. */
export type MinutesFolder = {
  /** The folder's code in Drive ("OPS-LGS"): the row's identity. */
  readonly code: string;
  /** The division's full name; null until it is confirmed. */
  readonly name: string | null;
  /** The folder's Google Drive address; null until there is one. */
  readonly url: string | null;
};

/** The Requests Hub spreadsheet, as configured. */
export type RequestsHub = {
  /** The spreadsheet's document code. */
  readonly code: string;
  readonly description: string;
  /** Its Google Sheets address; null until there is one. */
  readonly url: string | null;
};

export type MinutesLinks = {
  readonly folders: readonly MinutesFolder[];
  readonly requestsHub: RequestsHub;
};

/** What the page shows: each link checked, null where there is none to open. */
export type MinutesPage = {
  readonly folders: readonly { readonly code: string; readonly name: string | null; readonly href: string | null }[];
  readonly requestsHub: { readonly code: string; readonly description: string; readonly href: string | null };
};

/** The Google service a link opens: its one host, and the addresses on it that are its own. */
const SERVICES = {
  drive: {
    host: "drive.google.com",
    serves: (url: URL) => url.pathname.startsWith("/drive/") || (url.pathname === "/open" && !!url.searchParams.get("id")),
  },
  sheets: { host: "docs.google.com", serves: (url: URL) => url.pathname.startsWith("/spreadsheets/") },
} as const;

/**
 * The address to open, or null when none is set or it is not an https address
 * of that Google service: a wrong address shows as a missing link, never as a
 * link.
 */
export function googleLink(url: string | null, service: keyof typeof SERVICES): string | null {
  if (url === null || !URL.canParse(url)) return null;
  const parsed = new URL(url);
  const { host, serves } = SERVICES[service];
  const ours = parsed.protocol === "https:" && parsed.host === host && parsed.username === "" && parsed.password === "";
  return ours && serves(parsed) ? parsed.href : null;
}

/** The page as `links` configures it, in the configured order. */
export function minutesPageOf({ folders, requestsHub }: MinutesLinks): MinutesPage {
  return {
    folders: folders.map(({ code, name, url }) => ({ code, name, href: googleLink(url, "drive") })),
    requestsHub: {
      code: requestsHub.code,
      description: requestsHub.description,
      href: googleLink(requestsHub.url, "sheets"),
    },
  };
}
