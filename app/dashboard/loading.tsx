import { PageSkeleton } from "@/components/dashboard/page-skeleton";

// While a dashboard page's own data has not arrived yet, after a move from
// another page (a redirect included, as when leaving the team sends the
// applicant from /dashboard on to My applications), its place in the shell
// shows a placeholder, never an empty main area (issue #227). Once the page
// itself arrives, its own skeleton takes over until its content streams in
// (issue #397).
export default function DashboardLoading() {
  return <PageSkeleton kind="plain" />;
}
