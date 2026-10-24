// The seeded accounts a check signs in as or views as (issues #607, #653,
// epic #597): one plain seat per kind, each a normal seeded person who holds
// exactly the roles and grants its name says, and the seeded admin testers,
// who hold no team role. Every one has a stable id and email, so the tester
// sign-in and the View as dialog can name them. No seat is a dedicated tester
// person (issue #653): each is someone the people seed writes like any other
// member or applicant (db/seed/people.ts), and lib/seed/cases.test.ts fails
// when a seeded seat holds anything its row does not name. A check that needs
// a grant gives it to a normal seeded member through the Access page and
// removes it afterwards (docs/seed-cases.md, "Test seats"). It lives apart
// from the seed rows, so the app reads it without loading the seed.

import type { AccessLevel, AccessTarget } from "@/lib/dashboard/division-access";

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

/** A plain seat: a seeded person a check signs in as or views as. */
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

/** The domain every seeded person's email sits on: reserved for examples, so no mail reaches anyone and no real account has it. */
export const SEED_EMAIL_DOMAIN = "example.com";

/**
 * A seeded person's sign-in key (issue #653): the part of their seeded email
 * before the `@`, such as `beatrice.la.motta`. Every seeded person has one,
 * since the seed gives each a unique email on `SEED_EMAIL_DOMAIN`.
 */
export const PERSON_KEY = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/** The seeded email a person key names. */
export function seededEmailOf(personKey: string): string {
  return `${personKey}@${SEED_EMAIL_DOMAIN}`;
}

/** Whether an email is one the seed makes: on the reserved domain the seed's people use. */
export function isSeededEmail(email: string): boolean {
  return email.endsWith(`@${SEED_EMAIL_DOMAIN}`);
}

const role = (type: SeatRole["type"], unit: SeatRole["unit"], fullAccess: SeatRole["fullAccess"] = null): SeatRole => ({ type, unit, fullAccess });

/** An admin tester's id: `7e57e500-…-0000000000NN`. */
function adminTesterId(n: number): string {
  return `7e57e500-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

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
    id: "5eed0000-0000-4000-8000-000000000003",
    email: "rocco.bellon@example.com",
    name: "Rocco Bellon",
    memberId: 3,
    roles: [role("head", "department", "operations_lead")],
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
    id: "5eed0000-0000-4000-8000-000000000195",
    email: "stefano.motta@example.com",
    name: "Stefano Motta",
    memberId: 195,
    roles: [role("lead", "division"), role("core", "division")],
    former: false,
    grants: [],
    sees: "Leads Test Bench: edits that division's positions and applications by the lead role alone.",
  },
  {
    kind: "seat",
    key: "member",
    label: "Member",
    id: "5eed0000-0000-4000-8000-000000000140",
    email: "filippo.prosperi@example.com",
    name: "Filippo Prosperi",
    memberId: 140,
    roles: [role("core", "division")],
    former: false,
    grants: [],
    sees: "A member of Test Bench with no grant: reaches /dashboard with no edit rights.",
  },
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
    id: "1e444444-4444-4444-4444-444444444444",
    email: "giulia.ferri@example.com",
    name: "Giulia Ferri",
    memberId: null,
    roles: [],
    former: false,
    grants: [],
    sees: "Not a member: holds an application with interview times to pick and a new one, and sees the form on an open /apply/<slug>.",
  },
  {
    kind: "admin-tester",
    key: "admin-1",
    label: "Admin tester 1",
    id: adminTesterId(21),
    email: "admin-1.tester@example.com",
    name: "Tester Admin One",
    storedRole: "admin",
    sees: "No team role and no grant: on a preview or under next dev, uses View as to see the site as any seeded person.",
  },
  {
    kind: "admin-tester",
    key: "admin-2",
    label: "Admin tester 2",
    id: adminTesterId(22),
    email: "admin-2.tester@example.com",
    name: "Tester Admin Two",
    storedRole: "admin",
    sees: "The same as admin tester 1, so two checks can each view as someone at once.",
  },
];

export const SEATS: readonly Seat[] = SEEDED_ACCOUNTS.filter((a): a is Seat => a.kind === "seat");
export const ADMIN_TESTERS: readonly AdminTester[] = SEEDED_ACCOUNTS.filter((a): a is AdminTester => a.kind === "admin-tester");

/** The seat or admin tester with this key, or undefined. */
export function seededAccountOf(key: string): SeededAccount | undefined {
  return SEEDED_ACCOUNTS.find((a) => a.key === key);
}

/** The seat with this key; throws on a key no seat has. */
export function seatOf(key: string): Seat {
  const seat = SEATS.find((s) => s.key === key);
  if (seat === undefined) throw new Error(`no seeded seat "${key}"`);
  return seat;
}
