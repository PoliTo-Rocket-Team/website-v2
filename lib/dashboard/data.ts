import type { NavCounts } from "./access";
import type { Overview } from "./overview";
import type { ApplicationStage, ApplicationsPage, PositionsPage } from "./recruitment";
import type { DashboardViewer } from "./viewer";

/**
 * The one way dashboard pages read and write data (issue #141). A test
 * developer gets the dummy arrays (lib/dummy-data/), and their writes change
 * only a cookie; everyone else gets the database (./database.ts). ./open.ts
 * picks which and answers a DashboardOpening (./opening.ts). A later page
 * adds one method here and to both implementations.
 *
 * A read answers only what the viewer reaches, and a read or write the viewer
 * does not reach rejects with DashboardRefused, so a server action needs no
 * check of its own.
 */
export interface DashboardData {
  readonly viewer: DashboardViewer;
  navCounts(): Promise<NavCounts>;
  overview(): Promise<Overview>;
  /** Boards 41 and 41c (issue #142). */
  positions(): Promise<PositionsPage>;
  /** Board 41b (issue #142). */
  applications(): Promise<ApplicationsPage>;
  setPositionOpen(positionId: number, open: boolean): Promise<void>;
  setApplicationStage(applicationId: number, stage: ApplicationStage): Promise<void>;
  /**
   * Turns recruitment on or off site-wide. Only the operations lead may, and
   * only where the switch is writable (`PositionsPage.recruitment.switchable`).
   */
  setRecruitmentOpen(open: boolean): Promise<void>;
}

/** A read or write the viewer does not reach. */
export class DashboardRefused extends Error {
  constructor(what: string) {
    super(`Not allowed: ${what}`);
    this.name = "DashboardRefused";
  }
}
