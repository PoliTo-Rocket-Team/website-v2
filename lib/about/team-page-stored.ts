import { isTeamPageLayer, isTeamPageText, NO_TEAM_LAYER, textOf, withText, type OwnsUpload, type TeamPageLayer, type TeamPageText } from "./team-layer";
import { mapVersions, versionRows, type Versioned } from "@/lib/content/versioned";
import {
  bindsTeamSeat,
  layoutPageOf,
  parseStoredLayout,
  parseTeamLayout,
  snapshot,
  teamLayoutOf,
  withTeamSeatMoved,
  type StoredLayout,
  type TeamLayout,
} from "./team-layout";
import type { TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// One stored version of the Team page (issue #850, ADR 0019): the visual
// layer, which keeps the intro text, the figures and the group photo, and the
// layout of page seats the page draws (./team-layout.ts), kept side by side
// in one row of `team_page_layer_versions`. A row written before the layout
// existed holds none until the post-migration step fills it
// (./team-layout-fill.ts); meanwhile it reads the layout its layer snapshots
// to, so the order of deploy and migration does not matter. The editor edits
// the layout and the layer's text (issue #851): a save stores the layout it
// sends and writes the layer's intro text, figures and group photo, leaving
// the layer's people fields as they were until follow-up #855 drops them
// (ADR 0019 Decision 8). A layout stored before department groups keeps that
// form until the editor saves it: only the team record tells which
// department each of its blocks shows (`teamLayoutOf`, issue #856).

/** A stored version: the layer, and its layout, or none on a row the layout's first fill has not reached. */
export type StoredTeamPage = { readonly layer: TeamPageLayer; readonly layout: StoredLayout | null };

/** What the page draws before anything was saved: no layer edit, and the layout that snapshots to. */
export const NO_STORED_TEAM_PAGE: StoredTeamPage = { layer: NO_TEAM_LAYER, layout: null };

/** The version the seed and the first fill store: `layer`, and the layout it snapshots to on `roles` (ADR 0019 Decision 7). */
export function storedTeamPage(roles: TeamRoles, layer: TeamPageLayer): StoredTeamPage & { readonly layout: TeamLayout } {
  return { layer, layout: snapshot(roles, layer).layout };
}

/**
 * The layout `stored` draws: its own, grouped on `roles` (`teamLayoutOf`),
 * else the one its layer snapshots to on `roles` (ADR 0019 Decision 7,
 * transitional read).
 */
export function layoutOf(roles: TeamRoles, stored: StoredTeamPage): TeamLayout {
  return stored.layout === null ? snapshot(roles, stored.layer).layout : teamLayoutOf(stored.layout, roles, stored.layer);
}

/**
 * The Team page `stored` draws on `roles`: its layout resolved against the
 * team record, with the layer's intro text, figures and group photo, onto
 * `base` for everything else. A section whose seats have no holder is drawn
 * empty; the seats and core members never come from `base` (ADR 0019
 * Decision 9).
 */
export function storedTeamPageOf(roles: TeamRoles, stored: StoredTeamPage, base: TeamPage): TeamPage {
  return layoutPageOf(roles, layoutOf(roles, stored), stored.layer, base);
}

/**
 * A row as storage holds it, read back: null when its layer is not one this
 * code could have written, so the row is skipped. A layout this code could
 * not have written reads as none, so the row draws the layout its layer
 * snapshots to.
 */
export function storedTeamPageOfRow(row: { readonly layer: unknown; readonly layout: unknown }, owns: OwnsUpload): StoredTeamPage | null {
  return isTeamPageLayer(row.layer, owns) ? { layer: row.layer, layout: parseStoredLayout(row.layout) } : null;
}

// A hand-over in the Team tree (issue #852, ADR 0019 Decision 3): a
// team-level seat with no full-access flag is bound by its `roles` row, and
// its hand-over ends that row and starts the successor's, so the stored page
// seats bound to the ended row move to the new one in the same write. Every
// other seat kind is bound by a reference the hand-over keeps, and a
// person-bound place passes to no one (#846 R4.1), so neither moves.

/** Whether a stored layout of any version binds a page seat to team-level seat row `roleId`: only then does its hand-over write to the page. */
export function bindsStoredTeamSeat(version: Versioned<StoredTeamPage>, roleId: number): boolean {
  return versionRows(version).some(({ content }) => content.layout !== null && bindsTeamSeat(content.layout, roleId));
}

/**
 * The versions after team-level seat row `from` is handed over to the
 * successor's row `to`: in each stored layout every page seat bound to `from`
 * is bound to `to`, with its place and overrides. A version with no stored
 * layout yet keeps none: it draws the layout its layer snapshots to on the
 * team record after the hand-over (`layoutOf`). The layer is unchanged.
 */
export function teamSeatHandedOver(version: Versioned<StoredTeamPage>, from: number, to: number): Versioned<StoredTeamPage> {
  return mapVersions(version, (stored) => (stored.layout === null ? stored : { ...stored, layout: withTeamSeatMoved(stored.layout, from, to) }));
}

/** What the Team page editor edits and saves (issue #851): the layout of page seats, and the layer's intro text, figures and group photo. */
export type TeamPageContent = { readonly layout: TeamLayout; readonly text: TeamPageText };

/** The content a stored version gives the editor: the layout it draws on `roles`, and its layer's text. */
export function contentOf(roles: TeamRoles, stored: StoredTeamPage): TeamPageContent {
  return { layout: layoutOf(roles, stored), text: textOf(stored.layer) };
}

/** The version a save of `content` stores over `stored`: its layout, and the layer with its text; the layer's people fields stay as they were. */
export function savedTeamPage(stored: StoredTeamPage, content: TeamPageContent): StoredTeamPage {
  return { layer: withText(stored.layer, content.text), layout: content.layout };
}

/** Content as the browser sends it, read back: null for anything this code could not have written. */
export function parseTeamPageContent(value: unknown, owns: OwnsUpload): TeamPageContent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { layout, text, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !isTeamPageText(text, owns)) return null;
  const parsed = parseTeamLayout(layout);
  return parsed === null ? null : { layout: parsed, text: textOf(text) };
}
