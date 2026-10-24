import { publicStoreHost, type PublicPathname, type PublicStoreHost } from "@/lib/storage/pathname";
import { noteFileWrite } from "../test-database";

// Stands in for `@/lib/storage/public-store` in the server-side access
// tests: an upload or a delete is noted in the write journal and stores nothing.

const HOST = publicStoreHost("teststore");

export function ownPublicStoreHost(): PublicStoreHost | null {
  return HOST;
}

export async function uploadPublicFile(pathname: PublicPathname): Promise<{ url: string }> {
  await noteFileWrite("upload-public", pathname);
  return { url: `https://${HOST}/${pathname}` };
}

export async function readPublicFile(): Promise<null> {
  return null;
}

export async function deletePublicFile(pathname: PublicPathname): Promise<void> {
  await noteFileWrite("delete-public", pathname);
}
