"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { VIEWER_KINDS, VIEWER_KIND_LABELS, type DashboardViewer } from "@/lib/dashboard/viewer";
import { TEST_DEVELOPER_SIGN_OUT_HREF, testDeveloperSignInHref } from "@/lib/test-developer";
import { Avatar } from "./avatar";

const ICON_BUTTON =
  "flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-10";

function Identity({ viewer }: { viewer: DashboardViewer }) {
  return (
    <>
      <Avatar name={viewer.name} accent />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium text-prt-text">{viewer.name}</span>
        <span className="block truncate text-[12px] text-prt-muted">{viewer.role}</span>
      </span>
    </>
  );
}

// The viewer card at the foot of the sidebar (boards 40 to 46): initials on
// the accent, name, role, and sign out. A test developer clicks it to look as
// another viewer: the four viewers, each a sign-in link back to this page.
export function UserCard({ viewer }: { viewer: DashboardViewer }) {
  return (
    <div className="mt-3 flex h-[52px] shrink-0 items-center gap-0.5 rounded-xl border border-hairline pl-2.5 pr-1">
      {viewer.session === "test-developer" ? (
        <ViewerSwitch viewer={viewer} />
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Identity viewer={viewer} />
        </div>
      )}
      {viewer.session === "test-developer" ? (
        <a href={TEST_DEVELOPER_SIGN_OUT_HREF} aria-label="Sign out" className={ICON_BUTTON}>
          <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </a>
      ) : (
        <AccountSignOut />
      )}
    </div>
  );
}

function ViewerSwitch({ viewer }: { viewer: DashboardViewer }) {
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${viewer.name}, ${viewer.role}. Switch viewer`}
        className="-ml-1.5 flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pl-1.5 transition-colors duration-300 ease-out hover:bg-white-5 data-[state=open]:bg-white-5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-10"
      >
        <Identity viewer={viewer} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          side="top"
          align="start"
          sideOffset={10}
          className="z-50 w-[224px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.Label className="px-2.5 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
            View as
          </DropdownMenuPrimitive.Label>
          {VIEWER_KINDS.map((kind) => (
            <DropdownMenuPrimitive.Item key={kind} asChild>
              <a
                href={testDeveloperSignInHref(kind, pathname)}
                aria-current={kind === viewer.kind ? "true" : undefined}
                className="flex h-8 items-center justify-between rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text"
              >
                {VIEWER_KIND_LABELS[kind]}
                {kind === viewer.kind && <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />}
              </a>
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function AccountSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(`Could not sign out. ${error.message ?? "Please try again."}`);
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  };
  return (
    <button type="button" onClick={signOut} disabled={pending} aria-label="Sign out" className={ICON_BUTTON}>
      <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
