// The line under a lead's "Open positions" figure on the Overview (board 56):
// a few roles are named, more are counted by division, so the card keeps its
// height however many roles are open (Owner decision, 2026-10-21).

/** How many open roles the line names before it counts divisions instead. */
export const ROLES_NAMED = 3;

/** One open role: its title and the division it sits in (any stable key). */
export type OpenRole = { readonly title: string; readonly division: string | number };

/** "None open"; "Test Engineer, Mission Analyst"; past three, "In 4 divisions" or "In 1 division". */
export function openPositionsDetail(open: readonly OpenRole[]): string {
  if (open.length === 0) return "None open";
  if (open.length <= ROLES_NAMED) return open.map((role) => role.title).join(", ");
  const divisions = new Set(open.map((role) => role.division)).size;
  return `In ${divisions} ${divisions === 1 ? "division" : "divisions"}`;
}
