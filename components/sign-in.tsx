"use client";

import { signInWithGoogle } from "@/app/actions";

export default function SignInPage() {
  return (
    <div>
      <button onClick={signInWithGoogle}>Sign In with Google</button>
    </div>
  );
}
