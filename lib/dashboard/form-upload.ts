import type { Upload } from "./write";

/** The file field of a form as an Upload; null when no file was sent. Shared by the dashboard's server actions. */
export async function uploadOf(form: FormData, field: string): Promise<Upload | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
}
