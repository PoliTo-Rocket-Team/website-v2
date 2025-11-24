"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

/**
 * Component to display access denied messages when redirected from protected pages
 */
export function AccessDeniedAlert() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "access_denied") {
      setShowAlert(true);
      
      // Clear the error param from URL after showing
      router.replace(window.location.pathname, { scroll: false });
      
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  if (!showAlert) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 px-5 rounded-md flex gap-3 items-start mb-4">
      <AlertCircle size="16" strokeWidth={2} className="mt-0.5 flex-shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Access Denied</p>
        <p className="text-muted-foreground">
          You don't have the required permissions to access that page. Please contact an administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
