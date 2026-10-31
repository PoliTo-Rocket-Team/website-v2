import { z } from "zod";
import { textLength } from "@/lib/content/text";
import {
  BOARD_FLAGS,
  boardTitleOf,
  DEPARTMENT_KINDS,
  defaultHeadTitle,
  divisionLabel,
  ledDivisionOf,
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
  LEADS_DRAWN,
  NO_TEAM_LAYER,
  TEAM_PAGE_TEXT_MAX,
  type AddedPerson,
  type AddedRef,
  type LeadsDrawn,
  type PersonEdit,
  type Shown,
  type Spot,
  type SpotEdit,
  type TeamPageLayer,
  type TeamPageText,
} from "./team-layer";
import { byName, headSeatsOf, personOf, teamSeatsOf, titleOf, type TeamPerson } from "./team-person";
import { carouselOf, coreMembersOf, drawnTeamPage, teamBuildOf, todaysGroupOf, TODAYS_GROUPS, type TeamRoles } from "./team-roles";
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
// page draws it (./team-page-stored.ts, issue #850); the Team page editor
// edits it (./team-page-edit.ts, ./team-page-add.ts, issue #851). The
// departments carousel draws the layout's own department groups, in their
// order and by their names (issue #856, #846 R2.3 and R3.1): a department's
// kind on the team record is read only to snapshot today's two groups.

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

/**
 * A department group (issue #856, #846 R2.3): a heading of the departments
 * carousel, named by the editor. Its place in the layout's list is its
 * position; its id is the one its blocks name, unique among the groups.
 */
export type LayoutGroup = { readonly id: number; readonly name: string };

/**
 * A department block: the department of the team record it shows, the name
 * it shows, the group it sits in, how it draws its division leads (under its
 * head or beside it), its head and its division lead rows in order.
 */
export type DepartmentBlock = {
  readonly id: number;
  /**
   * The id of the team record's department the block shows, whoever its head
   * place shows; null for a department the editor added. At most one block
   * shows a department. Reset to team finds a block's department by it, so a
   * head swapped to another person keeps the block's group (issue #856).
   */
  readonly department: number | null;
  readonly name: string;
  readonly group: number;
  readonly leadsDrawn: LeadsDrawn;
  readonly head: PageSeat;
  readonly leads: readonly PageSeat[];
};

/**
 * The Team page layout: the team leader's seat, the arc in reading order (at
 * most eight seats), the department groups in order (at least one), and the
 * department blocks in order, each in one of those groups.
 */
export type TeamLayout = {
  readonly leader: PageSeat | null;
  readonly arc: readonly PageSeat[];
  readonly groups: readonly LayoutGroup[];
  readonly departments: readonly DepartmentBlock[];
};

/**
 * What a layout of either stored form holds (`StoredLayout`): the team
 * leader's seat, the arc, and blocks, each with an id, a head and lead rows.
 */
type SeatedLayout = {
  readonly leader: PageSeat | null;
  readonly arc: readonly PageSeat[];
  readonly departments: readonly { readonly id: number; readonly head: PageSeat; readonly leads: readonly PageSeat[] }[];
};

/** The layout with every page seat put through `on`, everything else as it was. */
function withEachSeat<L extends SeatedLayout>(layout: L, on: (seat: PageSeat) => PageSeat): L {
  return {
    ...layout,
    leader: layout.leader === null ? null : on(layout.leader),
    arc: layout.arc.map(on),
    departments: layout.departments.map((block) => ({ ...block, head: on(block.head), leads: block.leads.map(on) })),
  };
}

// The team record a binding reads.

const leadsOf = (roles: TeamRoles, divisionId: number): TeamPerson[] =>
  roles.people.filter((p) => roleIn(p.placement.memberships, divisionId) === "lead").sort(byName);

/**
 * The first holder among `held`: someone the Team tree draws in that seat
 * first, then by name. Each person's seats come drawn-in first
 * (`teamSeatsOf`, `headSeatsOf`), so index 0 of a placement of that kind is it.
 */
function firstHeld<S>(held: readonly { readonly person: TeamPerson; readonly seat: S; readonly drawnIn: boolean }[]) {
  return [...held].sort((a, b) => Number(b.drawnIn) - Number(a.drawnIn) || byName(a.person, b.person))[0];
}

/**
 * The holder of a team-level seat `matches` picks, and its title, read from
 * every team-level seat each person holds, not only the one they are drawn
 * in: a team leader, or someone on another seat, who took this seat on a
 * hand-over shows in its place (#852, ADR 0019 Decision 3). Null while no
 * active row matches.
 */
function teamSeatHolding(matches: (seat: BoardRole) => boolean, roles: TeamRoles): Holding | null {
  const held = firstHeld(
    roles.people.flatMap((person) =>
      teamSeatsOf(person).flatMap((seat, i) => (matches(seat) ? [{ person, seat, drawnIn: i === 0 && person.placement.role === "board" }] : [])),
    ),
  );
  return held === undefined ? null : { person: held.person, title: boardTitleOf(held.seat) };
}

/**
 * The head of department `departmentId` and its title, read from every head
 * each person holds, as `teamSeatHolding` reads seats: someone drawn in a
 * team-level seat, or the team leader, who took the head on a hand-over shows
 * in its place (#852). `headOf` names the block for a head row with no title.
 */
function headHolding(departmentId: number, headOf: string, roles: TeamRoles): Holding | null {
  const held = firstHeld(
    roles.people.flatMap((person) =>
      headSeatsOf(person).flatMap((seat, i) => (seat.departmentId === departmentId ? [{ person, seat, drawnIn: i === 0 && person.placement.role === "head" }] : [])),
    ),
  );
  return held === undefined ? null : { person: held.person, title: held.seat.title.trim() || defaultHeadTitle(headOf) };
}

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
      return teamSeatHolding((seat) => seat.roleId === binding.roleId, roles) !== null;
    case "department-head":
      return roles.org.departments.some((d) => d.id === binding.departmentId);
    case "division-lead":
      return roles.org.divisions.some((d) => d.id === binding.divisionId);
  }
}

/** Who holds a bound seat now, with the text the seat reads under their name. */
export type Holding = { readonly person: TeamPerson; readonly title: string };

/**
 * The holder of a bound seat now and the seat's own text: the team leader's
 * title or "Team Leader", a team-level seat's title, a head's title or "Head
 * of" `headOf` (the block's name; the department's own by default), a
 * division's name. A bound person reads "Head of" `headOf` on a head place,
 * else their own page title. Null when the seat has no holder or is gone, or
 * the person holds no active role.
 */
export function holdingOf(binding: PlaceBinding, roles: TeamRoles, headOf?: string): Holding | null {
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
      return teamSeatHolding((seat) => seat.flag === binding.seat, roles);
    case "team-seat":
      return teamSeatHolding((seat) => seat.roleId === binding.roleId, roles);
    case "department-head":
      return headHolding(binding.departmentId, headOf ?? roles.org.departments.find((d) => d.id === binding.departmentId)?.name ?? "", roles);
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
    groups: layout.groups,
    departments: layout.departments.flatMap((block) => (keeps(block.head) ? [{ ...block, leads: block.leads.filter(keeps) }] : [])),
  };
}

/** Whether a page seat of the layout is bound to the team-level seat on `roles` row `roleId`; a person-bound place never is. */
export function bindsTeamSeat(layout: SeatedLayout, roleId: number): boolean {
  return layoutSeats(layout).some((seat) => seat.binding.kind === "team-seat" && seat.binding.roleId === roleId);
}

/**
 * The layout with every page seat bound to team-level seat `from` bound to
 * `to` instead: a hand-over of a seat with no flag ends its `roles` row and
 * starts a new one, and its page seats follow.
 */
export function withTeamSeatMoved<L extends SeatedLayout>(layout: L, from: number, to: number): L {
  return withEachSeat(layout, (seat) =>
    seat.binding.kind === "team-seat" && seat.binding.roleId === from ? { ...seat, binding: { kind: "team-seat", roleId: to } } : seat,
  );
}

// What the editor needs of a layout (issue #851).

/** Every page seat of the layout: the team leader's, the arc's, then each block's head and leads. */
export function layoutSeats(layout: SeatedLayout): PageSeat[] {
  return [...(layout.leader === null ? [] : [layout.leader]), ...layout.arc, ...layout.departments.flatMap((b) => [b.head, ...b.leads])];
}

/** The id the next page seat or block the editor adds takes: after every id the layout holds. */
export function nextSeatId(layout: TeamLayout): number {
  return idsOf(layout).reduce((last, id) => Math.max(last, id), 0) + 1;
}

/** Whether two bindings name the same seat or person. */
export function sameBinding(a: PlaceBinding, b: PlaceBinding): boolean {
  return JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());
}

/** The seat `person` holds on the team record, when they hold one: the team leader's, a team-level seat, a head, or the lead of the oldest division they lead. */
function seatOf(person: TeamPerson, roles: TeamRoles): SeatBinding | null {
  const { placement } = person;
  if (placement.role === "team-leader") return { kind: "team-leader" };
  if (placement.role === "board") return teamLevelBinding(placement.seat);
  if (placement.role === "head") return { kind: "department-head", departmentId: placement.departmentId };
  const divisionId = ledDivisionOf(placement);
  if (divisionId === null) return null;
  return { kind: "division-lead", divisionId, place: leadsOf(roles, divisionId).findIndex((p) => p.id === person.id) };
}

/**
 * What a page seat is bound to when the editor picks `person` for it: the
 * seat they hold, wherever the Team tree places it, so the place follows that
 * seat on a hand-over (ADR 0019); a person who holds no seat, or one the seat
 * would not show (a co-holder drawn first), is bound to themselves (Owner
 * decision, #846 R4.1).
 */
export function bindingFor(person: TeamPerson, roles: TeamRoles): PlaceBinding {
  const seat = seatOf(person, roles);
  return seat !== null && holdingOf(seat, roles)?.person.id === person.id ? seat : { kind: "person", memberId: person.id };
}

/** The division lead seats of a department as the team record has them: its divisions in order, each one's leads by name. */
export function departmentLeadBindings(departmentId: number, roles: TeamRoles): SeatBinding[] {
  return roles.org.divisions
    .filter((d) => d.departmentId === departmentId)
    .flatMap((division) => leadsOf(roles, division.id).map((_, place): SeatBinding => ({ kind: "division-lead", divisionId: division.id, place })));
}

/** The layout with each override photo put through `swap`, everything else as it was. */
export function withLayoutPhotos<L extends SeatedLayout>(layout: L, swap: (photo: PersonPhoto) => PersonPhoto): L {
  return withEachSeat(layout, (seat) =>
    seat.overrides.photo === undefined ? seat : { ...seat, overrides: { ...seat.overrides, photo: swap(seat.overrides.photo) } },
  );
}

// The page a layout draws.

export type ResolvedDepartment = {
  readonly at: number;
  readonly name: string;
  /** The id of the group it sits in. */
  readonly group: number;
  readonly leadsDrawn: LeadsDrawn;
  /** The head, or none while the head seat has no holder: the carousel then draws nothing for the block. */
  readonly heads: readonly Shown<number, DepartmentHead>[];
  readonly leads: readonly Shown<number, DivisionLead>[];
};

/** A department group as a layout draws it: its id, its name and its blocks in order. */
export type ResolvedGroup = { readonly id: number; readonly name: string; readonly departments: readonly ResolvedDepartment[] };

/** What a layout draws, each place keyed by its page seat's id, and the core members. */
export type ResolvedTeam = {
  readonly leader: Leader | null;
  readonly leaders: readonly Shown<number, Leader>[];
  /** Every block in layout order. */
  readonly departments: readonly ResolvedDepartment[];
  /** The groups in order, each with its blocks: what the carousel draws. */
  readonly groups: readonly ResolvedGroup[];
  readonly core: readonly Member[];
};

/** `departments` under the groups of `groups` they name, in group order; each block keeps its order. */
function groupedOf<D extends { readonly group: number }>(groups: readonly LayoutGroup[], departments: readonly D[]) {
  return groups.map((group) => ({ id: group.id, name: group.name, departments: departments.filter((d) => d.group === group.id) }));
}

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
    return { at: block.id, name: block.name, group: block.group, leadsDrawn: block.leadsDrawn, heads, leads };
  });
  const carousel = carouselOf(groupedOf(layout.groups, departments)).flatMap((slide) =>
    slide.places.flatMap((place) => (place.kind === "head" ? [place.head.person, ...place.leads.map((l) => l.person)] : [place.lead.person])),
  );
  const shown = new Set([...(leader === null ? [] : [leader.person]), ...arc.map((l) => l.person), ...carousel].map((p) => p.id));
  const resolved = departments.map((d): ResolvedDepartment => ({ ...d, heads: d.heads.map(unplaced), leads: d.leads.map(unplaced) }));
  return {
    leader: leader === null ? null : { ...leader.shown, role: leader.role },
    leaders: arc.map(unplaced),
    departments: resolved,
    groups: groupedOf(layout.groups, resolved),
    core: coreMembersOf(roles.people, shown),
  };
}

/**
 * The Team page `layout` draws on `roles`, with the layer's intro text,
 * figures and group photo, onto `base` for everything else
 * (`drawnTeamPage`). A section no drawn place fills is drawn empty, never
 * from `base` (ADR 0019 Decision 9).
 */
export function layoutPageOf(roles: TeamRoles, layout: TeamLayout, text: TeamPageText, base: TeamPage): TeamPage {
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
export function layoutPhotos(layout: SeatedLayout): PersonPhoto[] {
  return layoutSeats(layout).flatMap((seat) => seat.overrides.photo ?? []);
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
    // Today's grouping, by the department's kind: the one read of it (`TODAYS_GROUPS`, issue #856).
    const today = todaysGroupOf(department.kind);
    return [
      { id, department: fromRoles?.id ?? null, name: department.name, group: TODAYS_GROUP_IDS[today.kind], leadsDrawn: today.leadsDrawn, head: headSeat, leads },
    ];
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

  return { layout: { leader, arc, groups: todaysLayoutGroups(), departments }, left };
}

/** The ids today's two groups take in a first layout: their place in `TODAYS_GROUPS`, from 1. */
const TODAYS_GROUP_IDS: Readonly<Record<DepartmentKind, number>> = Object.fromEntries(TODAYS_GROUPS.map((g, i) => [g.kind, i + 1])) as Record<
  DepartmentKind,
  number
>;

/** Today's two groups as a first layout names them, "Technical Departments" then "Operations" (`TODAYS_GROUPS`). */
function todaysLayoutGroups(): LayoutGroup[] {
  return TODAYS_GROUPS.map((g) => ({ id: TODAYS_GROUP_IDS[g.kind], name: g.name }));
}

/**
 * The layout Reset to team writes (board 80h; issue #856): the team record's
 * places as the snapshot builds them with no edit, under `kept`'s group list,
 * which it keeps. Each department `kept` shows stays in its group there and
 * draws its leads as there, found by the department its block shows, so a
 * head swapped to another person or seat, or handed over, keeps it; a
 * department new to the page goes under the first group, its leads under its
 * head. So a reset never reads a department's kind for a group.
 */
export function teamRecordLayout(roles: TeamRoles, kept: TeamLayout): TeamLayout {
  const rebuilt = snapshot(roles, NO_TEAM_LAYER).layout;
  const [first] = kept.groups;
  if (first === undefined) return rebuilt;
  return {
    ...rebuilt,
    groups: kept.groups,
    departments: rebuilt.departments.map((block) => {
      const own = block.department === null ? undefined : kept.departments.find((k) => k.department === block.department);
      return { ...block, group: own?.group ?? first.id, leadsDrawn: own?.leadsDrawn ?? "under" };
    }),
  };
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

/** The most department groups a layout holds. */
export const LAYOUT_GROUPS_MAX = 50;

const blockParts = { id, name: text, head: seatSchema, leads: z.array(seatSchema).max(200) };

const layoutSchema = z.strictObject({
  leader: seatSchema.nullable(),
  arc: z.array(seatSchema).max(ARC_LEADERS),
  groups: z.array(z.strictObject({ id, name: text })).min(1).max(LAYOUT_GROUPS_MAX),
  departments: z.array(z.strictObject({ ...blockParts, department: id.nullable(), group: id, leadsDrawn: z.enum(LEADS_DRAWN) })).max(200),
});

const kindLayoutSchema = z.strictObject({
  leader: seatSchema.nullable(),
  arc: z.array(seatSchema).max(ARC_LEADERS),
  departments: z.array(z.strictObject({ ...blockParts, kind: z.enum(DEPARTMENT_KINDS) })).max(200),
});

/**
 * A layout stored before department groups (issues #850, #851): each block
 * carries today's kind in place of a group, there is no group list, and no
 * block names the department it shows. Storage keeps it in this form until
 * the editor saves it, because only the team record tells which department
 * a block shows (`teamLayoutOf`).
 */
export type KindLayout = {
  readonly leader: PageSeat | null;
  readonly arc: readonly PageSeat[];
  readonly departments: readonly KindBlock[];
};

/** A block stored before department groups: today's kind in place of its group, lead drawing and department. */
export type KindBlock = { readonly id: number; readonly name: string; readonly kind: DepartmentKind; readonly head: PageSeat; readonly leads: readonly PageSeat[] };

/** A layout as storage holds it: grouped, or in the form before groups (issue #856). */
export type StoredLayout = TeamLayout | KindLayout;

/** Whether a stored layout is grouped: only a grouped one has a group list. */
export const isGroupedLayout = (layout: StoredLayout): layout is TeamLayout => "groups" in layout;

/**
 * The team record departments a block stored before groups names by its own
 * parts, each one kind-free: the departments of the divisions its lead rows
 * are bound to, the departments named as the block is (by the team record or
 * by `layer`'s rename, as the snapshot named the block), and the departments
 * whose head place `layer` swapped to the person its head is bound to (the
 * snapshot binds such a head to that person, #846 R4.1).
 */
function departmentMarksOf(block: KindBlock, roles: TeamRoles, layer: TeamPageLayer): Set<number> {
  const departments = roles.org.departments;
  const onRecord = (departmentId: number | undefined): departmentId is number => departments.some((d) => d.id === departmentId);
  const departmentOfDivision = (divisionId: number) => roles.org.divisions.find((d) => d.id === divisionId)?.departmentId;
  const fromLeads = block.leads.map(({ binding }) => (binding.kind === "division-lead" ? departmentOfDivision(binding.divisionId) : undefined));
  const fromName = departments.filter((d) => d.name === block.name || layer.departments[`${d.id}`]?.name === block.name).map((d) => d.id);
  const head = block.head.binding;
  const fromSwap =
    head.kind === "person"
      ? Object.entries(layer.spots).flatMap(([spot, edit]) => (spot.startsWith("head:") && edit?.person === head.memberId ? [spotPart(spot, 1)] : []))
      : [];
  return new Set([...fromLeads, ...fromName, ...fromSwap].filter(onRecord));
}

/**
 * The team record department each block stored before groups shows, found
 * without a department's kind (issue #856). A block's own parts
 * (`departmentMarksOf`) claim a department when they name exactly one, or
 * when they name several and its head is bound to the head seat of one of
 * them. A block whose parts name none claims, more weakly, the department
 * whose head seat its head is bound to. Each block shows the department it
 * alone claims, a weak claim only where no block's parts claim it; a head
 * swapped to another person or seat, or a head seat two blocks share, so
 * leaves the department with the block that shows it. A block that claims
 * nothing, or what another block claims as strongly, shows none, as a
 * department the editor added does.
 */
function storedDepartmentsOf(blocks: readonly KindBlock[], roles: TeamRoles, layer: TeamPageLayer): (number | null)[] {
  const claims = blocks.map((block) => {
    const head = block.head.binding.kind === "department-head" ? block.head.binding.departmentId : null;
    const marks = departmentMarksOf(block, roles, layer);
    if (marks.size === 0) return { strong: null, weak: head };
    if (marks.size === 1) return { strong: [...marks][0], weak: null };
    return { strong: head !== null && marks.has(head) ? head : null, weak: null };
  });
  const claimedBy = (departmentId: number, of: "strong" | "weak") => claims.filter((c) => c[of] === departmentId).length;
  return claims.map(({ strong, weak }) => {
    if (strong !== null) return claimedBy(strong, "strong") === 1 ? strong : null;
    return weak !== null && claimedBy(weak, "strong") === 0 && claimedBy(weak, "weak") === 1 ? weak : null;
  });
}

/**
 * The grouped layout a stored one draws on `roles`, whose version holds
 * `layer`: a grouped one as it is; one stored before groups as today's two
 * groups with each block where its kind put it, showing the department
 * `storedDepartmentsOf` finds. The editor opens on it, so the next save
 * writes the group list and each block's department, and Reset to team finds
 * each department's group by it.
 */
export function teamLayoutOf(stored: StoredLayout, roles: TeamRoles, layer: TeamPageLayer): TeamLayout {
  if (isGroupedLayout(stored)) return stored;
  const shows = storedDepartmentsOf(stored.departments, roles, layer);
  return {
    leader: stored.leader,
    arc: stored.arc,
    groups: todaysLayoutGroups(),
    departments: stored.departments.map(({ kind, ...block }, i) => ({
      ...block,
      department: shows[i],
      group: TODAYS_GROUP_IDS[kind],
      leadsDrawn: todaysGroupOf(kind).leadsDrawn,
    })),
  };
}

/** Every id the layout holds, page seats and blocks in one list: one id names one thing. Group ids are a list of their own. */
function idsOf(layout: SeatedLayout): number[] {
  return [
    ...(layout.leader === null ? [] : [layout.leader.id]),
    ...layout.arc.map((s) => s.id),
    ...layout.departments.flatMap((b) => [b.id, b.head.id, ...b.leads.map((s) => s.id)]),
  ];
}

const unique = (ids: readonly number[]) => new Set(ids).size === ids.length;

/**
 * `value` as a layout this code could have written: every part present and
 * well formed, every id used once, at least one group, each block in a
 * group the list holds, and no department shown by two blocks; null for
 * anything else. Only a grouped layout: the browser never sends one stored
 * before groups (`parseStoredLayout` reads those).
 */
export function parseTeamLayout(value: unknown): TeamLayout | null {
  const parsed = layoutSchema.safeParse(value);
  if (!parsed.success) return null;
  const layout = parsed.data;
  const groups = new Set(layout.groups.map((g) => g.id));
  const grouped = layout.departments.every((b) => groups.has(b.group));
  const shown = layout.departments.flatMap((b) => (b.department === null ? [] : [b.department]));
  return unique(idsOf(layout)) && groups.size === layout.groups.length && grouped && unique(shown) ? layout : null;
}

/**
 * `value` as a layout storage holds: a grouped one `parseTeamLayout` takes,
 * or one stored before groups, well formed with every id used once, kept in
 * that form (`KindLayout`); null for anything else.
 */
export function parseStoredLayout(value: unknown): StoredLayout | null {
  const grouped = parseTeamLayout(value);
  if (grouped !== null) return grouped;
  const kinded = kindLayoutSchema.safeParse(value);
  return kinded.success && unique(idsOf(kinded.data)) ? kinded.data : null;
}

/** The id the next group the editor adds takes: after every group id the layout holds. */
export function nextGroupId(layout: TeamLayout): number {
  return layout.groups.reduce((last, g) => Math.max(last, g.id), 0) + 1;
}
