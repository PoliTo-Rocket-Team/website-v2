// Where an uploaded file lives (issue #133). Each kind of file has one store
// and one folder, fixed here in server code: a caller names the kind, never a
// store or a prefix, so nothing the browser sends can pick either.

/** Files served only after an access check: the private store. */
export type PrivateFileKind = "application" | "order";

/** Files shown on public pages: the public store. */
export type PublicFileKind = "photo";

const PRIVATE_FOLDER: Record<PrivateFileKind, string> = {
  application: "applications/",
  order: "orders/",
};

const PUBLIC_FOLDER: Record<PublicFileKind, string> = {
  photo: "photos/",
};

declare const privateBrand: unique symbol;
declare const publicBrand: unique symbol;

/** A pathname in the private store, under its kind's folder. Made only by the functions below. */
export type PrivatePathname = string & { readonly [privateBrand]: true };

/** A pathname in the public store, under its kind's folder. Made only by the functions below. */
export type PublicPathname = string & { readonly [publicBrand]: true };

/** One file name, no folders: letters, digits, dot, dash and underscore, not starting with a dot. */
const FILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

function checkedName(name: string): string {
  if (!FILE_NAME.test(name)) throw new Error(`Not a plain file name: ${JSON.stringify(name)}`);
  return name;
}

/** The private-store pathname for a new file of this kind. */
export function privatePathname(kind: PrivateFileKind, name: string): PrivatePathname {
  return (PRIVATE_FOLDER[kind] + checkedName(name)) as PrivatePathname;
}

/** The public-store pathname for a new file of this kind. */
export function publicPathname(kind: PublicFileKind, name: string): PublicPathname {
  return (PUBLIC_FOLDER[kind] + checkedName(name)) as PublicPathname;
}

/**
 * A stored pathname stays as it was written, so rows written before this store
 * existed keep resolving: it must sit under one of the store's folders and
 * must not climb out of it.
 */
function parseIn<P extends string>(folders: Record<string, string>, stored: string): P | null {
  for (const folder of Object.values(folders)) {
    if (!stored.startsWith(folder)) continue;
    const rest = stored.slice(folder.length);
    const segments = rest.split("/");
    if (rest !== "" && segments.every((s) => s !== "" && s !== "." && s !== "..")) return stored as P;
  }
  return null;
}

/** A pathname read back from the database, when it names a file in the private store; else null. */
export function parsePrivatePathname(stored: string): PrivatePathname | null {
  return parseIn<PrivatePathname>(PRIVATE_FOLDER, stored);
}

/** A pathname read back from the database, when it names a file in the public store; else null. */
export function parsePublicPathname(stored: string): PublicPathname | null {
  return parseIn<PublicPathname>(PUBLIC_FOLDER, stored);
}
