import "server-only";

import { del, get, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import type { PublicPathname } from "./pathname";

// The public Vercel Blob store (prt-public): profile photos for the public
// Team page, served straight from their public URL. It authenticates with the
// project's OIDC token and this store's id, both passed on every call, so a
// missing token fails here instead of falling back to the private store's
// read-write token from the environment.

async function credentials() {
  const storeId = process.env.PUBLIC_BLOB_STORE_ID;
  if (!storeId) throw new Error("PUBLIC_BLOB_STORE_ID is not set: the public file store is not configured.");
  return { access: "public", oidcToken: await getVercelOidcToken(), storeId } as const;
}

/** Stores a new file and returns its public URL. Refuses to overwrite: every pathname is written once. */
export async function uploadPublicFile(
  pathname: PublicPathname,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ url: string }> {
  const { url } = await put(pathname, Buffer.from(body), { ...(await credentials()), contentType });
  return { url };
}

/** A stored file's bytes as a stream, with its type and size; null when there is no such file. */
export async function readPublicFile(pathname: PublicPathname): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
} | null> {
  const read = await get(pathname, await credentials());
  if (read === null || read.statusCode !== 200) return null;
  return { stream: read.stream, contentType: read.blob.contentType, size: read.blob.size };
}

/** Deletes a stored file. Deleting one that is already gone is not an error. */
export async function deletePublicFile(pathname: PublicPathname): Promise<void> {
  await del(pathname, await credentials());
}
