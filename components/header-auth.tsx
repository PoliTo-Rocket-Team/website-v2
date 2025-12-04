"use client";
import Link from "next/link";
import { Button } from "./ui/button";
import { UserAccountNav } from "@/components/user-account-nav";
import { useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session } = useSession();
  return session ? (
    <UserAccountNav
      user={{
        name: session?.user?.name || "User",
        image: "",
        email: session?.email || "",
      }}
    />
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"default"}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
    </div>
  );
}
