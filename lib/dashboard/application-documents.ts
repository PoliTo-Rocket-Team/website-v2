import type { PrivatePathname } from "@/lib/storage/pathname";
import { recruitmentManagerDivision } from "./notices";
import type { ApplicationDocument } from "./recruitment";
import { divisionRoleOf } from "./team";
import { isOffTeam, readsArea, readsAreaIn, type AreaGrant, type DivisionUnit, type GrantArea, type ScopedRole, type ViewerStanding } from "./viewer";

// Who reads an application on the dashboard, and where its documents open
// (issue #406). The Applications page lists an application only for a viewer
// this file lets read it, and the document route
// (app/dashboard/applications/[id]/[document]/route.ts) streams a CV or a
// motivation letter only to the same viewers, so the page and the route never
// disagree about who sees an application.

export type DocumentKind = ApplicationDocument["kind"];

/** A stored document the route may stream: where it sits in the private store, and the name it was uploaded with. */
export type StoredDocument = { readonly pathname: PrivatePathname; readonly name: string };

const DOCUMENT_KINDS: readonly DocumentKind[] = ["cv", "motivation-letter"];

/** A document response is never kept by a browser or a cache: each opening checks access again. */
export const DOCUMENT_NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * The headers a stored application document is sent with, by both routes
 * that send one (issues #406, #831). Every application file was checked to be
 * a PDF on upload, so the type is named and the browser told not to guess
 * another; the uploaded name is percent-escaped, so no character of it can
 * end the header's value.
 */
export function documentHeaders(name: string, size: number, disposition: "inline" | "attachment" = "inline"): Record<string, string> {
  return {
    ...DOCUMENT_NO_STORE,
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(size),
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
  };
}

/** Where an application's document opens: the access-checked route, never a Blob URL. */
export function documentHref(applicationId: number, kind: DocumentKind): string {
  return `/dashboard/applications/${applicationId}/${kind}`;
}

/** The document a route segment names; null for anything else. */
export function documentKindOf(segment: string): DocumentKind | null {
  return DOCUMENT_KINDS.find((kind) => kind === segment) ?? null;
}

/** An application id from a route segment: a whole number from 1; null for anything else. */
export function applicationIdOf(segment: string): number | null {
  if (!/^[1-9][0-9]{0,9}$/.test(segment)) return null;
  const id = Number(segment);
  return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : null;
}

/**
 * An active role as the recruitment pages read it: its type and unit, with
 * its division's code and the day that division closed (null while it is
 * open, and for a role in no division). The two find the recruitment
 * manager (`managesRecruitment`, issue #194).
 */
export type RecruitmentRole = ScopedRole & { readonly divisionCode: string | null; readonly divisionClosedAt: string | null };

/** A viewer as the recruitment pages read them: their kind, their active roles, the units their roles and scope rows cover, and their area grants. */
export type RecruitmentReader = ViewerStanding & { readonly roles: readonly RecruitmentRole[]; readonly grants: readonly AreaGrant[] };

/** The two recruitment areas: the Positions page's and the Applications page's, each its own grant (issue #471). */
export type RecruitmentArea = Extract<GrantArea, "positions" | "applications">;

/**
 * Whether the viewer reads one recruitment page at all (`readsArea`): a lead,
 * a head, full access, or a member granted that area. A Positions grant reads
 * no application, and an Applications grant no Positions page (issue #471).
 */
export function readsRecruitment(viewer: ViewerStanding, area: RecruitmentArea): boolean {
  return readsArea(viewer, area);
}

/**
 * Whether the viewer is the recruitment manager (issue #194): an active lead
 * of the division `recruitmentManagerDivision` finds, the open Logistics
 * division (Owner decisions on #194, 2026-10-22 and 2026-10-25). They read
 * every open division's applications and may make every move a lead may make
 * on them, team-wide; the Positions area stays their own division's. While
 * Logistics is closed nobody is the recruitment manager. It is a role's
 * standing, so a member's never is, a grant's reach read as a member's
 * included, and nor is anyone's off the team.
 */
export function managesRecruitment(viewer: RecruitmentReader): boolean {
  if (viewer.kind === "member" || isOffTeam(viewer.kind)) return false;
  const led = viewer.roles.flatMap((r) =>
    r.divisionId !== null && divisionRoleOf(r.type) === "lead" ? [{ id: r.divisionId, code: r.divisionCode, closedAt: r.divisionClosedAt }] : [],
  );
  return recruitmentManagerDivision(led) !== null;
}

/**
 * Whether the viewer reads one recruitment area in one division: every
 * division with full access, and Applications in every division for the
 * recruitment manager (`managesRecruitment`); else where `readsAreaIn` covers it.
 */
export function readsRecruitmentIn(viewer: RecruitmentReader, area: RecruitmentArea, unit: DivisionUnit): boolean {
  return (area === "applications" && managesRecruitment(viewer)) || readsAreaIn(viewer, area, unit);
}

/**
 * Where an application stands for the access check, read from the database;
 * null when there is no such application, its position was deleted, or its
 * division or department is closed. Each of those leaves the Applications page.
 */
export type ApplicationPlace = { readonly unit: DivisionUnit; readonly withdrawn: boolean };

/**
 * Whether the viewer may open the application and its documents: it is on
 * their Applications page, so they read the Applications area in its
 * division. A withdrawn application has left every lead's page (issue #169),
 * so it opens for nobody.
 */
export function mayOpenApplication(viewer: RecruitmentReader, place: ApplicationPlace | null): boolean {
  return place !== null && !place.withdrawn && readsRecruitmentIn(viewer, "applications", place.unit);
}
