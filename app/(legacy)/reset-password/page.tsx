import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Suspense fallback={<div className="min-h-24 w-full" aria-hidden="true" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
