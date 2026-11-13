// Stands in for `next/cache` in the server-side access tests: outside Next a
// cached read is a plain read, and a refresh does nothing but leave a note in
// `refreshes`, so a test can tell which pages a write asked to read again
// (issue #984).

/** Each refresh asked for since the last `clearRefreshes`, in order: a path with its type, or "refresh". */
export const refreshes: string[] = [];

export function clearRefreshes(): void {
  refreshes.length = 0;
}

export function cacheTag(..._tags: string[]): void {}
export function cacheLife(_profile: unknown): void {}
export function updateTag(_tag: string): void {}
export function revalidateTag(_tag: string): void {}
export function revalidatePath(path: string, type?: "layout" | "page"): void {
  refreshes.push(type === undefined ? path : `${path} (${type})`);
}
export function refresh(): void {
  refreshes.push("refresh");
}
