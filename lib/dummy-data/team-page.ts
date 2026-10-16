import { isTeamPageLayer, type TeamPageLayer } from "@/lib/about/team-layer";
import { teamPeopleOf, type TeamRoles } from "@/lib/about/team-roles";
import type { ContentStore } from "@/lib/content/editor";
import type { ContentItem } from "@/lib/content/versioned";
import { dummyContentStore, parseContentEdits, serializeContentEdits, type ContentEdits, type ContentEditsStore } from "./content-edits";
import { NO_EDITS, type TeamEdits } from "./edits";
import { dummyOrg, dummyRecords, editedRoster } from "./team-pages";

// The Team page's visual layer on previews and in test-developer sessions
// (issue #283), which never touch a database. No layer is saved to start
// with, so the page is the dummy team's roles build. What a test developer
// saves, publishes or resets is kept in their own cookie
// (./content-edits.ts), and the editor lays it on the dummy team as they
// edited it; the public page reads the seed, never the cookie, as /apply and
// the partners do.

/** The dummy team as the Team page reads it, with a test developer's team edits (none for the public page). */
export function dummyTeamRoles(edits: TeamEdits = NO_EDITS): TeamRoles {
  return { org: dummyOrg(edits).org, people: teamPeopleOf(editedRoster(edits), dummyRecords(edits, [])) };
}

/** The layer previews start from: none saved. */
export function dummyTeamPageLayerSeed(): ContentItem<TeamPageLayer>[] {
  return [];
}

export type DummyTeamPageLayerEdits = ContentEdits<TeamPageLayer>;
export type DummyTeamPageLayerEditsStore = ContentEditsStore<TeamPageLayer>;

/** The edits in the cookie; none when it is absent or holds a layer this code could not have written. */
export function parseTeamPageLayerEdits(value: string | undefined): DummyTeamPageLayerEdits {
  return parseContentEdits(value, isTeamPageLayer);
}

export const serializeTeamPageLayerEdits = serializeContentEdits<TeamPageLayer>;

/** The test developer's layer: the seed with their edits, kept in their cookie, which refuses a layer too big for it. */
export function dummyTeamPageLayerStore(edits: DummyTeamPageLayerEditsStore): ContentStore<TeamPageLayer> {
  return dummyContentStore(dummyTeamPageLayerSeed(), edits);
}
