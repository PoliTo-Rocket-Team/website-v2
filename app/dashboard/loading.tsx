import { DashboardPageFallback } from "@/components/dashboard/page-fallback";

// While a dashboard page's own data has not arrived yet, after a move from
// another page (a redirect included, as when leaving the team sends the
// applicant from /dashboard on to My applications), its place in the shell
// shows the loading fallback, never an empty main area (issue #227).
export default function DashboardLoading() {
  return <DashboardPageFallback />;
}
