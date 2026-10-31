"use client";

import { createContext, Suspense, use, useContext, useState } from "react";
import { Eye } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { DashboardChrome } from "@/lib/dashboard/chrome";
import { viewAsBannerLine, viewAsFailureLine, type ViewAsBanner as Banner, type ViewAsCallFailure } from "@/lib/dashboard/view-as";

/** The frame's chrome, for the banner wherever a dashboard page draws it: the shell's page, or an editor lying over it. */
export const ViewAsBannerChrome = createContext<Promise<DashboardChrome> | null>(null);

/**
 * Where the banner sits: across the top of the page (boards 96b, 96c), or as
 * a strip under an editor's bar, which lies over the whole dashboard.
 */
type Placement = "page" | "editor";

const PLACEMENT: Readonly<Record<Placement, string>> = {
  page: "mb-4 rounded-xl border border-warning/40 py-2 pl-4 pr-2 md:mb-6 md:pr-4",
  editor: "shrink-0 border-b border-warning/20 px-4 py-2 md:px-6",
};

// The View as banner (issue #611): every dashboard page of a View as session,
// editors included, says across its top who it is viewed as, and offers
// "Stop viewing". Board 96b is the live site's line, board 96c a preview's;
// the server picks which (lib/dashboard/database-view-as-banner.ts). A
// session that is not a View as one draws nothing.
export function ViewAsBanner({ placement }: { placement: Placement }) {
  const chrome = useContext(ViewAsBannerChrome);
  if (chrome === null) return null;
  return (
    <Suspense fallback={null}>
      <ResolvedBanner chrome={chrome} placement={placement} />
    </Suspense>
  );
}

function ResolvedBanner({ chrome, placement }: { chrome: Promise<DashboardChrome>; placement: Placement }) {
  const resolved = use(chrome);
  if (resolved.kind !== "open" || resolved.viewingAs === null) return null;
  return <Bar banner={resolved.viewingAs} placement={placement} />;
}

/** A call to the auth server, read as a failure the banner can name, or null when it succeeded. */
async function failureOf(call: () => Promise<{ error: { status: number; statusText: string; message?: string } | null }>): Promise<ViewAsCallFailure | null> {
  try {
    const { error } = await call();
    if (error === null) return null;
    return { kind: "answered", status: error.status, statusText: error.statusText, message: error.message ?? null };
  } catch {
    return { kind: "unreached" };
  }
}

function Bar({ banner, placement }: { banner: Banner; placement: Placement }) {
  const [pending, setPending] = useState<"stop" | "sign-out" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stop (issue #899) ends the View as session on the server and signs the
  // acting account's own session back in, also once the View as session has
  // run out. When it still fails, the banner says why and offers signing out,
  // which ends every session cookie this browser holds.
  const stop = async () => {
    if (pending !== null) return;
    setPending("stop");
    setError(null);
    const failed = await failureOf(() => authClient.$fetch("/view-as/stop", { method: "POST" }));
    if (failed !== null) {
      setError(viewAsFailureLine("stop", failed));
      setPending(null);
      return;
    }
    // A full load, so every part of the frame reads the acting account's session again.
    window.location.assign("/dashboard");
  };

  const signOut = async () => {
    if (pending !== null) return;
    setPending("sign-out");
    const failed = await failureOf(() => authClient.signOut());
    if (failed !== null) {
      setError(viewAsFailureLine("sign-out", failed));
      setPending(null);
      return;
    }
    window.location.assign("/login?cb=/dashboard");
  };

  return (
    <section aria-label="View as" className={`flex items-center gap-2.5 bg-warning-soft text-warning ${PLACEMENT[placement]}`}>
      <Eye aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 md:text-[14px]">
        {viewAsBannerLine(banner)}
        {error !== null && (
          <span role="alert" className="block text-danger">
            {error}{" "}
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={pending !== null}
              className="font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign out instead
            </button>
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => void stop()}
        disabled={pending !== null}
        className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full bg-prt-text px-3 text-[13px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Stop viewing
      </button>
    </section>
  );
}
