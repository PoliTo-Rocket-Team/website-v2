// A person's stored photo as every dashboard circle reads it (issue #656):
// the shared avatar takes the person, never a loose photo, so a screen that
// shows someone cannot forget their photo and draw the PRT mark by mistake.

/**
 * Anyone a dashboard circle shows: a value carrying their stored photo,
 * `members.picture` or the viewer's copy of it (`DashboardViewer.photoUrl`).
 * Null when they stored none.
 */
export type Pictured = { readonly photoUrl: string | null };

/**
 * The photo to draw for them, or null for the PRT mark. No stored picture is
 * none, and so is an empty one: the store keeps "" for some people, and an
 * `<img src="">` draws a broken image.
 */
export function storedPhotoOf(person: Pictured): string | null {
  const url: unknown = person.photoUrl;
  return typeof url === "string" && url.trim() !== "" ? url : null;
}
