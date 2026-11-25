import type { DashboardOpening } from "../../opening";
import type { DashboardData } from "../../data";
import type { ViewerStanding } from "../../viewer";

// Stands in for `@/lib/dashboard/open` in a page test that opens no database:
// the page is asked for by the viewer the test names. The viewer is all the
// data there is, so a page that reads anything else fails its test.

let opening: DashboardOpening = { kind: "signed-out" };

export function openAs(viewer: ViewerStanding): void {
  opening = { kind: "open", data: { viewer } as unknown as DashboardData };
}

export function openClosed(kind: "signed-out" | "account-unresolved"): void {
  opening = { kind };
}

export async function openDashboard(): Promise<DashboardOpening> {
  return opening;
}
