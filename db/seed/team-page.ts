// The Team page seed (issue #311): the visual layer /about/the-team lays on
// the page the seeded roles build (lib/about/team-layer.ts, issue #283), and
// the hand-added advisors (lib/about/advisors.ts, issue #286). The layer is
// published, so the public page shows it: the team leader's photo replaced,
// a head's role text changed, a leader added on the arc between the Project
// Manager and the Chief Engineer, a division lead hidden, a division lead
// added to Research and Development, whose one division has nobody in it, and
// the intro text and the group photo's caption changed. Every edit is keyed
// to a spot the seeded roles fill and names only people on the team; none of
// it writes a role, so Reset to team (board 80h) brings back the roles build
// with the intro text and the group photo kept. The advisors are one
// principal and several specialists from today's list, each published.

import { teamPageAdvisors, teamPageAdvisorVersions, teamPageLayerVersions } from "@/db/schema";
import { advisorSeed, type AdvisorItem } from "@/lib/about/advisors";
import type { TeamPageLayer } from "@/lib/about/team-layer";
import { team } from "@/lib/about/team";
import { contentVersionRows } from "./content";
import { DEPARTMENT, DIVISION } from "./structure";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-10-01 10:00:00+00";
const PUBLISHED = "2026-10-12 10:00:00+00";

/** The department whose head's role text the layer changes: Recovery, headed by member 8. */
export const RENAMED_HEAD_SPOT = `head:${DEPARTMENT.recovery}:0` as const;
/** The division lead the layer hides: Engine Control & Systems, led by member 23. */
export const HIDDEN_LEAD_SPOT = `lead:${DIVISION.engineControl}:0` as const;
/** The board seat the added leader follows on the arc; the Chief Engineer comes after them. */
export const ADDED_LEADER_AFTER = "arc:project-manager:0" as const;
/** The member the layer puts on the arc: a core member of Recovery, with no seat of their own. */
export const ADDED_LEADER_PERSON = 21;
/** The department the layer adds a division lead to: Research and Development, whose division has nobody yet. */
export const ADDED_LEAD_DEPARTMENT = DEPARTMENT.research;
/** The member shown as that division's lead: an engineer in Hardware, who leads nothing. */
export const ADDED_LEAD_PERSON = 25;

/** The published layer. The photo is a portrait from the record, standing in, since the seed uploads no file. */
export const TEAM_PAGE_LAYER: TeamPageLayer = {
  leader: { photo: "/team/marco-dona.jpg" },
  spots: {
    [RENAMED_HEAD_SPOT]: { role: "Head of Recovery and Landing" },
    [HIDDEN_LEAD_SPOT]: { hidden: true },
  },
  addedLeaders: [{ id: 1, person: ADDED_LEADER_PERSON, role: "Launch Campaign Coordinator", place: { after: ADDED_LEADER_AFTER } }],
  departments: {
    [`${ADDED_LEAD_DEPARTMENT}`]: { addedLeads: [{ id: 2, person: ADDED_LEAD_PERSON, division: "Payload Integration" }] },
  },
  addedDepartments: [],
  intro:
    "The Team is more than 150 students from almost every course at Politecnico di Torino. Together they design, build and launch rockets, from the first sketch to the launch rail.",
  groupPhoto: { src: "/team/team-2022-06.jpg", alt: "The whole Team on the steps of Politecnico di Torino, June 2022" },
};

export const TEAM_PAGE_LAYER_ROWS = rowsOf(teamPageLayerVersions, [{ version: "published", layer: TEAM_PAGE_LAYER, updatedAt: PUBLISHED }]);

/** The one principal advisor, then the specialists the seed keeps, by name in today's list (lib/about/team.ts). */
export const SEEDED_ADVISOR_NAMES = [
  "Prof. Alfonso Pagani",
  "Salvatore Lagrasta",
  "Luca Loiodice",
  "Francesca Bracaglia",
  "Lorenzo Pezzolato",
] as const;

export const TEAM_PAGE_ADVISOR_ITEMS: readonly AdvisorItem[] = advisorSeed(
  SEEDED_ADVISOR_NAMES.map((name) => {
    const advisor = team.advisors.people.find((a) => a.name === name);
    if (advisor === undefined) throw new Error(`no advisor named "${name}" in lib/about/team.ts`);
    return advisor;
  }),
);

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
