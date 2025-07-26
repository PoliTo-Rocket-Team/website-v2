"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/icons";

export default function SignInWithGoogle() {
  const searchParams = useSearchParams();
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const url = searchParams.get("callbackUrl");
    if (url) setCallbackUrl(url);
  }, [searchParams]);

  const handleGoogleSignIn = () => {
    setIsGoogleLoading(true);
    signIn("google", { callbackUrl });
  };

  return (
    <Button
      onClick={handleGoogleSignIn}
      disabled={isGoogleLoading}
    >
      {isGoogleLoading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.google className="mr-2 h-4 w-4" />
      )}
      Sign in with Google
    </Button>
  );
}
