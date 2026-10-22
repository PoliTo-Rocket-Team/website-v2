// The email alias seed (issue #550, epic #538): one request in each state
// boards 94 to 94g show, so a preview reaches every alias screen without a
// hand-made write. Alias requests are private, so every row is invented
// (issue #326). The division-lead tester, the Test Bench lead, sent the
// manual ones for people in Test Bench:
//
// - one still open, so the lead's member drawer shows "Requested · by you"
//   with Cancel request (board 94b), and the team leader's, the operations
//   lead's and the IT lead's Overviews show it with Decline and Mark created
//   (boards 94c, 94d);
// - one marked created, for the member tester, whose alias is on their record
//   and not yet set up, so their Overview shows "Your email alias is ready"
//   and its setup steps (boards 94f, 94g) and the lead's drawer shows the
//   address (board 94e);
// - one declined, so the lead's Overview shows the declined notice and the
//   drawer offers Request alias again (board 94).
//
// The site made the last one by itself when the Mission Analysis lead became
// lead (issue #543): it has no requester, so the approvers' row reads
// "Automatic" (board 94c). Each answered request carries the notices the
// answer writes (lib/dashboard/alias-request.ts, `aliasAnswerNotices`). The
// created alias itself is on the member tester's row, which `people` owns
// (`TESTER_MEMBER_ALIAS`); these rows go in after it.

import { aliasRequests, dashboardNotices } from "@/db/schema";
import { TEAM_LEADER, TESTER_MEMBER, TESTER_MEMBER_ALIAS } from "./people";
import { publicMember } from "./public-team";
import { rowsOf, tableSeedModule } from "./rows";

const LEAD = TESTER_MEMBER["division-lead"];
const OPERATIONS_LEAD = TESTER_MEMBER["operations-lead"];

/** The open request the Test Bench lead sent, for a Test Engineer. */
export const OPEN_REQUEST = { id: 1, member: publicMember("Dimitri Mazzone"), by: LEAD } as const;
/** The open request the site made when the Mission Analysis lead became lead. */
export const AUTOMATIC_REQUEST = { id: 2, member: publicMember("Maria Angelica Fullone Penna") } as const;
/** The request marked created: the member tester's alias, on their record and not yet set up. */
export const CREATED_ALIAS = { id: 3, member: TESTER_MEMBER.member, by: LEAD, address: TESTER_MEMBER_ALIAS } as const;
/** The request the operations lead declined, for another Test Engineer. */
export const DECLINED_REQUEST = { id: 4, member: publicMember("Margherita Boatto"), by: LEAD, declinedBy: OPERATIONS_LEAD } as const;

/** Who declined it, by name, as the notice stores it (`aliasAnswerNotices`). */
const DECLINED_BY = "Tester Operations Lead";

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
    recipientId: CREATED_ALIAS.member,
    subjectId: CREATED_ALIAS.member,
    kind: "alias-ready",
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

// The seed writes no other notice, and resetting `people` empties the table
// anyway (its members cascade), so this module owns it whole.
export const aliasesSeed = tableSeedModule({
  name: "aliases",
  owns: [aliasRequests, dashboardNotices],
  rows: [ALIAS_REQUEST_ROWS, ALIAS_NOTICE_ROWS],
});
