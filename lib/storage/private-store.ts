import "server-only";

import { del, get, put } from "@vercel/blob";
import type { PrivatePathname } from "./pathname";

// The private Vercel Blob store (prt-applications): application files and
// order documents. Its files have no public URL; they reach a browser only
// through a route that checks the viewer's access first and streams the bytes.
// Every call names this store's own token, so it never falls back to another
// store's credentials from the environment.

function credentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set: the private file store is not configured.");
  return { access: "private", token } as const;
}

/** Stores a new file. Refuses to overwrite: every pathname is written once. */
export async function uploadPrivateFile(
  pathname: PrivatePathname,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await put(pathname, Buffer.from(body), { ...credentials(), contentType });
}

/** A stored file's bytes as a stream, with what a response needs to describe them; null when there is no such file. */
export async function readPrivateFile(pathname: PrivatePathname): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  etag: string;
} | null> {
  const read = await get(pathname, credentials());
  if (read === null || read.statusCode !== 200) return null;
  return { stream: read.stream, contentType: read.blob.contentType, size: read.blob.size, etag: read.blob.etag };
}

/** Deletes a stored file. Deleting one that is already gone is not an error. */
export async function deletePrivateFile(pathname: PrivatePathname): Promise<void> {
  await del(pathname, credentials());
}
