import { advisorsAfter, isAdvisorVersion, type AdvisorItem, type AdvisorStore, type AdvisorVersion } from "@/lib/about/advisors";
import { importedAdvisors } from "@/lib/about/advisors-import";
import { isTeamPageLayer, NO_UPLOADS, type TeamPageLayer } from "@/lib/about/team-layer";
import type { TeamPagePhotos, TeamPageStore } from "@/lib/about/team-page-editor";
import { memoryTeamPageStore } from "@/lib/about/team-page-memory";
import { teamPeopleOf, type TeamRoles } from "@/lib/about/team-roles";
import type { ContentItem } from "@/lib/content/versioned";
import { written } from "@/lib/dashboard/write";
import { dummyContentStore, parseContentEdits, serializeContentEdits, type ContentEdits, type ContentEditsStore } from "./content-edits";
import { NO_EDITS, type TeamEdits, type TeamEditsStore } from "./edits";
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
  return parseContentEdits(value, (layer) => isTeamPageLayer(layer, NO_UPLOADS));
}

export const serializeTeamPageLayerEdits = serializeContentEdits<TeamPageLayer>;

// The Team page's advisors (issue #286) on previews: the store starts from
// today's advisors, as the database's migration imports them, and what a test
// developer adds, edits, reorders or publishes is kept in their own cookie.
// End advising takes the advisor out of that cookie's list and adds them to
// the Alumni page's Advisors group in the team edits, where the dashboard's
// Alumni page reads them; nothing else of the team edits changes. The public
// page reads the seed, never the cookie.

/** The advisors previews start from: today's, published. */
export function dummyAdvisorSeed(): AdvisorItem[] {
  return importedAdvisors();
}

export type DummyAdvisorEdits = ContentEdits<AdvisorVersion>;
export type DummyAdvisorEditsStore = ContentEditsStore<AdvisorVersion>;

/** The edits in the cookie; none when it is absent or holds an advisor this code could not have written. */
export function parseAdvisorEdits(value: string | undefined): DummyAdvisorEdits {
  return parseContentEdits(value, isAdvisorVersion);
}

export const serializeAdvisorEdits = serializeContentEdits<AdvisorVersion>;

/**
 * The test developer's Team page store: the layer and the advisors, each in
 * its own cookie. A save that either cookie cannot hold is refused before
 * either is written, so the two never disagree.
 */
export function dummyTeamPageStore(layerEdits: DummyTeamPageLayerEditsStore, advisorEdits: DummyAdvisorEditsStore): TeamPageStore {
  const layer = dummyContentStore(dummyTeamPageLayerSeed(), layerEdits);
  const advisors = dummyContentStore(dummyAdvisorSeed(), advisorEdits);
  return memoryTeamPageStore(layer, advisors, (l, a) => layer.refusal(l) ?? advisors.refusal(a));
}

/** The test developer's advisors: the seed with their edits, a save kept whole or refused whole, and End advising into their Alumni edits. */
export function dummyAdvisorStore(edits: DummyAdvisorEditsStore, team: TeamEditsStore): AdvisorStore {
  const store = dummyContentStore(dummyAdvisorSeed(), edits);
  return {
    ...store,
    saveAll: async (writes) => store.replace(advisorsAfter(await store.list(), writes)),
    async endAdvising(id, { name, role, from, to }) {
      const removed = await store.remove(id);
      if (!removed.ok) return removed;
      // A preview keeps no photos on the Alumni page: the entry is the name, role and years.
      const { alumni } = team.current;
      await team.save({ ...team.current, alumni: { ...alumni, advisors: [...alumni.advisors, { name, role, from, to }] } });
      return written(null);
    },
  };
}

/** What an uploaded Team page photo becomes on a preview: one photo of the site's own. */
export const PREVIEW_TEAM_PHOTO = "/team/preview-upload.webp";

/**
 * A preview stores no files (issue #323): the photo is checked as the
 * database side checks it, nothing is written to Blob, and the page shows
 * the stand-in, which fits the test developer's cookie. With no file
 * stored, there is none to delete either.
 */
export const dummyTeamPagePhotos: TeamPagePhotos = {
  put: async () => PREVIEW_TEAM_PHOTO,
  // Every upload here is the stand-in, a photo of the site's own: no remote URL is this side's.
  owns: NO_UPLOADS,
  drop: async () => {},
};
