import { Loader2 } from "lucide-react";

/**
 * What a dashboard page shows while it loads, in place of an empty main area
 * (issue #227): a quiet spinner where the page will be. Every page wraps its
 * live part in a Suspense with this fallback, and app/dashboard/loading.tsx
 * shows it while a page's data is on its way. The spinner turns only under
 * motion-safe; under reduced motion it stands still.
 */
export function DashboardPageFallback() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[50svh] items-center justify-center text-prt-muted">
      <Loader2 aria-hidden className="h-5 w-5 motion-safe:animate-spin" strokeWidth={1.75} />
    </div>
  );
}
