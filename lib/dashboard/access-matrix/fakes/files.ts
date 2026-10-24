import { noteFileWrite } from "../test-database";

// Stands in for the private file store (`@/lib/storage/private-store`) and
// `@vercel/blob` in the server-side access tests. A read is recorded as one
// (`fileReads`), so a test can show a refused request never opened the file;
// an upload or a delete is noted in the write journal.

const opened: string[] = [];

export function fileReads(): readonly string[] {
  return [...opened];
}

export function resetFiles(): void {
  opened.length = 0;
}

export async function readPrivateFile(pathname: string) {
  opened.push(pathname);
  return { stream: new ReadableStream(), size: 1, contentType: "application/pdf" };
}

export async function uploadPrivateFile(pathname: string) {
  await noteFileWrite("upload", pathname);
  return { pathname };
}

export async function deletePrivateFile(pathname: string) {
  await noteFileWrite("delete-file", pathname);
}

export async function put(pathname: string) {
  await noteFileWrite("put", pathname);
  return { url: `https://blob.test/${pathname}`, pathname };
}

export async function del(pathname: string) {
  await noteFileWrite("del", String(pathname));
}

export async function get(pathname: string) {
  opened.push(pathname);
  return null;
}
