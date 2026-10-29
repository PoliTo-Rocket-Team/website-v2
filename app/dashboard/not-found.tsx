import { TopBarTitle } from "@/components/dashboard/top-bar-slot";
import { NotFoundView } from "@/components/not-found-view";

// A dashboard page the viewer may not open, or whose data is missing, calls
// `notFound()` and lands here (issue #328, board 103d): inside the dashboard
// shell, so the sidebar and the user menu stay, with no data from the page
// that refused. The view fills the main area edge to edge: it bleeds over the
// shell's main padding (`DashboardShell` in components/dashboard/shell.tsx)
// and is as tall as the screen under the phone top bar (56px). It bleeds over
// the top pad only when it opens the main area: in a View as session the
// banner sits above it, and the view starts under the banner's own margin.
// The phone top bar reads the shell's neutral "Dashboard", never the name of
// the page the address points at (issue #807): board 103d draws no phone title.
export default function DashboardNotFound() {
  return (
    <>
      <TopBarTitle title="Dashboard" />
      <NotFoundView
        body="We couldn't find this page, or you don't have access to it."
        back={{ label: "Back to Overview", href: "/dashboard" }}
        className="-mx-4 -mb-12 min-h-[calc(100svh-3.5rem)] first:-mt-4 md:-mx-10 md:-mb-16 md:min-h-svh md:first:-mt-8"
      />
    </>
  );
}
