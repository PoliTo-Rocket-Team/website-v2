// The Team page seed (issues #311, #326): the visual layer /about/the-team
// lays on the page the seeded roles build (lib/about/team-layer.ts, issue
// #283), and the hand-added advisors (lib/about/advisors.ts, issue #286).
//
// The layer is published, so the public page shows it. Two of its edits put
// on the arc the two leaders lib/about/team.ts draws there whom no board seat
// places: the head of Operations, between the Project Manager and the Chief
// Engineer, and the head of R&D after them. The other edits are invented,
// since the public data holds no editor's changes: the team leader's photo
// replaced, a head's role text changed, a division lead hidden, a division
// lead added to Research and Development, whose one division has nobody in
// it, and the intro text and the group photo's caption changed. Every edit
// is keyed to a spot the seeded roles fill and names only people on the
// team; none of it writes a role, so Reset to team (board 80h) brings back
// the roles build with the intro text and the group photo kept. The advisors
// are today's (lib/about/advisors-import.ts), each published, as
// drizzle/0035 imports them.

import { teamPageAdvisors, teamPageAdvisorVersions, teamPageLayerVersions } from "@/db/schema";
import { importedAdvisors } from "@/lib/about/advisors-import";
import type { AdvisorItem } from "@/lib/about/advisors";
import type { TeamPageLayer } from "@/lib/about/team-layer";
import { team } from "@/lib/about/team";
import { contentVersionRows } from "./content";
import { publicMember } from "./public-team";
import { DEPARTMENT, DIVISION } from "./structure";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-10-01 10:00:00+00";
const PUBLISHED = "2026-10-12 10:00:00+00";

/** The department whose head's role text the layer changes: Recovery. */
export const RENAMED_HEAD_SPOT = `head:${DEPARTMENT.recovery}:0` as const;
/** The division lead the layer hides: Engine Control System's. */
export const HIDDEN_LEAD_SPOT = `lead:${DIVISION.engineControl}:0` as const;
/** The board seat the added leader follows on the arc; the Chief Engineer comes after them. */
export const ADDED_LEADER_AFTER = "arc:project-manager:0" as const;
/** The head of Operations, whom team.ts draws on the arc: the layer puts them there. */
const ARC_HEAD_OF_OPERATIONS = "Rocco Bellon";
/** The head of R&D, whom team.ts draws on the arc in no department: the layer adds them at its end. */
const ARC_HEAD_OF_RESEARCH = "Marco Dona";
export const ADDED_LEADER_PERSON = publicMember(ARC_HEAD_OF_OPERATIONS);
export const ADDED_LAST_LEADER_PERSON = publicMember(ARC_HEAD_OF_RESEARCH);
/** The department the layer adds a division lead to: Research and Development, whose division has nobody yet. */
export const ADDED_LEAD_DEPARTMENT = DEPARTMENT.research;
/** The member shown as that division's lead: an engineer in Hardware, who leads nothing. */
export const ADDED_LEAD_PERSON = publicMember("Paul Teo Devis");

/** The role team.ts's arc gives a leader. */
function arcRole(name: string): string {
  const leader = team.orgChart.leaders.find((l) => l.name === name);
  if (leader === undefined) throw new Error(`${name} is not on lib/about/team.ts's arc`);
  return leader.role;
}

/**
 * The published layer. The photo is the warm stand-in a preview shows for an
 * upload, since the seed uploads no file.
 */
export const TEAM_PAGE_LAYER: TeamPageLayer = {
  leader: { photo: "/team/preview-upload.webp" },
  spots: {
    [RENAMED_HEAD_SPOT]: { role: "Head of Recovery and Landing" },
    [HIDDEN_LEAD_SPOT]: { hidden: true },
  },
  addedLeaders: [
    { id: 1, person: ADDED_LEADER_PERSON, role: arcRole(ARC_HEAD_OF_OPERATIONS), place: { after: ADDED_LEADER_AFTER } },
    { id: 3, person: ADDED_LAST_LEADER_PERSON, role: arcRole(ARC_HEAD_OF_RESEARCH), place: { at: "end" } },
  ],
  departments: {
    [`${ADDED_LEAD_DEPARTMENT}`]: { addedLeads: [{ id: 2, person: ADDED_LEAD_PERSON, division: "Payload Integration" }] },
  },
  addedDepartments: [],
  intro:
    "The Team is more than 150 students from almost every course at Politecnico di Torino. Together they design, build and launch rockets, from the first sketch to the launch rail.",
  groupPhoto: { src: "/team/team-2022-06.jpg", alt: "The whole Team on the steps of Politecnico di Torino, June 2022" },
};

export const TEAM_PAGE_LAYER_ROWS = rowsOf(teamPageLayerVersions, [{ version: "published", layer: TEAM_PAGE_LAYER, updatedAt: PUBLISHED }]);

/** Today's advisors, each published with no draft, in the record's order and standing. */
export const TEAM_PAGE_ADVISOR_ITEMS: readonly AdvisorItem[] = importedAdvisors();

export const TEAM_PAGE_ADVISOR_ROWS = rowsOf(
  teamPageAdvisors,
  TEAM_PAGE_ADVISOR_ITEMS.map(({ id, siteOrder }) => ({ id, siteOrder, createdAt: CREATED })),
);

export const TEAM_PAGE_ADVISOR_VERSION_ROWS = rowsOf(
  teamPageAdvisorVersions,
  contentVersionRows(TEAM_PAGE_ADVISOR_ITEMS).map(({ itemId, kind, content }) => ({
    advisorId: itemId,
    version: kind,
    advisor: content,
    updatedAt: PUBLISHED,
  })),
);

export const teamPageSeed = tableSeedModule({
  name: "team-page",
  owns: [teamPageLayerVersions, teamPageAdvisors, teamPageAdvisorVersions],
  rows: [TEAM_PAGE_LAYER_ROWS, TEAM_PAGE_ADVISOR_ROWS, TEAM_PAGE_ADVISOR_VERSION_ROWS],
});
