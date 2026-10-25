import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { termsOfService } from "@/lib/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Service · PoliTo Rocket Team",
  description: termsOfService.description,
};

// The Terms of Service (issue #122), linked from /login and the footer. The
// text is one record (lib/legal/terms.ts), drawn by the legal template.
export default function TermsPage() {
  return <LegalPage doc={termsOfService} />;
}
