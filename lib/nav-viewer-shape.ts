// What GET /api/viewer answers and the navbar reads (issue #157): the
// signed-in viewer's name, or null when nobody is signed in.

export type NavViewer = { readonly name: string };

/** The viewer in an /api/viewer answer, or null for anything that is not one. */
export function parseNavViewer(body: unknown): NavViewer | null {
  if (typeof body !== "object" || body === null || !("viewer" in body)) return null;
  const { viewer } = body;
  if (typeof viewer !== "object" || viewer === null || !("name" in viewer)) return null;
  const { name } = viewer;
  return typeof name === "string" && name.trim() !== "" ? { name } : null;
}
