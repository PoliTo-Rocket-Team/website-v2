// What GET /api/viewer answers and the navbar reads (issues #157, #261): who
// is signed in, as much as the navbar's account menu shows (board 01b), or
// null when nobody is signed in.

export type NavViewer = {
  readonly name: string;
  /** The menu header's address: the Google account address the person signed in with, never the team address. */
  readonly email: string;
  /** The profile photo; null shows the PRT mark. */
  readonly photoUrl: string | null;
};

function filled(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** The viewer in an /api/viewer answer, or null for anything that is not a whole one. */
export function parseNavViewer(body: unknown): NavViewer | null {
  if (typeof body !== "object" || body === null || !("viewer" in body)) return null;
  const { viewer } = body;
  if (typeof viewer !== "object" || viewer === null) return null;
  if (!("name" in viewer && "email" in viewer && "photoUrl" in viewer)) return null;
  const { name, email, photoUrl } = viewer;
  if (!filled(name) || !filled(email)) return null;
  if (photoUrl !== null && !filled(photoUrl)) return null;
  return { name, email, photoUrl };
}
