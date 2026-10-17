// A delete that runs after its database write has already landed. It stays
// best-effort: a failure must not undo or refuse the write the user made. But
// it is never silent: each failure writes one server log line naming the
// store, the area and the reason. Server logs are not private to the team, so
// the line carries no pathname, file name or other personal data.

/** Which Vercel Blob store the file lives in. */
export type BlobStore = "private" | "public";

/** The dashboard action whose leftover file the delete clears. */
export type DeleteArea =
  | "delete-account"
  | "order-quote"
  | "member-photo"
  | "alumni-photo"
  | "partner-logo"
  | "post-photo";

/** One delete to run: the file, and the store call that removes it. */
export type BestEffortDelete<P extends string> = {
  store: BlobStore;
  area: DeleteArea;
  pathname: P;
  remove: (pathname: P) => Promise<void>;
};

const REDACTED = "[file]";

/** The failure's reason, with the pathname and its file name cut out wherever the error repeated them. */
export function deleteFailureLine(store: BlobStore, area: DeleteArea, pathname: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  const fileName = pathname.slice(pathname.lastIndexOf("/") + 1);
  const safe = [pathname, fileName]
    .filter((secret) => secret !== "")
    .reduce((text, secret) => text.split(secret).join(REDACTED), reason);
  return `Blob delete failed (store: ${store}, area: ${area}): ${safe}`;
}

/** Runs the delete; on failure logs one line and resolves, so the caller's write stands. */
export async function deleteBestEffort<P extends string>(
  { store, area, pathname, remove }: BestEffortDelete<P>,
  log: (line: string) => void = console.error,
): Promise<void> {
  try {
    await remove(pathname);
  } catch (error) {
    log(deleteFailureLine(store, area, pathname, error));
  }
}
