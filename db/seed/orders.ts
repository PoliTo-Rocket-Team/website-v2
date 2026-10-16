// The orders seed (issue #305): purchase requests on the Orders page (issue
// #247), one in every status, made for divisions in different departments.
// Each requester holds a role in the division the order is for; every answer
// is the team leader's, except one approval by the member who holds
// "Approve orders" alone (issue #270).

import { orders } from "@/db/schema";
import { APPROVE_ORDERS_ONLY } from "./access";
import { TESTER_MEMBER, TEAM_LEADER } from "./people";
import { rowsOf, tableSeedModule } from "./rows";
import { DIVISION } from "./structure";

export const ORDER_ROWS = rowsOf(orders, [
  {
    id: 1,
    status: "pending",
    requester: 14,
    divisionId: DIVISION.testBench,
    name: "Pressure transducers",
    description: "https://shop.example.com/pressure-transducer",
    reason: "Two more channels on the feed line for the cold-flow test.",
    quantity: 2,
    price: "189.00",
    quoteName: "orders/quotes/pressure-transducers.pdf",
    createdAt: "2026-10-12 09:30:00+02",
  },
  {
    id: 2,
    status: "pending",
    requester: TESTER_MEMBER["division-lead"],
    divisionId: DIVISION.missionAnalysis,
    name: "Flight simulator licence",
    description: "https://shop.example.com/academic",
    reason: "Trajectory runs for the next launch campaign.",
    quantity: 1,
    price: "240.00",
    quoteName: null,
    createdAt: "2026-10-13 15:10:00+02",
  },
  {
    id: 3,
    status: "changes_requested",
    requester: 17,
    divisionId: DIVISION.designManufacturing,
    name: "Carbon fibre prepreg",
    description: "https://shop.example.com/carbon-fibre-prepreg",
    reason: "Layup for the new airframe section.",
    quantity: 10,
    price: "62.50",
    quoteName: "orders/quotes/prepreg.pdf",
    createdAt: "2026-10-05 11:00:00+02",
    reviewNote: "Please add the supplier's quote with shipping included.",
    reviewedBy: TEAM_LEADER,
    reviewedAt: "2026-10-06 18:20:00+02",
  },
  {
    id: 4,
    status: "rejected",
    requester: 27,
    divisionId: DIVISION.recovery,
    name: "Spare drogue parachute",
    description: "https://shop.example.com/drogue",
    reason: "A backup for the test drops.",
    quantity: 1,
    price: "310.00",
    quoteName: null,
    createdAt: "2026-09-22 10:45:00+02",
    reviewNote: "The current drogue is fine for this season; ask again before the launch.",
    reviewedBy: TEAM_LEADER,
    reviewedAt: "2026-09-24 09:00:00+02",
  },
  {
    id: 5,
    status: "accepted",
    requester: 13,
    divisionId: DIVISION.hardware,
    name: "PCB batch",
    description: "https://shop.example.com/pcb-batch",
    reason: "Flight computer rev C boards.",
    quantity: 5,
    price: "48.00",
    quoteName: "orders/quotes/pcb-rev-c.pdf",
    createdAt: "2026-10-01 14:00:00+02",
    reviewedBy: APPROVE_ORDERS_ONLY,
    reviewedAt: "2026-10-02 10:30:00+02",
  },
  {
    id: 6,
    status: "ordered",
    requester: 7,
    divisionId: DIVISION.logistics,
    name: "Transport cases",
    description: "https://shop.example.com/cases",
    reason: "Carrying the ground station to the launch site.",
    quantity: 3,
    price: "145.00",
    quoteName: null,
    createdAt: "2026-09-15 16:30:00+02",
    reviewedBy: TEAM_LEADER,
    reviewedAt: "2026-09-16 12:00:00+02",
  },
  {
    id: 7,
    status: "cancelled",
    requester: 26,
    divisionId: DIVISION.flightControl,
    name: "IMU evaluation board",
    description: "https://shop.example.com/imu-eval",
    reason: "Comparing two IMUs for the avionics bay.",
    quantity: 1,
    price: "95.00",
    quoteName: null,
    createdAt: "2026-09-28 09:15:00+02",
  },
]);

export const ordersSeed = tableSeedModule({
  name: "orders",
  owns: [orders],
  rows: [ORDER_ROWS],
});
