import type { PersonRecord } from "./division-members";
import { boardTitleOf, divisionLabel, headTitleOf, homeFirst, seatTitleValue, type OrgChart, type RoleBeyondDivisions } from "./team";

// The Placement section of the member panel (board 98, issue #647): every
// place someone holds on the team, each with the role title as stored, the
// unit it is in and a tag. A head and a team-level seat holder hold no
// division, so they are listed by their seat, never left with an empty list.

/** The tag at a placement's end (board 98). */
export type PlaceTag = "lead" | "member" | "head" | "seat" | "advisor";

export const PLACE_TAG_LABELS: Readonly<Record<PlaceTag, string>> = {
  lead: "Lead",
  member: "Member",
  head: "Head",
  seat: "Seat",
  advisor: "Advisor",
};

/** One row of the Placement section. */
export type PersonPlace = {
  /** "Mission Analysis Lead", "Head of Propulsion", "Chief Engineer": the title as stored, else its default. */
  readonly title: string;
  /** "Operations · Mission Analysis" under the title; null where the title names the unit (a head, a seat). */
  readonly unit: string | null;
  /** The code chip at the row's start: the division's, or a head's department's; null draws the unit mark. */
  readonly code: string | null;
  readonly tag: PlaceTag;
};

type PlaceRecord = Pick<PersonRecord, "memberships" | "beyondDivisions" | "titles" | "advising">;

const SEAT_RANK: Readonly<Record<RoleBeyondDivisions["kind"], number>> = { "team-leader": 0, board: 1, head: 2, department: 3, advisor: 4 };

function stored(title: string | null | undefined): string | null {
  const t = title?.trim() ?? "";
  return t === "" ? null : t;
}

function seatPlace(role: RoleBeyondDivisions, org: OrgChart): PersonPlace {
  const department = (id: number | null) => org.departments.find((d) => d.id === id) ?? null;
  switch (role.kind) {
    case "team-leader":
      return { title: seatTitleValue(role, org), unit: null, code: null, tag: "seat" };
    case "board":
      return { title: boardTitleOf(role.seat), unit: null, code: null, tag: "seat" };
    case "head": {
      const d = department(role.departmentId);
      return { title: headTitleOf(role.title, d?.name ?? null), unit: null, code: d?.code ?? null, tag: "head" };
    }
    case "department":
      return { title: "Member", unit: department(role.departmentId)?.name ?? null, code: department(role.departmentId)?.code ?? null, tag: "member" };
    case "advisor":
      return { title: "Advisor", unit: department(role.departmentId)?.name ?? "Team", code: null, tag: "advisor" };
  }
}

/**
 * Every place `record` holds, the highest first: the team leader's seat, a
 * team-level seat, a headship, then each division (home division first), then
 * a role kept on a department or an Advisor role. A division's title is its
 * stored one, else "Division Lead" or "Member".
 */
export function placesOf(record: PlaceRecord, org: OrgChart): PersonPlace[] {
  const seats = [...record.beyondDivisions].sort((a, b) => SEAT_RANK[a.kind] - SEAT_RANK[b.kind]).map((role) => seatPlace(role, org));
  const high = seats.filter((p) => p.tag === "seat" || p.tag === "head");
  const low = seats.filter((p) => p.tag !== "seat" && p.tag !== "head");
  const divisions = homeFirst(record.memberships).flatMap((m): PersonPlace[] => {
    const division = org.divisions.find((d) => d.id === m.divisionId);
    if (!division) return [];
    const department = org.departments.find((d) => d.id === division.departmentId)?.name ?? "";
    const advising = record.advising.includes(division.id);
    const fallback = advising ? "Advisor" : m.role === "lead" ? "Division Lead" : "Member";
    return [
      {
        title: stored(record.titles[division.id]) ?? fallback,
        unit: department === "" ? divisionLabel(division.name) : `${department} · ${divisionLabel(division.name)}`,
        code: division.code ?? null,
        tag: advising ? "advisor" : m.role,
      },
    ];
  });
  return [...high, ...divisions, ...low];
}

/** The member panel's header line (board 98): "Mission Analysis Lead · member since 2024". */
export function placeHeaderLine(places: readonly PersonPlace[], since: number): string {
  return `${places[0]?.title ?? "Member"} · member since ${since}`;
}
