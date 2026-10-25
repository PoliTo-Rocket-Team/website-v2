import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { privacyPolicy } from "@/lib/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy · PoliTo Rocket Team",
  description: privacyPolicy.description,
};

// The Privacy Policy (issue #122), linked from /login and the footer. The
// text is one record (lib/legal/privacy.ts), drawn by the legal template.
export default function PrivacyPage() {
  return <LegalPage doc={privacyPolicy} />;
}
