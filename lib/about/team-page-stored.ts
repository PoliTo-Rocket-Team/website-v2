import { isTeamPageLayer, isTeamPageText, NO_TEAM_LAYER, textOf, type OwnsUpload, type TeamPageLayer, type TeamPageText } from "./team-layer";
import { mapVersions, versionRows, type Versioned } from "@/lib/content/versioned";
import {
  bindsTeamSeat,
  firstLayout,
  layoutPageOf,
  parseStoredLayout,
  parseTeamLayout,
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
// in one row of `team_page_layer_versions`. Every row holds a layout since
// issue #855, which made the column required. The editor edits the layout
// and the layer's text (issue #851): a save stores both as it sends them. A
// layout stored before department groups keeps that form until the editor
// saves it: only the team record tells which department each of its blocks
// shows (`teamLayoutOf`, issue #856).

/** A stored version: the layer, and its layout. */
export type StoredTeamPage = { readonly layer: TeamPageLayer; readonly layout: StoredLayout };

/** What the page draws before anything was saved: no layer edit, and the team record's places (`firstLayout`). */
export function unsavedTeamPage(roles: TeamRoles): StoredTeamPage {
  return { layer: NO_TEAM_LAYER, layout: firstLayout(roles) };
}

/** The layout `stored` draws: its own, grouped on `roles` (`teamLayoutOf`). */
export function layoutOf(roles: TeamRoles, stored: StoredTeamPage): TeamLayout {
  return teamLayoutOf(stored.layout, roles);
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
 * A row as storage holds it, read back: null when its layer or its layout is
 * not one this code could have written, so the row is skipped.
 */
export function storedTeamPageOfRow(row: { readonly layer: unknown; readonly layout: unknown }, owns: OwnsUpload): StoredTeamPage | null {
  if (!isTeamPageLayer(row.layer, owns)) return null;
  const layout = parseStoredLayout(row.layout);
  return layout === null ? null : { layer: textOf(row.layer), layout };
}

// A hand-over in the Team tree (issue #852, ADR 0019 Decision 3): a
// team-level seat with no full-access flag is bound by its `roles` row, and
// its hand-over ends that row and starts the successor's, so the stored page
// seats bound to the ended row move to the new one in the same write. Every
// other seat kind is bound by a reference the hand-over keeps, and a
// person-bound place passes to no one (#846 R4.1), so neither moves.

/** Whether a stored layout of any version binds a page seat to team-level seat row `roleId`: only then does its hand-over write to the page. */
export function bindsStoredTeamSeat(version: Versioned<StoredTeamPage>, roleId: number): boolean {
  return versionRows(version).some(({ content }) => bindsTeamSeat(content.layout, roleId));
}

/**
 * The versions after team-level seat row `from` is handed over to the
 * successor's row `to`: in each stored layout every page seat bound to `from`
 * is bound to `to`, with its place and overrides. The layer is unchanged.
 */
export function teamSeatHandedOver(version: Versioned<StoredTeamPage>, from: number, to: number): Versioned<StoredTeamPage> {
  return mapVersions(version, (stored) => ({ ...stored, layout: withTeamSeatMoved(stored.layout, from, to) }));
}

/** What the Team page editor edits and saves (issue #851): the layout of page seats, and the layer's intro text, figures and group photo. */
export type TeamPageContent = { readonly layout: TeamLayout; readonly text: TeamPageText };

/** The content a stored version gives the editor: the layout it draws on `roles`, and its layer's text. */
export function contentOf(roles: TeamRoles, stored: StoredTeamPage): TeamPageContent {
  return { layout: layoutOf(roles, stored), text: textOf(stored.layer) };
}

/** The version a save of `content` stores: its layout, and its text as the layer. */
export function savedTeamPage(content: TeamPageContent): StoredTeamPage {
  return { layer: textOf(content.text), layout: content.layout };
}

/** Content as the browser sends it, read back: null for anything this code could not have written. */
export function parseTeamPageContent(value: unknown, owns: OwnsUpload): TeamPageContent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { layout, text, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !isTeamPageText(text, owns)) return null;
  const parsed = parseTeamLayout(layout);
  return parsed === null ? null : { layout: parsed, text: textOf(text) };
}
