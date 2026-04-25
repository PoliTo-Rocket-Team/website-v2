"use client";
import Link from "next/link";
import { Button } from "./ui/button";
import { useSession } from "@/lib/auth-client";
import { UserAccountNav } from "@/components/user-account-nav";

export default function AuthButton() {
  const { data: session, isPending } = useSession();

  if (session) {
    return (
      <UserAccountNav
        user={{
          name: session.user?.name || "User",
          image: "",
          email: session.email || "",
        }}
      />
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-end min-w-20">
        <div className="h-9 w-20 animate-pulse rounded-md border border-border/60 bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/login">Login</Link>
      </Button>
    </div>
  );
}
