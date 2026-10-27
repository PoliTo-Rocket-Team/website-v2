import { isAdvisorVersion, type AdvisorVersion } from "@/lib/about/advisors";
import { faqFieldErrors } from "@/lib/faq/faq";
import { UNCLEAR_QUITTER_KINDS, type At, type Conflict } from "./conflicts";
import { matchPeople, nameKey, normalEmail, signInEmail, type Person } from "./people";
import type { ExistingRole, Snapshot } from "./snapshot";
import { dayOf, type Sources } from "./sources";
import { seatOf, storedTitle, type FullAccessSeat, type PositionType, type Seat } from "./titles";
import { departmentNamed, divisionNamed, unitKey, unitNames } from "./units";

// What an import would write (issue #677), worked out from the sources and a
// snapshot of the database before anything is written. The plan is the whole
// decision: a dry run prints it, an import writes exactly its rows and nothing
// else. Every row is an insert; a row the database already holds is counted as
// present and left alone, so a second run plans no insert at all.

/** A person the plan writes for: one it inserts (by their match id), or a member the database already has. */
export type PersonRef = { readonly kind: "new"; readonly person: number } | { readonly kind: "existing"; readonly memberId: number };

export type NewPerson = {
  readonly person: number;
  readonly user: {
    readonly email: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly origin: string | null;
    readonly levelOfStudy: string | null;
    readonly linkedin: string | null;
    readonly politoId: string | null;
    readonly program: string | null;
    readonly country: string | null;
  };
  readonly member: {
    readonly prtEmail: string | null;
    readonly mobileNumber: string | null;
    readonly discord: string | null;
    readonly teamFrom: number | null;
    readonly teamTo: number | null;
  };
};

export type NewRole = {
  readonly who: PersonRef;
  readonly deptId: number | null;
  readonly divisionId: number | null;
  readonly title: string;
  readonly type: PositionType;
  readonly fullAccess: FullAccessSeat | null;
  readonly startedAt: string;
  readonly leavedAt: string | null;
};

export type NewLeave = { readonly who: PersonRef; readonly leftAt: string };
export type NewAdvisor = { readonly siteOrder: number; readonly advisor: AdvisorVersion };
export type NewPosition = {
  readonly divisionId: number | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: boolean;
  readonly requiredSkills: readonly string[];
  readonly desirableSkills: readonly string[];
};
export type NewFaq = { readonly siteOrder: number; readonly question: string; readonly answer: readonly string[] };
export type OrderStatus = "pending" | "accepted" | "rejected" | "changes_requested" | "cancelled" | "ordered";
export type NewOrder = {
  readonly requester: PersonRef;
  readonly status: OrderStatus;
  readonly divisionId: number | null;
  readonly description: string | null;
  readonly reason: string | null;
  readonly quantity: number | null;
  readonly price: string | null;
  readonly name: string | null;
  readonly quoteName: string | null;
  readonly createdAt: string;
};

/** The tables the import writes, in the order the report lists them. */
export const TABLES = [
  "users",
  "members",
  "roles",
  "team_leaves",
  "team_page_advisors",
  "team_page_advisor_versions",
  "apply_positions",
  "faqs",
  "faq_versions",
  "orders",
] as const;

export type Table = (typeof TABLES)[number];
export type Count = { insert: number; present: number; refused: number };

export type Plan = {
  readonly currentYear: number | null;
  readonly people: readonly NewPerson[];
  readonly roles: readonly NewRole[];
  readonly leaves: readonly NewLeave[];
  readonly advisors: readonly NewAdvisor[];
  readonly positions: readonly NewPosition[];
  readonly faqs: readonly NewFaq[];
  readonly orders: readonly NewOrder[];
  readonly counts: Readonly<Record<Table, Count>>;
  /** FAQ rows the export marks not visible: skipped, never imported. */
  readonly hiddenFaqs: number;
  readonly alumni: number;
  readonly multiYear: number;
  readonly unclearQuitters: number;
  readonly conflicts: readonly Conflict[];
};

const ORDER_STATUSES: readonly OrderStatus[] = ["pending", "accepted", "rejected", "changes_requested", "cancelled", "ordered"];

/** The first day of academic year `y` ("2024-10-01"): the team's year runs 1 October to 30 September. */
export const yearStart = (y: number) => `${y}-10-01`;
/** The last day of academic year `y` ("2025-09-30"). */
export const yearEnd = (y: number) => `${y + 1}-09-30`;

/** A LinkedIn link or bare handle as `users.linkedin` stores it (the full profile link); null when it is neither. */
export function linkedinLink(text: string): string | null {
  const handle = linkedinHandleOf(text);
  return handle === null ? null : `https://www.linkedin.com/in/${handle}`;
}

function linkedinHandleOf(text: string): string | null {
  const t = text.trim();
  const m = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?$/i.exec(t) ?? /^@?([A-Za-z0-9\-_%]{3,100})$/.exec(t);
  return m === null ? null : m[1];
}

const orNull = (text: string | undefined) => (text === undefined || text.trim() === "" ? null : text.trim());

/** A list cell from the old export: a JSON array, a Postgres array literal, or one item per line. */
export function listOf(text: string): string[] {
  const t = text.trim();
  if (t === "") return [];
  if (t.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter((s) => s !== "");
    } catch {
      // read as lines below
    }
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    return [...t.slice(1, -1).matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2]).replace(/\\(.)/g, "$1").trim()).filter((s) => s !== "");
  }
  return t
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter((s) => s !== "");
}

const truthy = (text: string) => /^(true|t|1|yes|y)$/i.test(text.trim());
const falsy = (text: string) => /^(false|f|0|no|n)$/i.test(text.trim());

class Counter {
  readonly counts = Object.fromEntries(TABLES.map((t) => [t, { insert: 0, present: 0, refused: 0 }])) as Record<Table, Count>;
  add(table: Table, kind: keyof Count, n = 1): void {
    this.counts[table][kind] += n;
  }
}

/** A role's place: the unit columns it is stored with. */
type Placement = { readonly deptId: number | null; readonly divisionId: number | null };

export function planImport(sources: Sources, snapshot: Snapshot): Plan {
  const { people, conflicts: matchConflicts } = matchPeople(sources);
  const conflicts: Conflict[] = [...sources.conflicts, ...matchConflicts];
  const counter = new Counter();
  const currentYear = sources.currentYear;
  const units = snapshot.units;

  // Seats --------------------------------------------------------------------

  /** The placements a seat's cells give, or the field that resolves to no unit. */
  const placements = (unit: Seat, subteam: string, division: string, type: PositionType): Placement[] | { field: string } => {
    if (unit.unit === "board") return [{ deptId: null, divisionId: null }];
    if (units === null) return [{ deptId: null, divisionId: null }];
    const byDivision = () => {
      const names = unitNames(division);
      const found = names.map((n) => divisionNamed(units, n));
      return names.length === 0 || found.some((d) => d === null) ? { field: "division" } : found.map((d) => ({ deptId: d!.deptId, divisionId: d!.id }));
    };
    const byDepartment = () => {
      const names = unitNames(subteam);
      const found = names.map((n) => departmentNamed(units, n));
      return names.length === 0 || found.some((d) => d === null) ? { field: "subteam" } : found.map((d) => ({ deptId: d!.id, divisionId: null }));
    };
    if (unit.unit === "division") return byDivision();
    if (unit.unit === "department") return byDepartment();
    if (unitNames(division).length > 0) return byDivision();
    if (unitNames(subteam).length > 0) return byDepartment();
    return type === "advisor" ? [{ deptId: null, divisionId: null }] : { field: "subteam" };
  };

  /** The active seats held now: a second holder of one is refused, as the unique indexes of migration 0062 would. */
  const seatKey = (r: Pick<ExistingRole, "type" | "fullAccess" | "deptId">): string | null =>
    r.type === "president" ? "president" : r.fullAccess !== null ? `full:${r.fullAccess}` : r.type === "head" && r.deptId !== null ? `head:${r.deptId}` : null;
  const heldSeats = new Set(snapshot.roles.filter((r) => r.leavedAt === null).flatMap((r) => seatKey(r) ?? []));

  const sameRole = (a: ExistingRole, b: Omit<NewRole, "who">) =>
    a.deptId === b.deptId && a.divisionId === b.divisionId && a.title === b.title && a.startedAt === b.startedAt && a.leavedAt === b.leavedAt;

  // People -------------------------------------------------------------------

  const newPeople: NewPerson[] = [];
  const newRoles: NewRole[] = [];
  const leaves: NewLeave[] = [];
  const refOf = new Map<number, PersonRef>();
  /** Each person's division ids by academic year, for an order's division. */
  const divisionsByYear = new Map<number, Map<number, Set<number>>>();
  let alumni = 0;

  const importedNames = new Map<string, number[]>();
  for (const entry of snapshot.importedAlumni) {
    const key = nameKey(entry.name, "");
    importedNames.set(key, [...(importedNames.get(key) ?? []), ...entry.years]);
  }

  for (const person of people) {
    const years = [...person.years.keys()].sort((a, b) => a - b);
    const newest = person.years.get(years[years.length - 1])!;
    const onCurrent = currentYear !== null && person.years.has(currentYear);
    if (person.quitter !== null && onCurrent) conflicts.push({ kind: "quitter-on-current-sheet", at: person.quitter.at });

    const email = signInEmail(person);
    if (email === null) {
      conflicts.push({ kind: "missing-email", at: newest.at });
      counter.add("users", "refused");
      counter.add("members", "refused");
      continue;
    }
    const accounts = snapshot.users.filter((u) => person.emails.has(u.email) || u.email === email);
    const account = accounts.find((u) => u.member !== null) ?? accounts[0];
    if (account !== undefined && account.member === null) {
      conflicts.push({ kind: "account-without-member", at: newest.at });
      counter.add("users", "refused");
      counter.add("members", "refused");
      continue;
    }
    const ref: PersonRef = account?.member != null ? { kind: "existing", memberId: account.member } : { kind: "new", person: person.id };
    refOf.set(person.id, ref);
    const existingRoles = ref.kind === "existing" ? snapshot.roles.filter((r) => r.memberId === ref.memberId) : [];
    const alumnus = !onCurrent;
    if (alumnus) alumni++;

    if (ref.kind === "existing") {
      counter.add("users", "present");
      counter.add("members", "present");
    } else {
      counter.add("users", "insert");
      counter.add("members", "insert");
      const f = person.fields;
      newPeople.push({
        person: person.id,
        user: {
          email,
          firstName: orNull(f.firstName),
          lastName: orNull(f.lastName),
          origin: orNull(f.origin),
          levelOfStudy: orNull(f.level),
          linkedin: f.linkedin === undefined ? null : linkedinLink(f.linkedin),
          politoId: orNull(f.studentId),
          program: orNull(f.program),
          country: orNull(f.country),
        },
        member: {
          prtEmail: normalEmail(f.prtEmail ?? ""),
          mobileNumber: orNull(f.mobile),
          discord: orNull(f.discord),
          teamFrom: alumnus ? years[0] : null,
          teamTo: alumnus ? years[years.length - 1] : null,
        },
      });
    }

    const importedYears = new Set([...person.names].flatMap((n) => importedNames.get(n) ?? []));
    if ([...person.names].some((n) => importedNames.has(n))) conflicts.push({ kind: "imported-alumni-match", at: newest.at });

    for (const year of years) {
      if (importedYears.has(year)) continue;
      const row = person.years.get(year)!;
      const extra = person.rolesRows.get(year)?.value;
      const title = row.value.title || extra?.title || "";
      const subteam = row.value.subteam || extra?.subteam || "";
      const division = row.value.division || extra?.division || "";
      const seat = seatOf(title);
      if (seat === null) {
        conflicts.push({ kind: "unknown-title", at: row.at, field: "title" });
        counter.add("roles", "refused");
        continue;
      }
      const placed = placements(seat, subteam, division, seat.type);
      if (!Array.isArray(placed)) {
        conflicts.push({ kind: "unknown-unit", at: row.at, field: placed.field });
        counter.add("roles", "refused");
        continue;
      }
      const active = year === currentYear;
      for (const place of placed) {
        const role: Omit<NewRole, "who"> = {
          ...place,
          title: storedTitle(title),
          type: seat.type,
          fullAccess: seat.fullAccess,
          startedAt: yearStart(year),
          leavedAt: active ? null : yearEnd(year),
        };
        if (place.divisionId !== null) {
          const byYear = divisionsByYear.get(person.id) ?? new Map<number, Set<number>>();
          byYear.set(year, (byYear.get(year) ?? new Set()).add(place.divisionId));
          divisionsByYear.set(person.id, byYear);
        }
        if (existingRoles.some((r) => sameRole(r, role))) {
          counter.add("roles", "present");
          continue;
        }
        const key = active ? seatKey(role) : null;
        if (key !== null && heldSeats.has(key)) {
          conflicts.push({ kind: "seat-taken", at: row.at, field: "title" });
          counter.add("roles", "refused");
          continue;
        }
        if (key !== null) heldSeats.add(key);
        newRoles.push({ who: ref, ...role });
        counter.add("roles", "insert");
      }
    }

    if (alumnus) {
      if (ref.kind === "existing" && snapshot.leftMembers.has(ref.memberId)) {
        counter.add("team_leaves", "present");
      } else {
        const left = (person.quitter !== null && dayOf(person.quitter.value.leftOn)) || yearEnd(years[years.length - 1]);
        leaves.push({ who: ref, leftAt: left });
        counter.add("team_leaves", "insert");
      }
    }
  }

  // Advisors -----------------------------------------------------------------

  const advisors: NewAdvisor[] = [];
  const advisorKeys = new Set(snapshot.advisorNames.map((n) => nameKey(n, "")));
  /** The names earlier rows of the CSV gave: a second row for one is a duplicate. */
  const advisorRows = new Set<string>();
  const places = { ...snapshot.advisorPlaces };
  let advisorOrder = snapshot.advisorOrder;
  for (const row of sources.csv.advisors) {
    const name = `${row.value.firstName} ${row.value.lastName}`.replace(/\s+/g, " ").trim();
    const key = nameKey(name, "");
    if (advisorRows.has(key)) {
      conflicts.push({ kind: "duplicate", at: row.at });
      counter.add("team_page_advisors", "refused");
      counter.add("team_page_advisor_versions", "refused");
      continue;
    }
    advisorRows.add(key);
    if (advisorKeys.has(key)) {
      counter.add("team_page_advisors", "present");
      counter.add("team_page_advisor_versions", "present");
      continue;
    }
    const standing = /faculty|prof/i.test(row.value.title) ? "principal" : "specialist";
    const handle = linkedinHandleOf(row.value.linkedin);
    const version = { name, role: row.value.title.trim(), standing, place: places[standing] + 1, ...(handle !== null && { linkedin: handle }) };
    if (!isAdvisorVersion(version)) {
      conflicts.push({ kind: "schema-misfit", at: row.at, field: name === "" ? "first_name" : "title_name" });
      counter.add("team_page_advisors", "refused");
      counter.add("team_page_advisor_versions", "refused");
      continue;
    }
    places[standing] += 1;
    advisors.push({ siteOrder: ++advisorOrder, advisor: version });
    counter.add("team_page_advisors", "insert");
    counter.add("team_page_advisor_versions", "insert");
  }

  // Open positions -------------------------------------------------------------

  const oldDivisions = new Map(sources.csv.divisions.map((d) => [d.value.id.trim(), d.value]));
  const positions: NewPosition[] = [];
  const positionKey = (title: string, divisionId: number | null) => `${unitKey(title)}\u0000${divisionId ?? ""}`;
  const positionKeys = new Set(snapshot.positions.map((p) => positionKey(p.title ?? "", p.divisionId)));
  /** The keys earlier rows of the CSV gave: a second row for one is a duplicate. */
  const positionRows = new Set<string>();
  for (const row of sources.csv.positions) {
    const title = row.value.name.trim();
    if (title === "") {
      conflicts.push({ kind: "schema-misfit", at: row.at, field: "name" });
      counter.add("apply_positions", "refused");
      continue;
    }
    let divisionId: number | null = null;
    if (units !== null) {
      const old = oldDivisions.get(row.value.division.trim());
      const division = [old?.name, old?.code, row.value.division].flatMap((n) => (n ? [divisionNamed(units, n)] : [])).find((d) => d !== null) ?? null;
      if (division === null) {
        conflicts.push({ kind: "unknown-unit", at: row.at, field: "division" });
        counter.add("apply_positions", "refused");
        continue;
      }
      divisionId = division.id;
    }
    const key = positionKey(title, divisionId);
    if (positionRows.has(key)) {
      conflicts.push({ kind: "duplicate", at: row.at });
      counter.add("apply_positions", "refused");
      continue;
    }
    positionRows.add(key);
    if (positionKeys.has(key)) {
      counter.add("apply_positions", "present");
      continue;
    }
    positions.push({
      divisionId,
      title,
      description: orNull(row.value.description),
      status: truthy(row.value.open),
      requiredSkills: listOf(row.value.required),
      desirableSkills: listOf(row.value.desirable),
    });
    counter.add("apply_positions", "insert");
  }

  // FAQs ---------------------------------------------------------------------

  const faqList: NewFaq[] = [];
  const questionKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
  const questions = new Set(snapshot.faqQuestions.map(questionKey));
  const questionRows = new Set<string>();
  let faqOrder = snapshot.faqOrder;
  let hiddenFaqs = 0;
  for (const row of sources.csv.faqs) {
    if (falsy(row.value.visible)) {
      hiddenFaqs++;
      continue;
    }
    const question = row.value.question.replace(/\s+/g, " ").trim();
    const answer = row.value.answer
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p !== "");
    const errors = faqFieldErrors({ question, answer });
    if (errors.question !== undefined || errors.answer !== undefined) {
      conflicts.push({ kind: "schema-misfit", at: row.at, field: errors.question !== undefined ? "question" : "answer" });
      counter.add("faqs", "refused");
      counter.add("faq_versions", "refused");
      continue;
    }
    const key = questionKey(question);
    if (questionRows.has(key)) {
      conflicts.push({ kind: "duplicate", at: row.at });
      counter.add("faqs", "refused");
      counter.add("faq_versions", "refused");
      continue;
    }
    questionRows.add(key);
    if (questions.has(key)) {
      counter.add("faqs", "present");
      counter.add("faq_versions", "present");
      continue;
    }
    faqList.push({ siteOrder: ++faqOrder, question, answer });
    counter.add("faqs", "insert");
    counter.add("faq_versions", "insert");
  }

  // Orders -------------------------------------------------------------------

  const byCsvId = new Map<string, Person>();
  for (const p of people) for (const id of p.csvIds) byCsvId.set(id, p);
  const newOrders: NewOrder[] = [];
  const orderKey = (requester: number | null, name: string | null, at: string) => `${requester ?? ""}\u0000${name ?? ""}\u0000${Date.parse(at)}`;
  const existingOrders = new Set(snapshot.orders.map((o) => orderKey(o.requester, o.name, o.createdAt)));
  for (const row of sources.csv.orders) {
    const person = byCsvId.get(row.value.requester.trim());
    const ref = person === undefined ? undefined : refOf.get(person.id);
    if (person === undefined || ref === undefined) {
      conflicts.push({ kind: "unresolved-requester", at: row.at, field: "requester" });
      counter.add("orders", "refused");
      continue;
    }
    const misfit = (field: string) => {
      conflicts.push({ kind: "schema-misfit", at: row.at, field });
      counter.add("orders", "refused");
    };
    const status = row.value.status.trim() as OrderStatus;
    if (!ORDER_STATUSES.includes(status)) {
      misfit("status");
      continue;
    }
    const quantity = row.value.quantity.trim();
    if (quantity !== "" && !/^\d+$/.test(quantity)) {
      misfit("quantity");
      continue;
    }
    const price = row.value.price.trim();
    if (price !== "" && !/^-?\d+(\.\d+)?$/.test(price)) {
      misfit("price");
      continue;
    }
    const createdAt = row.value.createdAt.trim();
    if (Number.isNaN(Date.parse(createdAt))) {
      misfit("createdAt");
      continue;
    }
    const name = orNull(row.value.name);
    if (ref.kind === "existing" && existingOrders.has(orderKey(ref.memberId, name, createdAt))) {
      counter.add("orders", "present");
      continue;
    }
    const held = divisionsByYear.get(person.id)?.get(academicYearOf(createdAt));
    newOrders.push({
      requester: ref,
      status,
      divisionId: held !== undefined && held.size === 1 ? [...held][0] : null,
      description: orNull(row.value.description),
      reason: orNull(row.value.reason),
      quantity: quantity === "" ? null : Number(quantity),
      price: price === "" ? null : price,
      name,
      quoteName: orNull(row.value.quoteName),
      createdAt: new Date(createdAt).toISOString(),
    });
    counter.add("orders", "insert");
  }

  return {
    currentYear,
    people: newPeople,
    roles: newRoles,
    leaves,
    advisors,
    positions,
    faqs: faqList,
    orders: newOrders,
    counts: counter.counts,
    hiddenFaqs,
    alumni,
    multiYear: people.filter((p) => p.years.size > 1).length,
    unclearQuitters: conflicts.filter((c) => UNCLEAR_QUITTER_KINDS.includes(c.kind)).length,
    conflicts: sortConflicts(conflicts),
  };
}

function academicYearOf(at: string): number {
  const d = new Date(at);
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** Conflicts in source order: file, sheet, row. */
function sortConflicts(list: readonly Conflict[]): Conflict[] {
  const place = (at: At) => [at.file, at.sheet ?? "", String(at.row).padStart(8, "0")].join("\u0000");
  return [...list].sort((a, b) => place(a.at).localeCompare(place(b.at)) || a.kind.localeCompare(b.kind));
}
