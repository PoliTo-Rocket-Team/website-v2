import { publicStoreHost, type PublicPathname, type PublicStoreHost } from "@/lib/storage/pathname";
import type { ListedPublicFile } from "@/lib/storage/public-store";
import { noteFileWrite } from "../test-database";

// Stands in for `@/lib/storage/public-store` in the server-side access
// tests: an upload, a copy or a delete is noted in the write journal and
// stores nothing. A file counts as stored until a delete names it, so a test
// can show a write refusing or skipping a file whose file is gone (issue
// #831); `resetPublicFiles` makes every file stored again.

const HOST = publicStoreHost("teststore");

const deleted = new Set<string>();

/** When a file was uploaded, for a test that sets it; any other stored file counts as uploaded now. */
const uploadedAt = new Map<string, Date>();

/** The URL the fake store answers for a pathname. */
export function publicUrlOf(pathname: string): string {
  return `https://${HOST}/${pathname}`;
}

/** Every file counts as stored again: for a test that starts afresh. */
export function resetPublicFiles(): void {
  deleted.clear();
  uploadedAt.clear();
}

export function ownPublicStoreHost(): PublicStoreHost | null {
  return HOST;
}

export async function uploadPublicFile(pathname: PublicPathname): Promise<{ url: string }> {
  await noteFileWrite("upload-public", pathname);
  deleted.delete(pathname);
  return { url: publicUrlOf(pathname) };
}

export async function readPublicFile(): Promise<null> {
  return null;
}

export async function deletePublicFile(pathname: PublicPathname): Promise<void> {
  await noteFileWrite("delete-public", pathname);
  deleted.add(pathname);
}

export async function copyPublicFile(from: PublicPathname, to: PublicPathname): Promise<{ url: string } | null> {
  if (deleted.has(from)) return null;
  await noteFileWrite("copy-public", to);
  deleted.delete(to);
  return { url: publicUrlOf(to) };
}

/** The fake store took `pathname` at `at`: for a test of an upload old enough for the sweep. */
export function uploadedOn(pathname: string, at: Date): void {
  uploadedAt.set(pathname, at);
}

export async function publicFileUploadedAt(pathname: PublicPathname): Promise<Date | null> {
  return deleted.has(pathname) ? null : (uploadedAt.get(pathname) ?? new Date());
}

/** The store's listing: the tests list no file (lib/storage/upload-sweep.test.ts tests the sweep over a listing of its own). */
export async function listPublicFiles(): Promise<ListedPublicFile[]> {
  return [];
}
