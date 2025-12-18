"use client";
import Link from "next/link";
import { Button } from "./ui/button";
import { useSession } from "@/lib/auth-client";
import { UserAccountNav } from "@/components/user-account-nav";

export default function AuthButton({
  initialSession,
}: {
  initialSession: any;
}) {
  const { data: session, isPending } = useSession();

  // Use initialSession during initial render to prevent flash
  const currentSession = isPending ? initialSession : session;

  return currentSession ? (
    <UserAccountNav
      user={{
        name: currentSession?.user?.name || "User",
        // google image takes too long to load, so default to empty string for now
        image: "",
        email: currentSession?.email || "",
      }}
    />
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/login">Login</Link>
      </Button>
    </div>
  );
}
