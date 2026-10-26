import { SiteFooter } from "@/components/landing/site-footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { NotFoundView } from "@/components/not-found-view";

// The public site's not-found page (issue #328, board 103d): a URL no route
// serves, or a public page's `notFound()`. The site's navbar and footer, and
// between them the not-found view the dashboard shares, one screen tall. The
// navbar is fixed over the view's top, as on every public page.
export default function NotFound() {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <main>
        <NotFoundView
          body="We couldn't find this page."
          back={{ label: "Back to home", href: "/" }}
          className="min-h-svh pt-16 md:pt-[72px]"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
