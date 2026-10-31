import { z } from "zod";
import { textLength } from "@/lib/content/text";
import {
  BOARD_FLAGS,
  boardTitleOf,
  DEPARTMENT_KINDS,
  defaultHeadTitle,
  divisionLabel,
  roleIn,
  type BoardFlag,
  type BoardRole,
  type DepartmentKind,
} from "@/lib/dashboard/team";
import type { MovesWith } from "@/lib/dashboard/team-address";
import {
  applyLayer,
  ARC_LEADERS,
  isLinkedinHandle,
  isPagePhoto,
  TEAM_PAGE_TEXT_MAX,
  type AddedPerson,
  type AddedRef,
  type PersonEdit,
  type Shown,
  type Spot,
  type SpotEdit,
  type TeamPageLayer,
} from "./team-layer";
import { byName, personOf, titleOf, type TeamPerson } from "./team-person";
import { carouselOf, coreMembersOf, drawnTeamPage, teamBuildOf, type TeamRoles } from "./team-roles";
import type { DepartmentHead, DivisionLead, Leader, Member, Person, PersonPhoto, TeamPage } from "./types";

// The Team page's own layout (epic #835, issue #849): the places the page
// shows, each a page seat bound to a seat of the team record or to one team
// member (Owner decision, #846 R4.1). Who fills a seat-bound place follows the
// team record; the layout does not. A seat added, removed or moved in the Team
// tree changes nothing here until an editor changes the layout. A page seat
// whose bound seat has no holder is not drawn and keeps its place, so it
// shows again once the seat has a holder; one whose bound seat no longer
// exists is dropped (`withoutGoneSeats`). A person-bound place shows that
// person while they hold an active role and passes to no one. There is no
// vacant or unbound state (#846 R2.1). The core members are everyone with an
// active role no drawn page seat shows (#846 R1.1). The intro text, the
// figures and the group photo stay in the visual layer (./team-layer.ts).
// Pure. Each stored layer version keeps its layout beside it, and the public
// page draws it (./team-page-stored.ts, issue #850).

/**
 * The seat of the team record a page seat shows the holder of. It reuses the
 * references the team-address tie names stably (`MovesWith`,
 * lib/dashboard/team-address.ts): the team leader; a full-access seat on the
 * team-level row by its flag; any other team-level seat by its `roles` row; a
 * department's head by department; a division's lead by division and place
 * among its co-leads by name (0 is the first).
 */
export type SeatBinding =
  | Extract<MovesWith, { readonly kind: "team-leader" }>
  | { readonly kind: "full-access-seat"; readonly seat: BoardFlag }
  | { readonly kind: "team-seat"; readonly roleId: number }
  | Extract<MovesWith, { readonly kind: "department-head" }>
  | (Extract<MovesWith, { readonly kind: "division-lead" }> & { readonly place: number });

/**
 * One team member, by member id (Owner decision, #846 R4.1): the place shows
 * them while they hold an active role, whatever seat that is, and nothing
 * while they hold none. It does not pass to anyone on a hand-over. Under
 * their name it reads, unless overridden, "Head of" the block on a head
 * place, else their own page title.
 */
export type PersonBinding = { readonly kind: "person"; readonly memberId: number };

/** What a page seat shows: the holder of a seat of the team record, or one team member. */
export type PlaceBinding = SeatBinding | PersonBinding;

/**
 * What a page seat shows instead of what the team record says, one field
 * each. On a division lead row `role` is the division shown under the name.
 * The team email is never overridden: it is the holder's own.
 */
export type SeatOverrides = {
  readonly name?: string;
  readonly role?: string;
  readonly photo?: PersonPhoto;
  /** A LinkedIn handle, the part after linkedin.com/in/. */
  readonly linkedin?: string;
};

/** A place the Team page shows: its id in the layout, the seat or person it is bound to and what it overrides. */
export type PageSeat = { readonly id: number; readonly binding: PlaceBinding; readonly overrides: SeatOverrides };

/** A department block: the name it shows, the carousel slide its head sits on, its head and its division lead rows in order. */
export type DepartmentBlock = {
  readonly id: number;
  readonly name: string;
  readonly kind: DepartmentKind;
  readonly head: PageSeat;
  readonly leads: readonly PageSeat[];
};

/** The Team page layout: the team leader's seat, the arc in reading order (at most eight seats), the department blocks in order. */
export type TeamLayout = {
  readonly leader: PageSeat | null;
  readonly arc: readonly PageSeat[];
  readonly departments: readonly DepartmentBlock[];
};

// The team record a binding reads.

const leadsOf = (roles: TeamRoles, divisionId: number): TeamPerson[] =>
  roles.people.filter((p) => roleIn(p.placement.memberships, divisionId) === "lead").sort(byName);

/**
 * Whether the bound seat is still on the team record: the team leader and a
 * flagged seat always are; a team-level seat while its `roles` row is active;
 * a head and a lead while their department or division is open. A person
 * binding names no seat, so nothing removes it: the place waits while the
 * person holds no active role.
 */
function seatExists(binding: PlaceBinding, roles: TeamRoles): boolean {
  switch (binding.kind) {
    case "team-leader":
    case "full-access-seat":
    case "person":
      return true;
    case "team-seat":
      return roles.people.some((p) => p.placement.role === "board" && p.placement.seat.roleId === binding.roleId);
    case "department-head":
      return roles.org.departments.some((d) => d.id === binding.departmentId);
    case "division-lead":
      return roles.org.divisions.some((d) => d.id === binding.divisionId);
  }
}

/** Who holds a bound seat now, with the text the seat reads under their name. */
type Holding = { readonly person: TeamPerson; readonly title: string };

/**
 * The holder of a bound seat now and the seat's own text: the team leader's
 * title or "Team Leader", a team-level seat's title, a head's title or "Head
 * of" `headOf` (the block's name; the department's own by default), a
 * division's name. A bound person reads "Head of" `headOf` on a head place,
 * else their own page title. Null when the seat has no holder or is gone, or
 * the person holds no active role.
 */
function holdingOf(binding: PlaceBinding, roles: TeamRoles, headOf?: string): Holding | null {
  if (!seatExists(binding, roles)) return null;
  const first = (test: (p: TeamPerson) => boolean) => roles.people.filter(test).sort(byName)[0];
  switch (binding.kind) {
    case "person": {
      const person = roles.people.find((p) => p.id === binding.memberId);
      if (person === undefined) return null;
      return { person, title: headOf === undefined ? (titleOf(person) ?? "") : defaultHeadTitle(headOf) };
    }
    case "team-leader": {
      const person = first((p) => p.placement.role === "team-leader");
      return person === undefined ? null : { person, title: titleOf(person) ?? "Team Leader" };
    }
    case "full-access-seat":
    case "team-seat": {
      const holds = (seat: BoardRole) => (binding.kind === "team-seat" ? seat.roleId === binding.roleId : seat.flag === binding.seat);
      const person = first((p) => p.placement.role === "board" && holds(p.placement.seat));
      return person?.placement.role === "board" ? { person, title: boardTitleOf(person.placement.seat) } : null;
    }
    case "department-head": {
      const person = first((p) => p.placement.role === "head" && p.placement.departmentId === binding.departmentId);
      if (person?.placement.role !== "head") return null;
      const name = headOf ?? roles.org.departments.find((d) => d.id === binding.departmentId)?.name ?? "";
      return { person, title: person.placement.title.trim() || defaultHeadTitle(name) };
    }
    case "division-lead": {
      const person = leadsOf(roles, binding.divisionId)[binding.place];
      const division = roles.org.divisions.find((d) => d.id === binding.divisionId);
      return person === undefined || division === undefined ? null : { person, title: divisionLabel(division.name) };
    }
  }
}

/** A page seat whose bound seat no longer exists is dropped; a block whose head seat is gone goes with it. */
export function withoutGoneSeats(layout: TeamLayout, roles: TeamRoles): TeamLayout {
  const keeps = (seat: PageSeat) => seatExists(seat.binding, roles);
  return {
    leader: layout.leader !== null && keeps(layout.leader) ? layout.leader : null,
    arc: layout.arc.filter(keeps),
    departments: layout.departments.flatMap((block) => (keeps(block.head) ? [{ ...block, leads: block.leads.filter(keeps) }] : [])),
  };
}

/**
 * The layout with every page seat bound to team-level seat `from` bound to
 * `to` instead: a hand-over of a seat with no flag ends its `roles` row and
 * starts a new one, and its page seats follow.
 */
export function withTeamSeatMoved(layout: TeamLayout, from: number, to: number): TeamLayout {
  const moved = (seat: PageSeat): PageSeat =>
    seat.binding.kind === "team-seat" && seat.binding.roleId === from ? { ...seat, binding: { kind: "team-seat", roleId: to } } : seat;
  return {
    leader: layout.leader === null ? null : moved(layout.leader),
    arc: layout.arc.map(moved),
    departments: layout.departments.map((block) => ({ ...block, head: moved(block.head), leads: block.leads.map(moved) })),
  };
}

// The page a layout draws.

export type ResolvedDepartment = {
  readonly at: number;
  readonly name: string;
  readonly kind: DepartmentKind;
  /** The head, or none while the head seat has no holder: the carousel then draws nothing for the block. */
  readonly heads: readonly Shown<number, DepartmentHead>[];
  readonly leads: readonly Shown<number, DivisionLead>[];
};

/** What a layout draws, each place keyed by its page seat's id, and the core members. */
export type ResolvedTeam = {
  readonly leader: Leader | null;
  readonly leaders: readonly Shown<number, Leader>[];
  readonly departments: readonly ResolvedDepartment[];
  readonly core: readonly Member[];
};

type Placed<T> = Shown<number, T> & { readonly person: TeamPerson };

/** A page seat as drawn: its holder with each override laid on, and the text under the name. */
function drawn(seat: PageSeat, roles: TeamRoles, headOf?: string): { readonly person: TeamPerson; readonly shown: Person; readonly role: string } | null {
  const holding = holdingOf(seat.binding, roles, headOf);
  if (holding === null) return null;
  const { name, photo, linkedin, role } = seat.overrides;
  return {
    person: holding.person,
    shown: {
      ...personOf(holding.person),
      ...(name !== undefined && { name }),
      ...(photo !== undefined && { photo }),
      ...(linkedin !== undefined && { linkedin }),
    },
    role: role ?? holding.title,
  };
}

const unplaced = <T>({ at, shown }: Placed<T>): Shown<number, T> => ({ at, shown });

/**
 * The page `layout` draws on the team record `roles`: each page seat shows
 * its bound seat's holder now, with its overrides; one with no holder is left
 * out and keeps its place. The arc draws at most eight. The core members are
 * everyone in `roles` whom no drawn place shows, by name, with their title.
 */
export function resolveLayout(layout: TeamLayout, roles: TeamRoles): ResolvedTeam {
  const leader = layout.leader === null ? null : drawn(layout.leader, roles);
  const arc = layout.arc
    .flatMap((seat): Placed<Leader>[] => {
      const d = drawn(seat, roles);
      return d === null ? [] : [{ at: seat.id, person: d.person, shown: { ...d.shown, role: d.role } }];
    })
    .slice(0, ARC_LEADERS);
  const departments = layout.departments.map((block) => {
    const leads = block.leads.flatMap((seat): Placed<DivisionLead>[] => {
      const d = drawn(seat, roles);
      return d === null ? [] : [{ at: seat.id, person: d.person, shown: { ...d.shown, division: d.role } }];
    });
    const head = drawn(block.head, roles, block.name);
    const heads: Placed<DepartmentHead>[] =
      head === null
        ? []
        : [{ at: block.head.id, person: head.person, shown: { kind: "head", ...head.shown, role: head.role, leads: leads.map((l) => l.shown) } }];
    return { at: block.id, name: block.name, kind: block.kind, heads, leads };
  });
  const carousel = carouselOf(departments).flatMap((slide) =>
    slide.places.flatMap((place) => (place.kind === "head" ? [place.head.person, ...place.leads.map((l) => l.person)] : [place.lead.person])),
  );
  const shown = new Set([...(leader === null ? [] : [leader.person]), ...arc.map((l) => l.person), ...carousel].map((p) => p.id));
  return {
    leader: leader === null ? null : { ...leader.shown, role: leader.role },
    leaders: arc.map(unplaced),
    departments: departments.map((d) => ({ ...d, heads: d.heads.map(unplaced), leads: d.leads.map(unplaced) })),
    core: coreMembersOf(roles.people, shown),
  };
}

/**
 * The Team page `layout` draws on `roles`, with the layer's intro text,
 * figures and group photo, onto `base` for everything else
 * (`drawnTeamPage`). A section no drawn place fills is drawn empty, never
 * from `base` (ADR 0019 Decision 9).
 */
export function layoutPageOf(
  roles: TeamRoles,
  layout: TeamLayout,
  text: Pick<TeamPageLayer, "intro" | "figures" | "groupPhoto">,
  base: TeamPage,
): TeamPage {
  const resolved = resolveLayout(layout, roles);
  return drawnTeamPage(
    resolved,
    {
      ...resolved,
      intro: text.intro,
      ...(text.figures !== undefined && { figures: text.figures }),
      groupPhoto: text.groupPhoto,
    },
    base,
  );
}

/** Every photo the layout sets, on any page seat. */
export function layoutPhotos(layout: TeamLayout): PersonPhoto[] {
  const seats = [...(layout.leader === null ? [] : [layout.leader]), ...layout.arc, ...layout.departments.flatMap((b) => [b.head, ...b.leads])];
  return seats.flatMap((seat) => seat.overrides.photo ?? []);
}

// The first layout: today's page, snapshotted.

/** The binding of a team-level seat: its flag when it has one, else its `roles` row. */
function teamLevelBinding(seat: BoardRole): SeatBinding {
  return seat.flag === null ? { kind: "team-seat", roleId: seat.roleId } : { kind: "full-access-seat", seat: seat.flag };
}

/**
 * Something the layer holds that the snapshot's layout does not carry, keyed
 * as the layer keys it: the team leader's edit, a spot, something the editor
 * added (a leader, a lead row, a department) or a department's edit. Every
 * place the page draws is carried except a department's heads past its
 * first, so the rest are edits the page does not draw today.
 */
export type SnapshotGap = {
  readonly at: "leader" | Spot | AddedRef | `department:${number}`;
  /**
   * `hidden`: a hidden spot or department. `left-team`: the person the edit
   * shows holds no active role. `not-shown`: the page draws nothing there for
   * another reason (a spot the roles no longer fill, past the arc's eight, a
   * department with no head drawn, a swap on the team leader while there is
   * none). `second-head`: a block holds one head, and this one is drawn after it.
   */
  readonly why: "hidden" | "left-team" | "not-shown" | "second-head";
};

/** The first layout, and every part of the layer it does not carry. */
export type Snapshot = { readonly layout: TeamLayout; readonly left: readonly SnapshotGap[] };

/** The overrides an edit or an added person sets, with no key for a field it leaves alone. */
function overridesOf(edit: Pick<PersonEdit, "name" | "role" | "photo" | "linkedin">): SeatOverrides {
  return {
    ...(edit.name !== undefined && { name: edit.name }),
    ...(edit.role !== undefined && { role: edit.role }),
    ...(edit.photo !== undefined && { photo: edit.photo }),
    ...(edit.linkedin !== undefined && { linkedin: edit.linkedin }),
  };
}

const addedOverrides = (added: AddedPerson, role: string | undefined): SeatOverrides =>
  overridesOf({ name: added.name, photo: added.photo, linkedin: added.linkedin, role });

const spotPart = (spot: string, index: 1 | 2) => Number(spot.split(":")[index]);

/**
 * The layout of what the page shows today: the roles build with `layer` laid
 * on (`applyLayer`), each place it draws as a page seat. A place keeps its
 * own seat while the roles' holder shows there; a place showing someone else
 * (a person swap, or anyone the layer added) is bound to that person (Owner
 * decision, #846 R4.1), as the layer itself shows that person and not a seat.
 * Each edit carries over as an override, and a role text the binding would
 * not read by itself is set as one, so the page draws the same. `left` names
 * every part of the layer the layout does not carry, and why: hidden spots
 * and departments, edits the page does not draw today, and a department's
 * heads past its first, which one block cannot hold.
 */
export function snapshot(roles: TeamRoles, layer: TeamPageLayer): Snapshot {
  const build = teamBuildOf(roles);
  const shown = applyLayer(build, layer);
  let lastId = 0;
  const nextId = () => ++lastId;
  const memberOf = (id: number | undefined) => (id === undefined ? undefined : build.people.find((p) => p.id === id));
  const carried = new Set<SnapshotGap["at"]>();
  const left: SnapshotGap[] = [];
  const missing = (at: string): never => {
    throw new Error(`The page draws ${at}, which the roles and the layer do not hold.`);
  };

  /** Who the place at `at` shows: the person its edit swaps in while they hold an active role, else `fromRoles`. */
  const shownAt = (at: SnapshotGap["at"], edit: PersonEdit | undefined, fromRoles: TeamPerson): TeamPerson => {
    const swapped = memberOf(edit?.person);
    if (edit?.person !== undefined && swapped === undefined) left.push({ at, why: "left-team" });
    return swapped ?? fromRoles;
  };

  /** The page seat for the place at `at` showing `person`: bound to `own` while they hold it, else to them. */
  const pageSeat = (at: SnapshotGap["at"], person: TeamPerson, own: SeatBinding | null, set: SeatOverrides, shownRole: string, headOf?: string): PageSeat => {
    carried.add(at);
    const holdsOwn = own !== null && holdingOf(own, roles, headOf)?.person.id === person.id;
    const binding: PlaceBinding = holdsOwn ? own : { kind: "person", memberId: person.id };
    const title = holdingOf(binding, roles, headOf)?.title;
    const role = set.role ?? (shownRole === title ? undefined : shownRole);
    return { id: nextId(), binding, overrides: { ...set, ...(role !== undefined && { role }) } };
  };

  const leaderSeat = (): PageSeat => {
    const own: SeatBinding = { kind: "team-leader" };
    const set = overridesOf(layer.leader);
    if (build.leader === null || shown.leader === null) {
      if (layer.leader.person !== undefined) left.push({ at: "leader", why: "not-shown" });
      return { id: nextId(), binding: own, overrides: set };
    }
    return pageSeat("leader", shownAt("leader", layer.leader, build.leader.person), own, set, shown.leader.role);
  };
  const leader = leaderSeat();

  const arc = shown.leaders.map(({ at, shown: drawnLeader }): PageSeat => {
    const built = build.arc.find((b) => b.spot === at);
    if (built !== undefined) {
      const edit = layer.spots[built.spot];
      const { placement } = built.person;
      const own = placement.role === "board" ? teamLevelBinding(placement.seat) : null;
      return pageSeat(built.spot, shownAt(built.spot, edit, built.person), own, overridesOf(edit ?? {}), drawnLeader.role);
    }
    const added = layer.addedLeaders.find((a) => `added:${a.id}` === at) ?? missing(at);
    return pageSeat(at, memberOf(added.person) ?? missing(at), null, addedOverrides(added, added.role), drawnLeader.role);
  });

  const departments = shown.departments.flatMap((department): DepartmentBlock[] => {
    const [head, ...after] = department.heads;
    if (head === undefined) return [];
    for (const extra of after) left.push({ at: extra.at, why: "second-head" });
    const id = nextId();
    const fromRoles = typeof department.at === "number" ? build.departments.find((d) => d.id === department.at) : undefined;
    const addedDepartment = layer.addedDepartments.find((d) => `added:${d.id}` === department.at);
    const addedLeads = typeof department.at === "number" ? (layer.departments[`${department.at}`]?.addedLeads ?? []) : (addedDepartment?.leads ?? []);
    if (typeof department.at === "number") carried.add(`department:${department.at}`);

    let headSeat: PageSeat;
    if (fromRoles !== undefined) {
      const builtHead = fromRoles.heads.find((h) => h.spot === head.at) ?? missing(`${head.at}`);
      const edit = layer.spots[builtHead.spot];
      const own: SeatBinding = { kind: "department-head", departmentId: fromRoles.id };
      headSeat = pageSeat(builtHead.spot, shownAt(builtHead.spot, edit, builtHead.person), own, overridesOf(edit ?? {}), head.shown.role, department.name);
    } else {
      const added = addedDepartment ?? missing(`${department.at}`);
      const person = memberOf(added.head.person) ?? missing(`${department.at}`);
      headSeat = pageSeat(`added:${added.id}`, person, null, addedOverrides(added.head, added.head.role), head.shown.role, department.name);
    }

    const leads = department.leads.map(({ at, shown: drawnLead }): PageSeat => {
      const builtLead = fromRoles?.leads.find((l) => l.spot === at);
      if (builtLead !== undefined) {
        const edit = layer.spots[builtLead.spot];
        const own: SeatBinding = { kind: "division-lead", divisionId: spotPart(builtLead.spot, 1), place: spotPart(builtLead.spot, 2) };
        return pageSeat(builtLead.spot, shownAt(builtLead.spot, edit, builtLead.person), own, overridesOf(edit ?? {}), drawnLead.division);
      }
      const added = addedLeads.find((a) => `added:${a.id}` === at) ?? missing(at);
      return pageSeat(at, memberOf(added.person) ?? missing(at), null, addedOverrides(added, added.division), drawnLead.division);
    });
    return [{ id, name: department.name, kind: department.kind, head: headSeat, leads }];
  });

  // What the layer holds that no page seat carries.
  const notCarried = (at: SnapshotGap["at"], why: SnapshotGap["why"]) => {
    if (!carried.has(at) && !left.some((gap) => gap.at === at)) left.push({ at, why });
  };
  const addedGap = (added: AddedPerson & { readonly id: number }) =>
    notCarried(`added:${added.id}`, memberOf(added.person) === undefined ? "left-team" : "not-shown");
  for (const [spot, edit] of Object.entries(layer.spots) as [Spot, SpotEdit | undefined][]) notCarried(spot, edit?.hidden ? "hidden" : "not-shown");
  layer.addedLeaders.forEach(addedGap);
  for (const [key, edit] of Object.entries(layer.departments)) {
    notCarried(`department:${Number(key)}`, edit?.hidden ? "hidden" : "not-shown");
    (edit?.addedLeads ?? []).forEach(addedGap);
  }
  for (const added of layer.addedDepartments) {
    notCarried(`added:${added.id}`, memberOf(added.head.person) === undefined ? "left-team" : "not-shown");
    added.leads.forEach(addedGap);
  }

  return { layout: { leader, arc, departments }, left };
}

// A layout read back from storage or sent by the browser: anything this code
// could not have written reads as not a layout.

const text = z.string().refine((value) => value.trim() !== "" && textLength(value) <= TEAM_PAGE_TEXT_MAX);
const id = z.number().int().positive();

const bindingSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("team-leader") }),
  z.strictObject({ kind: z.literal("full-access-seat"), seat: z.enum(BOARD_FLAGS) }),
  z.strictObject({ kind: z.literal("team-seat"), roleId: id }),
  z.strictObject({ kind: z.literal("department-head"), departmentId: id }),
  z.strictObject({ kind: z.literal("division-lead"), divisionId: id, place: z.number().int().min(0).max(999) }),
  z.strictObject({ kind: z.literal("person"), memberId: id }),
]);

const seatSchema = z.strictObject({
  id,
  binding: bindingSchema,
  overrides: z.strictObject({
    name: text.optional(),
    role: text.optional(),
    photo: z.custom<PersonPhoto>(isPagePhoto).optional(),
    linkedin: z.custom<string>(isLinkedinHandle).optional(),
  }),
});

const layoutSchema = z.strictObject({
  leader: seatSchema.nullable(),
  arc: z.array(seatSchema).max(ARC_LEADERS),
  departments: z
    .array(z.strictObject({ id, name: text, kind: z.enum(DEPARTMENT_KINDS), head: seatSchema, leads: z.array(seatSchema).max(200) }))
    .max(200),
});

/** Every id the layout holds, page seats and blocks in one list: one id names one thing. */
function idsOf(layout: TeamLayout): number[] {
  return [
    ...(layout.leader === null ? [] : [layout.leader.id]),
    ...layout.arc.map((s) => s.id),
    ...layout.departments.flatMap((b) => [b.id, b.head.id, ...b.leads.map((s) => s.id)]),
  ];
}

/** `value` as a layout this code could have written: every part present and well formed, every id used once; null for anything else. */
export function parseTeamLayout(value: unknown): TeamLayout | null {
  const parsed = layoutSchema.safeParse(value);
  if (!parsed.success) return null;
  const layout: TeamLayout = parsed.data;
  const ids = idsOf(layout);
  return new Set(ids).size === ids.length ? layout : null;
}
