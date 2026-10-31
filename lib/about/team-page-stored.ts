import { isTeamPageLayer, isTeamPageText, NO_TEAM_LAYER, textOf, withText, type OwnsUpload, type TeamPageLayer, type TeamPageText } from "./team-layer";
import { layoutPageOf, parseTeamLayout, snapshot, type TeamLayout } from "./team-layout";
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
// (ADR 0019 Decision 8).

/** A stored version: the layer, and its layout, or none on a row the layout's first fill has not reached. */
export type StoredTeamPage = { readonly layer: TeamPageLayer; readonly layout: TeamLayout | null };

/** What the page draws before anything was saved: no layer edit, and the layout that snapshots to. */
export const NO_STORED_TEAM_PAGE: StoredTeamPage = { layer: NO_TEAM_LAYER, layout: null };

/** The version the seed and the first fill store: `layer`, and the layout it snapshots to on `roles` (ADR 0019 Decision 7). */
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
  return isTeamPageLayer(row.layer, owns) ? { layer: row.layer, layout: parseTeamLayout(row.layout) } : null;
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
