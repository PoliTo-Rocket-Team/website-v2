"use client";

import { signInWithGoogle } from "@/app/actions/auth/signin-out";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";

export default function SignInPage() {
  const [isPending, startTransition] = useTransition();

  const handleSignIn = () => {
    startTransition(async () => {
      await signInWithGoogle();
    });
  };

  return (
    <div>
      <Button 
        size={"lg"} 
        onClick={handleSignIn}
        disabled={isPending}
      >
        {isPending ? "Signing in..." : "Sign In with Google"}
      </Button>
    </div>
  );
}
