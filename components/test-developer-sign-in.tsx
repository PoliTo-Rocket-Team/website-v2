import { VIEWER_KINDS, VIEWER_KIND_LABELS, type ViewerKind } from "@/lib/dashboard/viewer";
import { testDeveloperOn, testDeveloperSignInHref } from "@/lib/test-developer";

// The "Sign in as test developer" entry on /login (issue #141): one ghost
// pill per viewer, each a plain link to the sign-in route. A server
// component with no client code, so a deploy where the gate is off sends
// none of it, not even in a script.
export function TestDeveloperSignIn({ cb }: { cb?: string | null }) {
  if (!testDeveloperOn()) return null;
  return <Entry viewerHref={(kind) => testDeveloperSignInHref(kind, cb)} />;
}

/**
 * The entry's space while the request-time gate answers (issue #157): the
 * same layout, hidden and with no links, so the panel does not move when the
 * entry fills it. Asked while prerendering, so a production build reserves
 * nothing.
 */
export function TestDeveloperSignInSpace() {
  if (!testDeveloperOn()) return null;
  return <Entry viewerHref={null} />;
}

const PILL =
  "flex h-9 items-center justify-center rounded-full border border-white-10 px-3 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:border-border-strong hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Entry({ viewerHref }: { viewerHref: ((kind: ViewerKind) => string) | null }) {
  const space = viewerHref === null;
  return (
    <section
      aria-labelledby={space ? undefined : "test-developer-heading"}
      aria-hidden={space || undefined}
      className={`mt-8 w-full ${space ? "invisible" : ""}`}
    >
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white-10" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-prt-muted">or</span>
        <span className="h-px flex-1 bg-white-10" />
      </div>
      <h2 id={space ? undefined : "test-developer-heading"} className="mt-6 text-[14px] font-semibold">
        Sign in as test developer
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {VIEWER_KINDS.map((kind) => (
          <li key={kind}>
            {space ? (
              <span className={PILL}>{VIEWER_KIND_LABELS[kind]}</span>
            ) : (
              <a href={viewerHref(kind)} className={PILL}>
                {VIEWER_KIND_LABELS[kind]}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
