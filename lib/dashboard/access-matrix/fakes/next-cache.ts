// Stands in for `next/cache` in the server-side access tests: outside Next a
// cached read is a plain read, and a refresh does nothing.

export function cacheTag(..._tags: string[]): void {}
export function cacheLife(_profile: unknown): void {}
export function updateTag(_tag: string): void {}
export function revalidateTag(_tag: string): void {}
export function revalidatePath(_path: string): void {}
export function refresh(): void {}
