import type { NavCounts } from "./access";
import type { Overview } from "./overview";
import type { DashboardViewer } from "./viewer";

/**
 * The one way dashboard pages read data (issue #141). A test developer gets
 * the dummy arrays (lib/dummy-data/), everyone else the database
 * (./database.ts); ./open.ts picks which. A later page adds one method here
 * and to both implementations.
 */
export interface DashboardData {
  readonly viewer: DashboardViewer;
  navCounts(): Promise<NavCounts>;
  overview(): Promise<Overview>;
}
