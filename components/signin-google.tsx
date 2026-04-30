"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

export default function SignInWithGoogle() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn.social({
        provider: "google",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <Button onClick={handleGoogleSignIn} disabled={isGoogleLoading}>
      {isGoogleLoading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.google className="mr-2 h-4 w-4" />
      )}
      Sign in with Google
    </Button>
  );
}
