import { textLength } from "@/lib/content/text";
import { TEAM_PAGE_TEXT_MAX } from "./team-layer";
import { LAYOUT_GROUPS_MAX, nextGroupId, type LayoutGroup, type TeamLayout } from "./team-layout";

// The department groups the Team page editor sets (issue #856, #846 R2.3 and
// R3.1): the headings of the departments carousel, in order. The editor adds
// a group before or after any group or at the end, renames it, moves it, and
// deletes it once no department block sits in it; each block is put in a group
// from its own panel (./team-page-add.ts). A group is the Team page's alone:
// it creates and changes nothing in the team. Pure: each step returns a new
// layout, and the save checks the layout whole again (`parseTeamLayout`).

/** Where a new group goes: just before or just after the group with that id, or after every group. */
export type GroupPlace = { readonly before: number } | { readonly after: number } | "end";

/** What a step refuses, with the reason the editor reads, or the layout it makes. */
export type GroupStep = { readonly ok: true; readonly layout: TeamLayout } | { readonly ok: false; readonly error: string };

/** How many department blocks sit in group `id`. */
export function blocksIn(layout: TeamLayout, id: number): number {
  return layout.departments.filter((b) => b.group === id).length;
}

/** Why a group name cannot be kept as typed: blank or past the text limit; undefined when it can. */
export function groupNameError(name: string): string | undefined {
  const typed = name.trim();
  if (typed === "") return "Enter the group's name.";
  return textLength(typed) > TEAM_PAGE_TEXT_MAX ? `Up to ${TEAM_PAGE_TEXT_MAX} characters.` : undefined;
}

export const GROUPS_FULL = `The page holds up to ${LAYOUT_GROUPS_MAX} groups.`;

/**
 * `layout` with a new group named `name` at `place`, taking the next group
 * id; a place naming no group puts it at the end. The name is kept as typed,
 * so a blank one shows its error until the editor names it.
 */
export function withGroupAdded(
  layout: TeamLayout,
  place: GroupPlace,
  name = "",
): { readonly ok: true; readonly layout: TeamLayout; readonly id: number } | { readonly ok: false; readonly error: string } {
  if (layout.groups.length >= LAYOUT_GROUPS_MAX) return { ok: false, error: GROUPS_FULL };
  const group: LayoutGroup = { id: nextGroupId(layout), name };
  const anchor = place === "end" ? -1 : layout.groups.findIndex((g) => g.id === ("before" in place ? place.before : place.after));
  const at = anchor === -1 ? layout.groups.length : place !== "end" && "after" in place ? anchor + 1 : anchor;
  return { ok: true, id: group.id, layout: { ...layout, groups: [...layout.groups.slice(0, at), group, ...layout.groups.slice(at)] } };
}

/** `layout` with group `id` named `name`, as typed. */
export function withGroupRenamed(layout: TeamLayout, id: number, name: string): TeamLayout {
  return { ...layout, groups: layout.groups.map((g) => (g.id === id ? { ...g, name } : g)) };
}

/** `layout` with group `id` moved to position `to` among the groups (0 is the first), every other group keeping its order. */
export function withGroupMoved(layout: TeamLayout, id: number, to: number): TeamLayout {
  const group = layout.groups.find((g) => g.id === id);
  if (group === undefined) return layout;
  const rest = layout.groups.filter((g) => g.id !== id);
  const at = Math.min(Math.max(0, to), rest.length);
  return { ...layout, groups: [...rest.slice(0, at), group, ...rest.slice(at)] };
}

/**
 * `layout` without group `id`, refused while a department block sits in it
 * (they are moved to another group first) or while it is the only group: a
 * layout always holds one, so a department always has a group to go to.
 */
export function withoutGroup(layout: TeamLayout, id: number): GroupStep {
  const group = layout.groups.find((g) => g.id === id);
  if (group === undefined) return { ok: true, layout };
  const held = blocksIn(layout, id);
  const name = group.name.trim() === "" ? "This group" : group.name.trim();
  if (held > 0) {
    return { ok: false, error: `${name} still holds ${held === 1 ? "a department" : `${held} departments`}. Move ${held === 1 ? "it" : "them"} to another group first.` };
  }
  if (layout.groups.length === 1) return { ok: false, error: "Keep at least one group." };
  return { ok: true, layout: { ...layout, groups: layout.groups.filter((g) => g.id !== id) } };
}

/** Whether every group name can be kept: the Groups panel's Done refuses until then. */
export function groupsKeepable(groups: readonly LayoutGroup[]): boolean {
  return groups.every((g) => groupNameError(g.name) === undefined);
}

/** The group names as the layout keeps them: each trimmed. */
export function trimmedGroups(groups: readonly LayoutGroup[]): LayoutGroup[] {
  return groups.map((g) => ({ ...g, name: g.name.trim() }));
}
