import { notFound } from "next/navigation";

// Any dashboard address no route serves lands here, so it shows the dashboard
// not-found page inside the shell (with its own phone top bar title) instead
// of the site-wide not-found page (issue #807). A catch-all ranks below every
// static and dynamic segment, so it never takes an address a page serves.
export default function DashboardUnknownAddress(): never {
  notFound();
}
