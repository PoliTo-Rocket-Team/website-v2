// The email alias seed (issue #550, epic #538): one request in each state
// boards 94 to 94g show, so a preview reaches every alias screen without a
// hand-made write. Alias requests are private, so every row is invented
// (issue #326). The Test Bench lead, the division-lead plain seat, sent the
// manual ones for people in Test Bench:
//
// - one still open, so the lead's member drawer shows "Requested · by you"
//   with Cancel request (board 94b), and the team leader's, the operations
//   lead's and the IT lead's Overviews show it with Decline and Mark created
//   (boards 94c, 94d);
// - one marked created, for the member plain seat, whose alias is on their record
//   and not yet set up, so their Overview shows "Your email alias is ready"
//   and its setup steps (boards 94f, 94g) and the lead's drawer shows the
//   address (board 94e);
// - one declined, so the lead's Overview shows the declined notice and the
//   drawer offers Request alias again (board 94).
//
// The site made the last one by itself when the Mission Analysis lead became
// lead (issue #543): it has no requester, so the approvers' row reads
// "Automatic" (board 94c). Each answered request carries the notices the
// answer writes (lib/dashboard/alias-request.ts, `aliasAnswerNotices`). A
// member's alias is their PRT email (issue #563): the created one is the
// member seat's PRT email, and the members still owed one have none, on the
// rows `people` owns (`MEMBER_SEAT_ALIAS`, `OWED_ALIAS`); these rows go in
// after them.
//
// The member seat also holds two shared team addresses (epic #578, issue
// #786), so their side view lists them as special lines of the PRT emails row
// (issue #798): one that moves with the Logistics lead, one tied to no role.
// The addresses are invented, on the seed's team domain. The Logistics one is
// set up and the recruitment one is not, so their Overview shows one PRT email
// ready card.

import { aliasRequests, dashboardNotices, teamAddresses } from "@/db/schema";
import { MEMBER_SEAT, MEMBER_SEAT_ALIAS, OPERATIONS_HEAD, OWED_ALIAS, SEED_TEAM_EMAIL_DOMAIN, TEAM_LEADER, TEST_BENCH_LEAD } from "./people";
import { rowsOf, tableSeedModule } from "./rows";
import { DIVISION } from "./structure";

const LEAD = TEST_BENCH_LEAD;
/** The head of Operations, in the operations lead's seat: an approver. */
const OPERATIONS_LEAD = OPERATIONS_HEAD;

/** The open request the Test Bench lead sent, for a Test Engineer. */
export const OPEN_REQUEST = { id: 1, member: OWED_ALIAS.open, by: LEAD } as const;
/** The open request the site made when the Mission Analysis lead became lead. */
export const AUTOMATIC_REQUEST = { id: 2, member: OWED_ALIAS.automatic } as const;
/** The request marked created: the member seat's alias, their PRT email, not yet set up. */
export const CREATED_ALIAS = { id: 3, member: MEMBER_SEAT, by: LEAD, address: MEMBER_SEAT_ALIAS } as const;
/** The request the operations lead declined, for another Test Engineer. */
export const DECLINED_REQUEST = { id: 4, member: OWED_ALIAS.declined, by: LEAD, declinedBy: OPERATIONS_LEAD } as const;

/** Who declined it, by name, as the notice stores it (`aliasAnswerNotices`). */
const DECLINED_BY = "Rocco Bellon";

export const ALIAS_REQUEST_ROWS = rowsOf(aliasRequests, [
  {
    id: OPEN_REQUEST.id,
    memberId: OPEN_REQUEST.member,
    requestedBy: OPEN_REQUEST.by,
    createdAt: "2026-10-20 09:15:00+00",
    outcome: null,
    answeredBy: null,
    answeredAt: null,
  },
  {
    id: AUTOMATIC_REQUEST.id,
    memberId: AUTOMATIC_REQUEST.member,
    requestedBy: null,
    createdAt: "2026-10-21 08:00:00+00",
    outcome: null,
    answeredBy: null,
    answeredAt: null,
  },
  {
    id: CREATED_ALIAS.id,
    memberId: CREATED_ALIAS.member,
    requestedBy: CREATED_ALIAS.by,
    createdAt: "2026-10-15 10:00:00+00",
    outcome: "created",
    answeredBy: TEAM_LEADER,
    answeredAt: "2026-10-16 14:30:00+00",
  },
  {
    id: DECLINED_REQUEST.id,
    memberId: DECLINED_REQUEST.member,
    requestedBy: DECLINED_REQUEST.by,
    createdAt: "2026-10-17 11:00:00+00",
    outcome: "declined",
    answeredBy: DECLINED_REQUEST.declinedBy,
    answeredAt: "2026-10-18 16:45:00+00",
  },
]);

/** The notices each answer wrote, at the time it was answered. */
export const ALIAS_NOTICE_ROWS = rowsOf(dashboardNotices, [
  {
    recipientId: CREATED_ALIAS.by,
    subjectId: CREATED_ALIAS.member,
    kind: "alias-created",
    data: { address: CREATED_ALIAS.address },
    createdAt: "2026-10-16 14:30:00+00",
  },
  {
    recipientId: DECLINED_REQUEST.by,
    subjectId: DECLINED_REQUEST.member,
    kind: "alias-declined",
    data: { by: DECLINED_BY },
    createdAt: "2026-10-18 16:45:00+00",
  },
]);

/** The member seat's two team addresses (board 102): one moves with the Logistics lead, one with no role. */
export const TEAM_ADDRESS_ROWS = rowsOf(teamAddresses, [
  {
    address: `logistics@${SEED_TEAM_EMAIL_DOMAIN}`,
    purpose: "Logistics",
    holderId: MEMBER_SEAT,
    movesWith: "division_lead",
    movesWithSeat: null,
    movesWithDeptId: null,
    movesWithDivisionId: DIVISION.logistics,
    setUpAt: "2026-10-17 09:00:00+00",
    createdAt: "2026-10-16 15:00:00+00",
    updatedAt: "2026-10-16 15:00:00+00",
  },
  {
    address: `recruitment@${SEED_TEAM_EMAIL_DOMAIN}`,
    purpose: "Recruitment",
    holderId: MEMBER_SEAT,
    movesWith: null,
    movesWithSeat: null,
    movesWithDeptId: null,
    movesWithDivisionId: null,
    setUpAt: null,
    createdAt: "2026-10-16 15:05:00+00",
    updatedAt: "2026-10-16 15:05:00+00",
  },
]);

// The seed writes no other notice, and resetting `people` empties the table
// anyway (its members cascade), so this module owns it whole. The same holds
// for the team addresses, each held by a seeded member.
export const aliasesSeed = tableSeedModule({
  name: "aliases",
  owns: [aliasRequests, dashboardNotices, teamAddresses],
  rows: [ALIAS_REQUEST_ROWS, ALIAS_NOTICE_ROWS, TEAM_ADDRESS_ROWS],
});
