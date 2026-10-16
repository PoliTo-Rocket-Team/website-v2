// The hand-over seed (issue #308): hand-overs sent from My profile (issue
// #262), one still waiting for the next level up and one confirmed. The
// waiting one is a division lead's in Aerodynamics, so the department-head
// test viewer (its head) answers it from their Overview (board 62c). The
// confirmed one is the Liquid Systems Architecture lead's, written the way
// Confirm writes it (lib/dashboard/database-team.ts): the lead row ended and
// an Advisor role started in the division on the day it was confirmed, the
// successor's own row there made the lead, and the sender's access gone. The
// people seed holds those roles (./people.ts). Its rows go in after every
// role, so the trigger that closes a request when its sender's roles change
// (drizzle/0029) leaves the waiting one waiting.

import { handOverRequests } from "@/db/schema";
import { DIVISION_ADVISOR, LSA_HAND_OVER_DAY, LSA_SUCCESSOR, PROPULSION_HEAD, WAITING_HAND_OVER } from "./people";
import { rowsOf, tableSeedModule } from "./rows";
import { DIVISION } from "./structure";

export const HAND_OVER_ROWS = rowsOf(handOverRequests, [
  {
    id: 1,
    fromId: DIVISION_ADVISOR,
    role: "lead",
    divisionId: DIVISION.liquidSystems,
    deptId: null,
    toId: LSA_SUCCESSOR,
    outcome: "advisor",
    createdAt: "2022-09-20 10:00:00+00",
    decision: "confirmed",
    decidedBy: PROPULSION_HEAD,
    decidedAt: `${LSA_HAND_OVER_DAY} 10:00:00+00`,
  },
  {
    id: 2,
    fromId: WAITING_HAND_OVER.from,
    role: "lead",
    divisionId: DIVISION.optimization,
    deptId: null,
    toId: WAITING_HAND_OVER.to,
    outcome: "advisor",
    createdAt: "2026-10-14 09:30:00+00",
    decision: null,
    decidedBy: null,
    decidedAt: null,
  },
]);

export const handOversSeed = tableSeedModule({
  name: "hand-overs",
  owns: [handOverRequests],
  rows: [HAND_OVER_ROWS],
});
