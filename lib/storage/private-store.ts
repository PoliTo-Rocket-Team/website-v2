import "server-only";

// The private Vercel Blob store's calls, marked server-only for app code. The
// calls themselves are in ./private-blob.ts.

export { deletePrivateFile, readPrivateFile, uploadPrivateFile } from "./private-blob";
