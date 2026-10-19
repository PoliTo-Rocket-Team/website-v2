import type { PrivatePathname } from "@/lib/storage/pathname";
import type { ApplicationDocument } from "./recruitment";
import { readsAsDivisionLead, type DivisionUnit, type ViewerStanding } from "./viewer";

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

/** A viewer as the recruitment pages read them: their kind, and the units their roles and grants cover. */
export type RecruitmentReader = ViewerStanding & {
  readonly divisionIds: readonly number[];
  readonly departmentIds: readonly number[];
};

/** Whether the viewer reads the recruitment pages at all: a lead, a head, full access, or a member holding an area grant. */
export function readsRecruitment(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead" || viewer.kind === "department-head" || readsAsDivisionLead(viewer);
}

/** Whether the viewer reads the recruitment of one division: every division with full access, else the units they cover. */
export function readsRecruitmentIn(viewer: RecruitmentReader, unit: DivisionUnit): boolean {
  if (!readsRecruitment(viewer)) return false;
  return viewer.kind === "operations-lead" || viewer.divisionIds.includes(unit.divisionId) || viewer.departmentIds.includes(unit.departmentId);
}

/**
 * Where an application stands for the access check, read from the database;
 * null when there is no such application, its position was deleted, or its
 * division or department is closed. Each of those leaves the Applications page.
 */
export type ApplicationPlace = { readonly unit: DivisionUnit; readonly withdrawn: boolean };

/**
 * Whether the viewer may open the application and its documents: it is on
 * their Applications page. A withdrawn application has left every lead's
 * page (issue #169), so it opens for nobody.
 */
export function mayOpenApplication(viewer: RecruitmentReader, place: ApplicationPlace | null): boolean {
  return place !== null && !place.withdrawn && readsRecruitmentIn(viewer, place.unit);
}
