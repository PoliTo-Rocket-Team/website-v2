import { navViewer } from "@/lib/nav-viewer";

// Who is signed in, for the navbar (issue #157). The navbar asks from the
// browser, so the pages it sits on never read a cookie and stay prerendered.
export async function GET(): Promise<Response> {
  return Response.json({ viewer: await navViewer() }, { headers: { "Cache-Control": "private, no-store" } });
}
