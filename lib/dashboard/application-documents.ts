import type { PrivatePathname } from "@/lib/storage/pathname";
import type { ApplicationDocument } from "./recruitment";
import { readsArea, readsAreaIn, type AreaReader, type DivisionUnit, type GrantArea, type ViewerStanding } from "./viewer";

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

/** A viewer as the recruitment pages read them: their kind, the units their roles and scope rows cover, and their area grants. */
export type RecruitmentReader = AreaReader;

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

/** Whether the viewer reads one recruitment area in one division: every division with full access, else where `readsAreaIn` covers it. */
export function readsRecruitmentIn(viewer: RecruitmentReader, area: RecruitmentArea, unit: DivisionUnit): boolean {
  return readsAreaIn(viewer, area, unit);
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
