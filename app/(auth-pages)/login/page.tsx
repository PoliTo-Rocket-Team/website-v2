import { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { GalleryVerticalEnd } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login | Polito Rocket Team",
  description: "Login to your account",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          {/* //! todo add prt logo  */}
          Polito Rocket Team
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
