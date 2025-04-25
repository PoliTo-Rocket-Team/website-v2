"use client";

import { signInWithGoogle } from "@/app/actions/auth/signin-out";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <div>
      <Button size={"lg"} onClick={signInWithGoogle}>Sign In with Google</Button>
    </div>
  );
}
