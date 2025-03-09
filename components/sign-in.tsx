"use client";

import { signInWithGoogle } from "@/app/actions";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <div>
      <Button size={"lg"} className="w-full" onClick={signInWithGoogle}>Sign In with Google</Button>
    </div>
  );
}
