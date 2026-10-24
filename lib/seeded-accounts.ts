// The seeded accounts a check signs in as or views as (issue #607, epic
// #597): one plain seat per kind, each holding exactly the roles and grants
// its name says, and the seeded admin testers, who may use View as on a
// preview and under `next dev` only (lib/dashboard/view-as.ts). Every one has
// a stable id and email, so the tester sign-in and the View as dialog can
// name them. The seed's people and access modules (db/seed/people.ts,
// db/seed/access.ts) seed each one from this table, and lib/seed/cases.test.ts
// fails when a seeded seat holds anything its row does not name. It lives
// apart from the seed rows, so the app reads it without loading the seed.

import type { AccessLevel, AccessTarget } from "@/lib/dashboard/division-access";
import { TESTERS } from "@/lib/dev-tester";

/** One active role a seat holds: its type, the kind of unit it sits in, and the full-access seat it carries, if any. */
export type SeatRole = {
  readonly type: "president" | "head" | "lead" | "core";
  readonly unit: "team" | "department" | "division";
  readonly fullAccess: "operations_lead" | "it_lead" | null;
};

/** An area a grant opens: an Access page area, or "Approve orders". */
export type SeatGrantArea = AccessTarget | "approve_orders";

/** One grant a seat holds, given across the whole team. */
export type SeatGrant = {
  readonly area: SeatGrantArea;
  readonly level: AccessLevel;
};

type Account = {
  readonly key: string;
  /** Shared by the `better_auth.user` and `public.users` rows. */
  readonly id: string;
  readonly email: string;
  /** First and last name, as the `users` row holds them. */
  readonly name: string;
  /** What viewing as or signing in as this account shows, in one line. */
  readonly sees: string;
};

/** A plain seat: a seeded person a check views as. */
export type Seat = Account & {
  readonly kind: "seat";
  /** The seat's name in docs/seed-cases.md. */
  readonly label: string;
  /** Null for the applicant, who is no member. */
  readonly memberId: number | null;
  /** Every role the seat holds now, and nothing else. */
  readonly roles: readonly SeatRole[];
  /** Whether the seat held roles that have all ended: the alumnus. */
  readonly former: boolean;
  /** Every grant the seat holds, and nothing else. */
  readonly grants: readonly SeatGrant[];
};

/** A seeded admin tester: Better Auth stores them as an admin; no member row, so no team role and no grant. */
export type AdminTester = Account & {
  readonly kind: "admin-tester";
  readonly label: string;
  readonly storedRole: "admin";
};

export type SeededAccount = Seat | AdminTester;

const role = (type: SeatRole["type"], unit: SeatRole["unit"], fullAccess: SeatRole["fullAccess"] = null): SeatRole => ({ type, unit, fullAccess });

/** A seeded tester's id: `7e57e500-…-0000000000NN`. */
function testerId(n: number): string {
  return `7e57e500-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/**
 * One member per single grant: each Access page area at Can edit across the
 * whole team, held by an invented member of Test Bench (members 905 to 910)
 * beside the member seat.
 */
export const ONE_GRANT_SEATS: readonly (Seat & { readonly memberId: number })[] = (
  [
    ["positions", "Positions"],
    ["applications", "Applications"],
    ["members", "Members"],
    ["alumni", "Alumni"],
    ["content", "Content"],
    ["orders", "Orders"],
  ] as const satisfies readonly (readonly [AccessTarget, string])[]
).map(([area, title], i): Seat & { readonly memberId: number } => ({
  kind: "seat",
  key: `${area}-grant`,
  label: `${title} grant`,
  id: testerId(11 + i),
  email: `${area}-grant.tester@example.com`,
  name: `Tester ${title} Grant`,
  memberId: 905 + i,
  roles: [role("core", "division")],
  former: false,
  grants: [{ area, level: "edit" }],
  sees: `A member of Test Bench whose one grant is ${title} at Can edit across the whole team.`,
}));

/** Every seat and admin tester, in the order docs/seed-cases.md lists them. */
export const SEEDED_ACCOUNTS: readonly SeededAccount[] = [
  {
    kind: "seat",
    key: "team-leader",
    label: "Team leader",
    id: "5eed0000-0000-4000-8000-000000000001",
    email: "andrea.pantano@example.com",
    name: "Andrea Pantano",
    memberId: 1,
    roles: [role("president", "team")],
    former: false,
    grants: [],
    sees: "Every dashboard page, with every tool, by the Team Leader role alone.",
  },
  {
    kind: "seat",
    key: "operations-lead",
    label: "Operations lead",
    id: TESTERS["operations-lead"].id,
    email: TESTERS["operations-lead"].email,
    name: "Tester Operations Lead",
    memberId: 903,
    roles: [role("lead", "department", "operations_lead")],
    former: false,
    grants: [],
    sees: "Every dashboard page, by the operations lead's full-access seat alone.",
  },
  {
    kind: "seat",
    key: "it-lead",
    label: "IT lead",
    id: "5eed0000-0000-4000-8000-000000000011",
    email: "huseyin.gulec@example.com",
    name: "Huseyin Gulec",
    memberId: 11,
    roles: [role("lead", "division", "it_lead")],
    former: false,
    grants: [],
    sees: "Every dashboard page, by the IT lead's full-access seat alone; the one seat that may use View as on production.",
  },
  {
    kind: "seat",
    key: "department-head",
    label: "Department head",
    id: "5eed0000-0000-4000-8000-000000000002",
    email: "marco.delogu@example.com",
    name: "Marco Delogu",
    memberId: 2,
    roles: [role("head", "department")],
    former: false,
    grants: [],
    sees: "Every unit area of Propulsion at Can edit by the head role alone, and the waiting hand-over on the Overview.",
  },
  {
    kind: "seat",
    key: "division-lead",
    label: "Division lead",
    id: TESTERS["division-lead"].id,
    email: TESTERS["division-lead"].email,
    name: "Tester Division Lead",
    memberId: 902,
    roles: [role("lead", "division")],
    former: false,
    grants: [],
    sees: "Leads Test Bench: edits that division's positions and applications by the lead role alone.",
  },
  {
    kind: "seat",
    key: "member",
    label: "Member",
    id: TESTERS.member.id,
    email: TESTERS.member.email,
    name: "Tester Member",
    memberId: 901,
    roles: [role("core", "division")],
    former: false,
    grants: [],
    sees: "A member of Test Bench with no grant: reaches /dashboard with no edit rights.",
  },
  ...ONE_GRANT_SEATS,
  {
    kind: "seat",
    key: "approve-orders",
    label: "Approve-orders holder",
    id: "5eed0000-0000-4000-8000-000000000124",
    email: "claudia.sanna@example.com",
    name: "Claudia Sanna",
    memberId: 124,
    roles: [role("core", "division")],
    former: false,
    grants: [{ area: "approve_orders", level: "edit" }],
    sees: "A member of Information Technology who holds \"Approve orders\" and no other grant: approves or rejects orders.",
  },
  {
    kind: "seat",
    key: "alumni",
    label: "Alumnus",
    id: "5eed0000-0000-4000-8000-000000000050",
    email: "giada.ferraris@example.com",
    name: "Giada Ferraris",
    memberId: 50,
    roles: [],
    former: true,
    grants: [],
    sees: "A former member: every role ended, an Alumni entry kept.",
  },
  {
    kind: "seat",
    key: "non-member",
    label: "Applicant",
    id: TESTERS.applicant.id,
    email: TESTERS.applicant.email,
    name: "Tester Applicant",
    memberId: null,
    roles: [],
    former: false,
    grants: [],
    sees: "Not a member: sees the application form on an open /apply/<slug>.",
  },
  {
    kind: "admin-tester",
    key: "admin-1",
    label: "Admin tester 1",
    id: testerId(21),
    email: "admin-1.tester@example.com",
    name: "Tester Admin One",
    storedRole: "admin",
    sees: "No team role and no grant: on a preview or under next dev, uses View as to see the site as any seeded person.",
  },
  {
    kind: "admin-tester",
    key: "admin-2",
    label: "Admin tester 2",
    id: testerId(22),
    email: "admin-2.tester@example.com",
    name: "Tester Admin Two",
    storedRole: "admin",
    sees: "The same as admin tester 1, so two checks can each view as someone at once.",
  },
];

export const SEATS: readonly Seat[] = SEEDED_ACCOUNTS.filter((a): a is Seat => a.kind === "seat");
export const ADMIN_TESTERS: readonly AdminTester[] = SEEDED_ACCOUNTS.filter((a): a is AdminTester => a.kind === "admin-tester");

/** The seat with this key; throws on a key no seat has. */
export function seatOf(key: string): Seat {
  const seat = SEATS.find((s) => s.key === key);
  if (seat === undefined) throw new Error(`no seeded seat "${key}"`);
  return seat;
}
