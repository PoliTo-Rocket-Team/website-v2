import { z } from "zod";
import { textLength } from "@/lib/content/text";
import {
  BOARD_FLAGS,
  boardFlagOf,
  boardSeatKey,
  boardTitleOf,
  defaultHeadTitle,
  divisionLabel,
  ledDivisionOf,
  roleIn,
  type BoardFlag,
  type BoardRole,
} from "@/lib/dashboard/team";
import type { MovesWith } from "@/lib/dashboard/team-address";
import {
  ARC_LEADERS,
  isLinkedinHandle,
  isPagePhoto,
  LEADS_DRAWN,
  NO_TEAM_LAYER,
  TEAM_PAGE_TEXT_MAX,
  type LeadsDrawn,
  type Shown,
  type TeamPageText,
} from "./team-layer";
import { byName, headSeatsOf, personOf, teamSeatsOf, titleOf, type TeamPerson } from "./team-person";
import { carouselOf, coreMembersOf, drawnTeamPage, filledTeamPage, teamBuildOf, type TeamRoles } from "./team-roles";
import type { CoHolder, CoHolders, DepartmentHead, DivisionLead, FilledTeamPage, Leader, Member, Person, PersonPhoto, TeamPage } from "./types";

// The Team page's own layout (epic #835, issue #849): the places the page
// shows, each a page seat bound to a seat of the team record or to one team
// member (Owner decision, #846 R4.1). Who fills a seat-bound place follows the
// team record; the layout does not. A seat with several holders shows every
// one of them side by side in its place (Owner decision, issue #880). A seat added, removed or moved in the Team
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
// order and by their names (issue #856, #846 R2.3 and R3.1); the team record
// holds no department kind since issue #855.

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

/** One person holding a seat by one of their rows, and whether the Team tree draws them in it. */
type Held<S> = { readonly person: TeamPerson; readonly seat: S; readonly drawnIn: boolean };

/**
 * Every holder among `held`, each once (issue #880): someone the Team tree
 * draws in that seat first, then by name. Each person's seats come drawn-in
 * first (`teamSeatsOf`, `headSeatsOf`), so a person's first row here is the
 * one they are drawn in, when they are.
 */
function inHolderOrder<S>(held: readonly Held<S>[]): Held<S>[] {
  const ordered = [...held].sort((a, b) => Number(b.drawnIn) - Number(a.drawnIn) || byName(a.person, b.person));
  return ordered.filter((h, i) => ordered.findIndex((o) => o.person.id === h.person.id) === i);
}

/**
 * Every holder of the team-level seat `matches` picks, each with the title
 * their own row reads, read from every team-level seat each person holds, not
 * only the one they are drawn in: a team leader, or someone on another seat,
 * who took this seat on a hand-over shows in its place (#852, ADR 0019
 * Decision 3). None while no active row matches.
 */
function teamSeatHoldings(matches: (seat: BoardRole) => boolean, roles: TeamRoles): Holding[] {
  return inHolderOrder(
    roles.people.flatMap((person) =>
      teamSeatsOf(person).flatMap((seat, i) => (matches(seat) ? [{ person, seat, drawnIn: i === 0 && person.placement.role === "board" }] : [])),
    ),
  ).map((held) => ({ person: held.person, title: boardTitleOf(held.seat) }));
}

/**
 * Every head of department `departmentId`, each with the title their own
 * head row reads, read from every head each person holds, as
 * `teamSeatHoldings` reads seats: someone drawn in a team-level seat, or the
 * team leader, who took the head on a hand-over shows in its place (#852).
 * `headOf` names the block for a head row with no title.
 */
function headHoldings(departmentId: number, headOf: string, roles: TeamRoles): Holding[] {
  return inHolderOrder(
    roles.people.flatMap((person) =>
      headSeatsOf(person).flatMap((seat, i) => (seat.departmentId === departmentId ? [{ person, seat, drawnIn: i === 0 && person.placement.role === "head" }] : [])),
    ),
  ).map((held) => ({ person: held.person, title: held.seat.title.trim() || defaultHeadTitle(headOf) }));
}

/** The active team-level row `roleId`, as a seat someone holds; undefined once it has ended. */
function teamSeatRow(roleId: number, roles: TeamRoles): BoardRole | undefined {
  for (const person of roles.people) {
    const seat = teamSeatsOf(person).find((s) => s.roleId === roleId);
    if (seat !== undefined) return seat;
  }
  return undefined;
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
      return teamSeatRow(binding.roleId, roles) !== undefined;
    case "department-head":
      return roles.org.departments.some((d) => d.id === binding.departmentId);
    case "division-lead":
      return roles.org.divisions.some((d) => d.id === binding.divisionId);
  }
}

/** Who holds a bound seat now, with the text the seat reads under their name. */
export type Holding = { readonly person: TeamPerson; readonly title: string };

/**
 * Every holder of a bound seat now, each with the seat's own text, drawn-in
 * first, then by name (issue #880): the team leaders, each with their title
 * or "Team Leader"; a full-access seat's holders by its flag; a team-level
 * seat's holders by the seat its `roles` row is (`boardSeatKey`, as the Team
 * tree reads co-holders), not by that row alone, each with their row's
 * title; a department's heads, each with their title or "Head of" `headOf`
 * (the block's name; the department's own by default). A division lead place
 * and a bound person show one: the lead at that place among the division's
 * co-leads with the division's name, and the person, who reads "Head of"
 * `headOf` on a head place, else their own page title. None when the seat has
 * no holder or is gone, or the person holds no active role.
 */
export function holdingsOf(binding: PlaceBinding, roles: TeamRoles, headOf?: string): readonly Holding[] {
  if (!seatExists(binding, roles)) return [];
  switch (binding.kind) {
    case "person": {
      const person = roles.people.find((p) => p.id === binding.memberId);
      if (person === undefined) return [];
      return [{ person, title: headOf === undefined ? (titleOf(person) ?? "") : defaultHeadTitle(headOf) }];
    }
    case "team-leader":
      return roles.people
        .filter((p) => p.placement.role === "team-leader")
        .sort(byName)
        .map((person) => ({ person, title: titleOf(person) ?? "Team Leader" }));
    case "full-access-seat":
      return teamSeatHoldings((seat) => boardFlagOf(seat.fullAccess) === binding.seat, roles);
    case "team-seat": {
      const row = teamSeatRow(binding.roleId, roles);
      if (row === undefined) return [];
      const key = boardSeatKey(row);
      return teamSeatHoldings((seat) => boardSeatKey(seat) === key, roles);
    }
    case "department-head":
      return headHoldings(binding.departmentId, headOf ?? roles.org.departments.find((d) => d.id === binding.departmentId)?.name ?? "", roles);
    case "division-lead": {
      const person = leadsOf(roles, binding.divisionId)[binding.place];
      const division = roles.org.divisions.find((d) => d.id === binding.divisionId);
      return person === undefined || division === undefined ? [] : [{ person, title: divisionLabel(division.name) }];
    }
  }
}

/**
 * The holder a bound seat shows first now (`holdingsOf`), with the seat's own
 * text: the one the editor names for the place. Null when it shows no one.
 */
export function holdingOf(binding: PlaceBinding, roles: TeamRoles, headOf?: string): Holding | null {
  return holdingsOf(binding, roles, headOf)[0] ?? null;
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
 * How many people a place draws (issue #880): the team leader's place, an arc
 * place and a head place draw every holder of their seat side by side; a
 * division lead row draws one person.
 */
export type PlaceShows = "every-holder" | "one-person";

/**
 * What a page seat is bound to when the editor picks `person` for it: the
 * seat they hold, wherever the Team tree places it, so the place follows that
 * seat on a hand-over (ADR 0019). On a place that draws every holder, any
 * holder of a seat with several is bound to that seat (issue #880). A place
 * that draws one person is bound to the seat only while `person` is its one
 * holder, so the row shows the person picked. A person who holds no seat, or
 * one the place would not show them in, is bound to themselves (Owner
 * decision, #846 R4.1).
 */
export function bindingFor(person: TeamPerson, roles: TeamRoles, shows: PlaceShows = "every-holder"): PlaceBinding {
  const seat = seatOf(person, roles);
  const showsThem = seat !== null && (shows === "every-holder" ? holdsSeat(seat, person, roles) : soleHolder(seat, person, roles));
  return showsThem ? seat : { kind: "person", memberId: person.id };
}

/** Whether `person` is the one holder the bound seat shows now. */
function soleHolder(binding: PlaceBinding, person: TeamPerson, roles: TeamRoles): boolean {
  const holders = holdingsOf(binding, roles);
  return holders.length === 1 && holders[0].person.id === person.id;
}

/** Whether `person` is one of the holders the bound seat shows now (`holdingsOf`). */
function holdsSeat(binding: PlaceBinding, person: TeamPerson, roles: TeamRoles, headOf?: string): boolean {
  return holdingsOf(binding, roles, headOf).some((h) => h.person.id === person.id);
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

/** A place as drawn, with every team member it shows. */
type Placed<T> = Shown<number, T> & { readonly people: readonly TeamPerson[] };

/**
 * A page seat as drawn: the holder it shows first, with the text under the
 * name, and every further holder beside them (issue #880). A role override
 * reads under every holder's name. A name, photo or LinkedIn override was
 * written for one person, so it is laid on only while the place has one
 * holder: on a place with several, each shows their own.
 */
type DrawnPlace = { readonly people: readonly TeamPerson[]; readonly shown: Person; readonly role: string; readonly coHolders?: CoHolders };

/** A place showing `holding` alone: every override laid on. */
function drawnAlone(holding: Holding, { name, photo, linkedin, role }: SeatOverrides): DrawnPlace {
  return {
    people: [holding.person],
    shown: {
      ...personOf(holding.person),
      ...(name !== undefined && { name }),
      ...(photo !== undefined && { photo }),
      ...(linkedin !== undefined && { linkedin }),
    },
    role: role ?? holding.title,
  };
}

/** A place that draws every holder of its seat: the team leader's, an arc place or a head place. */
function drawn(seat: PageSeat, roles: TeamRoles, headOf?: string): DrawnPlace | null {
  const [first, ...rest] = holdingsOf(seat.binding, roles, headOf);
  if (first === undefined) return null;
  const [next, ...after] = rest;
  if (next === undefined) return drawnAlone(first, seat.overrides);
  const { role } = seat.overrides;
  const coHolder = (h: Holding): CoHolder => ({ ...personOf(h.person), role: role ?? h.title });
  return {
    people: [first.person, ...rest.map((h) => h.person)],
    shown: personOf(first.person),
    role: role ?? first.title,
    coHolders: [coHolder(next), ...after.map(coHolder)],
  };
}

/**
 * A division lead row, which draws one person: the first holder of its seat
 * (issue #880). Only that person counts as shown, so a further holder of a
 * seat the row is bound to stays in the core members unless another place
 * draws them.
 */
function drawnLead(seat: PageSeat, roles: TeamRoles): DrawnPlace | null {
  const first = holdingOf(seat.binding, roles);
  return first === null ? null : drawnAlone(first, seat.overrides);
}

/**
 * The seat a binding names, as one key for every way of naming it: two
 * `roles` rows of one co-held seat give one key (`boardSeatKey`). Null for a
 * division lead and a person, which name one person, not a seat with holders.
 */
function seatKeyOf(binding: PlaceBinding, roles: TeamRoles): string | null {
  switch (binding.kind) {
    case "team-leader":
      return "team-leader";
    case "full-access-seat":
      return `flag:${binding.seat}`;
    case "team-seat": {
      const row = teamSeatRow(binding.roleId, roles);
      if (row === undefined) return null;
      const flag = boardFlagOf(row.fullAccess);
      return flag === null ? `seat:${boardSeatKey(row)}` : `flag:${flag}`;
    }
    case "department-head":
      return `head:${binding.departmentId}`;
    case "division-lead":
    case "person":
      return null;
  }
}

const unplaced = <T>({ at, shown }: Placed<T>): Shown<number, T> => ({ at, shown });

/**
 * The page `layout` draws on the team record `roles`: each page seat shows
 * its bound seat's holders now, side by side, with its overrides; a division
 * lead row shows one. One with no holder is left out and keeps its place, and
 * so is one bound to a co-held seat an earlier place already draws (two
 * places naming one seat, for example by its holders' two rows): the repeat
 * is the seat, never the people, so two seats with the same holders each
 * draw. The arc draws at most eight places. The core members are everyone in
 * `roles` whom no drawn place shows, by name, with their title.
 */
export function resolveLayout(layout: TeamLayout, roles: TeamRoles): ResolvedTeam {
  const coHeld = new Set<string>();
  /** The page seat as drawn, or null when it shows no one or an earlier place draws its co-held seat. */
  const place = (seat: PageSeat, headOf?: string): DrawnPlace | null => {
    const d = drawn(seat, roles, headOf);
    if (d === null || d.coHolders === undefined) return d;
    const key = seatKeyOf(seat.binding, roles);
    if (key === null) return d;
    if (coHeld.has(key)) return null;
    coHeld.add(key);
    return d;
  };
  const withCoHolders = (d: DrawnPlace) => (d.coHolders === undefined ? {} : { coHolders: d.coHolders });

  const leader = layout.leader === null ? null : place(layout.leader);
  const arc = layout.arc
    .flatMap((seat): Placed<Leader>[] => {
      const d = place(seat);
      return d === null ? [] : [{ at: seat.id, people: d.people, shown: { ...d.shown, role: d.role, ...withCoHolders(d) } }];
    })
    .slice(0, ARC_LEADERS);
  const departments = layout.departments.map((block) => {
    const leads = block.leads.flatMap((seat): Placed<DivisionLead>[] => {
      const d = drawnLead(seat, roles);
      return d === null ? [] : [{ at: seat.id, people: d.people, shown: { ...d.shown, division: d.role } }];
    });
    const head = place(block.head, block.name);
    const heads: Placed<DepartmentHead>[] =
      head === null
        ? []
        : [
            {
              at: block.head.id,
              people: head.people,
              shown: { kind: "head", ...head.shown, role: head.role, ...withCoHolders(head), leads: leads.map((l) => l.shown) },
            },
          ];
    return { at: block.id, name: block.name, group: block.group, leadsDrawn: block.leadsDrawn, heads, leads };
  });
  const carousel = carouselOf(groupedOf(layout.groups, departments)).flatMap((slide) =>
    slide.places.flatMap((p) => (p.kind === "head" ? [...p.head.people, ...p.leads.flatMap((l) => l.people)] : p.lead.people)),
  );
  const shown = new Set([...(leader?.people ?? []), ...arc.flatMap((l) => l.people), ...carousel].map((p) => p.id));
  const resolved = departments.map((d): ResolvedDepartment => ({ ...d, heads: d.heads.map(unplaced), leads: d.leads.map(unplaced) }));
  return {
    leader: leader === null ? null : { ...leader.shown, role: leader.role, ...withCoHolders(leader) },
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

// A layout built from the team record (ADR 0019 Decision 7, as amended by
// issue #855): the team record's places with no edit, for the seed, a
// database with nothing saved yet, and Reset to team.

/** The binding of a team-level seat: its flag when it has one, else its `roles` row. */
function teamLevelBinding(seat: BoardRole): SeatBinding {
  const flag = boardFlagOf(seat.fullAccess);
  return flag === null ? { kind: "team-seat", roleId: seat.roleId } : { kind: "full-access-seat", seat: flag };
}

/** Where a department block of a record layout sits: the id of its group, and how it draws its leads. */
export type BlockPlace = { readonly group: number; readonly leadsDrawn: LeadsDrawn };

const spotPart = (spot: string, index: 1 | 2) => Number(spot.split(":")[index]);

/**
 * The layout of the team record's places on `roles`, with no edit: the team
 * leader's seat, the first eight arc places the roles fill, and a block for
 * each open department with a head and a division, under `groups`, each
 * where `placeOf` puts it. A place keeps its own seat; a role text the
 * binding would not read by itself is set as an override, so the page draws
 * what the roles build names. A place showing a further holder of a seat an
 * earlier page seat binds gets no page seat of its own: that page seat draws
 * every holder side by side (issue #880). So does a department's head past
 * its first.
 */
export function recordLayout(roles: TeamRoles, groups: readonly LayoutGroup[], placeOf: (departmentId: number) => BlockPlace): TeamLayout {
  const build = teamBuildOf(roles);
  let lastId = 0;
  const nextId = () => ++lastId;

  /** The binding for a place showing `person`: `own` while they are one of its holders, else them. */
  const bindingAt = (person: TeamPerson, own: SeatBinding, headOf?: string): PlaceBinding =>
    holdsSeat(own, person, roles, headOf) ? own : { kind: "person", memberId: person.id };

  /** Whether `binding` names a seat an earlier page seat already binds (`seatKeyOf`, whichever row names it). */
  const coHeld = (binding: PlaceBinding, earlier: readonly PageSeat[]): boolean => {
    const key = seatKeyOf(binding, roles);
    return key !== null && earlier.some((seat) => seatKeyOf(seat.binding, roles) === key);
  };

  /** A page seat bound to `binding`, overriding its role text only where the binding reads another one than `shownRole`. */
  const pageSeat = (binding: PlaceBinding, shownRole: string, headOf?: string): PageSeat => {
    const title = holdingOf(binding, roles, headOf)?.title;
    return { id: nextId(), binding, overrides: shownRole === title ? {} : { role: shownRole } };
  };

  const ownLeader: SeatBinding = { kind: "team-leader" };
  const leader = build.leader === null ? { id: nextId(), binding: ownLeader, overrides: {} } : pageSeat(bindingAt(build.leader.person, ownLeader), build.leader.role);

  const arc: PageSeat[] = [];
  for (const built of build.arc.slice(0, ARC_LEADERS)) {
    const { placement } = built.person;
    if (placement.role !== "board") continue;
    const binding = bindingAt(built.person, teamLevelBinding(placement.seat));
    if (coHeld(binding, [leader, ...arc])) continue;
    arc.push(pageSeat(binding, built.role));
  }

  const departments = build.departments.flatMap((department): DepartmentBlock[] => {
    const [head] = department.heads;
    if (head === undefined) return [];
    const id = nextId();
    const ownHead: SeatBinding = { kind: "department-head", departmentId: department.id };
    const headSeat = pageSeat(bindingAt(head.person, ownHead, department.name), head.title ?? `Head of ${department.name}`, department.name);
    const leads = department.leads.map((lead): PageSeat => {
      const own: SeatBinding = { kind: "division-lead", divisionId: spotPart(lead.spot, 1), place: spotPart(lead.spot, 2) };
      return pageSeat(bindingAt(lead.person, own), lead.division);
    });
    return [{ id, department: department.id, name: department.name, ...placeOf(department.id), head: headSeat, leads }];
  });

  return { leader, arc, groups, departments };
}

/** The one group of a layout built with nothing saved: every department in it, its leads under its head. */
export const FIRST_GROUP: LayoutGroup = { id: 1, name: "Departments" };

/**
 * The layout a database with nothing saved draws (`recordLayout`): every
 * department under `FIRST_GROUP`, its leads under its head. The editor's
 * first save stores it with whatever groups the editor gives it.
 */
export function firstLayout(roles: TeamRoles): TeamLayout {
  return recordLayout(roles, [FIRST_GROUP], () => ({ group: FIRST_GROUP.id, leadsDrawn: "under" }));
}

/**
 * The Team page the team record draws with nothing saved (`firstLayout`), onto
 * `base` for everything else; null when the roles cannot fill a section the
 * page always draws (`filledTeamPage`).
 */
export function teamPageFromRoles(roles: TeamRoles, base: TeamPage): FilledTeamPage | null {
  return filledTeamPage(layoutPageOf(roles, firstLayout(roles), NO_TEAM_LAYER, base));
}

/**
 * The layout Reset to team writes (board 80h; issue #856): the team record's
 * places (`recordLayout`) under `kept`'s group list, which it keeps. Each
 * department `kept` shows stays in its group there and draws its leads as
 * there, found by the department its block shows, so a head swapped to
 * another person or seat, or handed over, keeps it; a department new to the
 * page goes under the first group, its leads under its head.
 */
export function teamRecordLayout(roles: TeamRoles, kept: TeamLayout): TeamLayout {
  const [first] = kept.groups;
  if (first === undefined) return firstLayout(roles);
  return recordLayout(roles, kept.groups, (departmentId) => {
    const own = kept.departments.find((k) => k.department === departmentId);
    return { group: own?.group ?? first.id, leadsDrawn: own?.leadsDrawn ?? "under" };
  });
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

/**
 * The two kinds a layout stored before department groups gives its blocks
 * (issue #856): the slides a block sat on then, "Technical Departments", its
 * leads under its head, or "Operations", its leads beside it. Only such a
 * layout names a kind; the team record holds none since issue #855.
 */
export const STORED_KINDS = ["technical", "operations"] as const;
export type StoredKind = (typeof STORED_KINDS)[number];

/** The groups a layout stored before groups reads as, in order, one per kind, with the lead drawing that kind had. */
const KIND_GROUPS: readonly { readonly kind: StoredKind; readonly name: string; readonly leadsDrawn: LeadsDrawn }[] = [
  { kind: "technical", name: "Technical Departments", leadsDrawn: "under" },
  { kind: "operations", name: "Operations", leadsDrawn: "beside" },
];

/** The group a kind reads as (`KIND_GROUPS`): its id, its place in the list from 1, and its lead drawing. */
function kindGroupOf(kind: StoredKind): BlockPlace {
  const i = KIND_GROUPS.findIndex((g) => g.kind === kind);
  return { group: i + 1, leadsDrawn: KIND_GROUPS[i].leadsDrawn };
}

const kindLayoutSchema = z.strictObject({
  leader: seatSchema.nullable(),
  arc: z.array(seatSchema).max(ARC_LEADERS),
  departments: z.array(z.strictObject({ ...blockParts, kind: z.enum(STORED_KINDS) })).max(200),
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

/** A block stored before department groups: its kind in place of its group, lead drawing and department. */
export type KindBlock = { readonly id: number; readonly name: string; readonly kind: StoredKind; readonly head: PageSeat; readonly leads: readonly PageSeat[] };

/** A layout as storage holds it: grouped, or in the form before groups (issue #856). */
export type StoredLayout = TeamLayout | KindLayout;

/** Whether a stored layout is grouped: only a grouped one has a group list. */
export const isGroupedLayout = (layout: StoredLayout): layout is TeamLayout => "groups" in layout;

/**
 * The team record departments a block stored before groups names by its own
 * parts: the departments of the divisions its lead rows are bound to, and the
 * departments named as the block is.
 */
function departmentMarksOf(block: KindBlock, roles: TeamRoles): Set<number> {
  const departments = roles.org.departments;
  const onRecord = (departmentId: number | undefined): departmentId is number => departments.some((d) => d.id === departmentId);
  const departmentOfDivision = (divisionId: number) => roles.org.divisions.find((d) => d.id === divisionId)?.departmentId;
  const fromLeads = block.leads.map(({ binding }) => (binding.kind === "division-lead" ? departmentOfDivision(binding.divisionId) : undefined));
  const fromName = departments.filter((d) => d.name === block.name).map((d) => d.id);
  return new Set([...fromLeads, ...fromName].filter(onRecord));
}

/**
 * The team record department each block stored before groups shows (issue
 * #856). A block's own parts (`departmentMarksOf`) claim a department when
 * they name exactly one, or when they name several and its head is bound to
 * the head seat of one of them. A block whose parts name none claims, more
 * weakly, the department whose head seat its head is bound to. Each block
 * shows the department it alone claims, a weak claim only where no block's
 * parts claim it; a head swapped to another person or seat, or a head seat
 * two blocks share, so leaves the department with the block that shows it. A
 * block that claims nothing, or what another block claims as strongly, shows
 * none, as a department the editor added does.
 */
function storedDepartmentsOf(blocks: readonly KindBlock[], roles: TeamRoles): (number | null)[] {
  const claims = blocks.map((block) => {
    const head = block.head.binding.kind === "department-head" ? block.head.binding.departmentId : null;
    const marks = departmentMarksOf(block, roles);
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
 * The grouped layout a stored one draws on `roles`: a grouped one as it is;
 * one stored before groups as its kinds' two groups (`KIND_GROUPS`) with each
 * block where its kind put it, showing the department `storedDepartmentsOf`
 * finds. The editor opens on it, so the next save writes the group list and
 * each block's department, and Reset to team finds each department's group
 * by it.
 */
export function teamLayoutOf(stored: StoredLayout, roles: TeamRoles): TeamLayout {
  if (isGroupedLayout(stored)) return stored;
  const shows = storedDepartmentsOf(stored.departments, roles);
  return {
    leader: stored.leader,
    arc: stored.arc,
    groups: KIND_GROUPS.map((g) => ({ id: kindGroupOf(g.kind).group, name: g.name })),
    departments: stored.departments.map(({ kind, ...block }, i) => ({ ...block, department: shows[i], ...kindGroupOf(kind) })),
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
