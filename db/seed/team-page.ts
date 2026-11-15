// The Team page seed (issues #311, #326): the published version
// /about/the-team draws, its layout of page seats (lib/about/team-layout.ts,
// issue #850) and its visual layer (lib/about/team-layer.ts, issue #283), and
// the hand-added advisors (lib/about/advisors.ts, issue #286).
//
// The version is published, so the public page shows it. Its layout is the
// seeded team record's places (`recordLayout`) in today's two groups,
// "Technical Departments" and "Operations", with four edits. Two put on the
// arc the two leaders lib/about/team.ts draws there whom no board seat
// places, each bound to themselves (ADR 0019 Decision 3): the head of
// Operations, between the Project Manager and the Chief Engineer, and the
// head of R&D, whose department has no divisions, after them. The other edits
// are invented, since the public data holds no editor's changes: a head's
// role text changed and a division lead left off, and the layer's intro text
// and group photo caption changed. No lead row shows someone leading a
// division they hold no lead role in (issue #644). The team leader is left as
// the record draws him, with his own photo: a stand-in photo there showed a
// plain orange disc in his circle on every preview (issue #390). Every page
// seat is bound to a seat the seeded team fills or to someone on the team;
// none of it writes a role, so Reset to team (board 80h) brings back the
// record's places with the intro text and the group photo kept. The advisors
// are today's (lib/about/advisors-import.ts), each published, as
// drizzle/0035 imports them, except that an advisor's real email is swapped
// for an invented one on a reserved domain: emails stay private.

import { teamPageAdvisors, teamPageAdvisorVersions, teamPageLayerVersions } from "@/db/schema";
import { importedAdvisors } from "@/lib/about/advisors-import";
import type { AdvisorItem } from "@/lib/about/advisors";
import type { TeamPageLayer } from "@/lib/about/team-layer";
import { holdingOf, nextSeatId, recordLayout, type LayoutGroup, type PageSeat, type PlaceBinding, type TeamLayout } from "@/lib/about/team-layout";
import type { TeamRoles } from "@/lib/about/team-roles";
import { team } from "@/lib/about/team";
import { contentVersionRows } from "./content";
import { MEMBER_ROWS, ROLE_ROWS, USER_ROWS } from "./people";
import { publicMember } from "./public-team";
import { DEPARTMENT, DEPARTMENT_ROWS, DIVISION, DIVISION_ROWS } from "./structure";
import { rowsOf, tableSeedModule } from "./rows";
import { teamRolesOf } from "./team-roles";

const CREATED = "2026-10-01 10:00:00+00";
const PUBLISHED = "2026-10-12 10:00:00+00";

/** The department whose head's role text the layout changes: Recovery. */
export const RENAMED_HEAD_DEPARTMENT = DEPARTMENT.recovery;
/** The role text the layout shows under the head of Recovery. */
export const RENAMED_HEAD_ROLE = "Head of Recovery and Landing";
/** The division whose first lead the layout leaves off: Engine Control System. */
export const HIDDEN_LEAD_DIVISION = DIVISION.engineControl;
/** The flagged seat the added leader follows on the arc; the Chief Engineer comes after them. */
export const ADDED_LEADER_AFTER = "project-manager" as const;
/** The head of Operations, whom team.ts draws on the arc: the layout puts them there. */
const ARC_HEAD_OF_OPERATIONS = "Rocco Bellon";
/** The head of R&D, whom team.ts draws on the arc: their department has no divisions, so the page has no block for it, and the layout adds them at the arc's end. */
const ARC_HEAD_OF_RESEARCH = "Marco Dona";
export const ADDED_LEADER_PERSON = publicMember(ARC_HEAD_OF_OPERATIONS);
export const ADDED_LAST_LEADER_PERSON = publicMember(ARC_HEAD_OF_RESEARCH);

/** The role team.ts's arc gives a leader. */
function arcRole(name: string): string {
  const leader = team.orgChart.leaders.find((l) => l.name === name);
  if (leader === undefined) throw new Error(`${name} is not on lib/about/team.ts's arc`);
  return leader.role;
}

/** The published layer: the intro text and the group photo's caption changed. */
export const TEAM_PAGE_LAYER: TeamPageLayer = {
  intro:
    "The Team is more than 150 students from almost every course at Politecnico di Torino. Together they design, build and launch rockets, from the first sketch to the launch rail.",
  groupPhoto: { src: "/team/team-2022-06.jpg", alt: "The whole Team on the steps of Politecnico di Torino, June 2022" },
};

/** The seeded team, as the Team page reads it from the structure and people modules' rows. */
const SEEDED_ROLES = teamRolesOf({
  departments: DEPARTMENT_ROWS.rows,
  divisions: DIVISION_ROWS.rows,
  members: MEMBER_ROWS.rows,
  users: USER_ROWS.rows,
  roles: ROLE_ROWS.rows,
});

/** Today's two department groups: Operations draws its leads beside its head. */
const SEEDED_GROUPS: readonly LayoutGroup[] = [
  { id: 1, name: "Technical Departments" },
  { id: 2, name: "Operations" },
];

/** A page seat bound to `memberId`, with `role` under the name where their own title reads another. */
function personSeat(id: number, memberId: number, role: string): PageSeat {
  const binding: PlaceBinding = { kind: "person", memberId };
  return { id, binding, overrides: holdingOf(binding, SEEDED_ROLES)?.title === role ? {} : { role } };
}

/** The team record's places on `roles` in today's two groups, Operations in its own with its leads beside its head, as the seed lays them out. */
export function seededRecordLayout(roles: TeamRoles): TeamLayout {
  return recordLayout(roles, SEEDED_GROUPS, (departmentId) =>
    departmentId === DEPARTMENT.operations ? { group: 2, leadsDrawn: "beside" } : { group: 1, leadsDrawn: "under" },
  );
}

/** The published layout: the seeded team record's places, with the four edits above. */
function seededLayout(): TeamLayout {
  const record = seededRecordLayout(SEEDED_ROLES);
  const first = nextSeatId(record);
  const after = record.arc.findIndex((s) => s.binding.kind === "full-access-seat" && s.binding.seat === ADDED_LEADER_AFTER);
  if (after === -1) throw new Error(`The seeded arc has no ${ADDED_LEADER_AFTER} seat`);
  const arc = [
    ...record.arc.slice(0, after + 1),
    personSeat(first, ADDED_LEADER_PERSON, arcRole(ARC_HEAD_OF_OPERATIONS)),
    ...record.arc.slice(after + 1),
    personSeat(first + 1, ADDED_LAST_LEADER_PERSON, arcRole(ARC_HEAD_OF_RESEARCH)),
  ];
  const departments = record.departments.map((block) => ({
    ...block,
    head: block.department === RENAMED_HEAD_DEPARTMENT ? { ...block.head, overrides: { ...block.head.overrides, role: RENAMED_HEAD_ROLE } } : block.head,
    leads: block.leads.filter(({ binding }) => !(binding.kind === "division-lead" && binding.divisionId === HIDDEN_LEAD_DIVISION && binding.place === 0)),
  }));
  return { ...record, arc, departments };
}

/** The published version, as a save from the editor stores it. */
export const TEAM_PAGE_LAYER_ROWS = rowsOf(teamPageLayerVersions, [
  { version: "published", layer: TEAM_PAGE_LAYER, layout: seededLayout(), updatedAt: PUBLISHED },
]);

/** An invented address for advisor `id`, on a domain reserved for examples (RFC 2606). */
export const seededAdvisorEmail = (id: number) => `advisor-${id}@example.com`;

/** The advisor as the seed writes them: their real email, if any, swapped for an invented one. */
function withInventedEmail(item: AdvisorItem): AdvisorItem {
  if (item.version.state !== "published" || item.version.published.email === undefined) return item;
  return { ...item, version: { ...item.version, published: { ...item.version.published, email: seededAdvisorEmail(item.id) } } };
}

/** Today's advisors, each published with no draft, in the record's order and standing. */
export const TEAM_PAGE_ADVISOR_ITEMS: readonly AdvisorItem[] = importedAdvisors().map(withInventedEmail);

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
