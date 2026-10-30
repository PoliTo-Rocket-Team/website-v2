import { isTeamPageLayer, NO_TEAM_LAYER, type OwnsUpload, type TeamPageLayer } from "./team-layer";
import { layoutPageOf, parseTeamLayout, snapshot, type TeamLayout } from "./team-layout";
import { withLayerText, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// One stored version of the Team page (issue #850, ADR 0019): the visual
// layer, which keeps the intro text, the figures and the group photo, and the
// layout of page seats the page draws (./team-layout.ts), kept side by side
// in one row of `team_page_layer_versions`. A row written before the layout
// existed holds none until the post-migration step fills it
// (./team-layout-fill.ts); meanwhile it reads the layout its layer snapshots
// to, so the order of deploy and migration does not matter. Until the editor
// moves to the layout, a save still sends a layer and stores it with its
// snapshot layout.

/** A stored version: the layer, and its layout, or none on a row the layout's first fill has not reached. */
export type StoredTeamPage = { readonly layer: TeamPageLayer; readonly layout: TeamLayout | null };

/** What the page draws before anything was saved: no layer edit, and the layout that snapshots to. */
export const NO_STORED_TEAM_PAGE: StoredTeamPage = { layer: NO_TEAM_LAYER, layout: null };

/** The version a save stores (ADR 0019 Decision 7, interim save): `layer`, and the layout it snapshots to on `roles`. */
export function storedTeamPage(roles: TeamRoles, layer: TeamPageLayer): StoredTeamPage {
  return { layer, layout: snapshot(roles, layer).layout };
}

/** The layout `stored` draws: its own, else the one its layer snapshots to on `roles` (ADR 0019 Decision 7, transitional read). */
export function layoutOf(roles: TeamRoles, stored: StoredTeamPage): TeamLayout {
  return stored.layout ?? snapshot(roles, stored.layer).layout;
}

/**
 * The Team page `stored` draws on `roles`: its layout resolved against the
 * team record, with the layer's intro text, figures and group photo, onto
 * `base` for everything else; `base` with the layer's text when a section
 * the page always draws is empty.
 */
export function storedTeamPageOf(roles: TeamRoles, stored: StoredTeamPage, base: TeamPage): TeamPage {
  return layoutPageOf(roles, layoutOf(roles, stored), stored.layer, base) ?? withLayerText(base, stored.layer);
}

/**
 * A row as storage holds it, read back: null when its layer is not one this
 * code could have written, so the row is skipped. A layout this code could
 * not have written reads as none, so the row draws the layout its layer
 * snapshots to.
 */
export function storedTeamPageOfRow(row: { readonly layer: unknown; readonly layout: unknown }, owns: OwnsUpload): StoredTeamPage | null {
  return isTeamPageLayer(row.layer, owns) ? { layer: row.layer, layout: parseTeamLayout(row.layout) } : null;
}
