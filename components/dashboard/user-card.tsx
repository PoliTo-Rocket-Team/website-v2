"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MenuPage } from "@/lib/dashboard/access";
import { VIEWER_KINDS, VIEWER_KIND_LABELS, type DashboardViewer } from "@/lib/dashboard/viewer";
import { testDeveloperSignInHref } from "@/lib/test-developer";
import { useSignOut } from "./account-parts";
import { Avatar } from "./avatar";

const ITEM =
  "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-white-5";

const SEPARATOR = "-mx-1.5 my-1 h-px bg-hairline";

// The user card at the foot of the sidebar and the menu it opens (board 51b):
// initials on the accent, name, role and an up-down chevron. The menu opens
// above the card, as wide as it: the viewer's own page (My account for a
// non-member, My profile for the team), then a red Sign out. A test
// developer also gets "View as", the four viewers, each a sign-in link back
// to this page.
export function UserCard({
  viewer,
  menuPage,
  onNavigate,
}: {
  viewer: DashboardViewer;
  menuPage: MenuPage | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const signOut = useSignOut(viewer.session);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${viewer.name}, ${viewer.role}. Open account menu`}
        className="mt-3 flex h-[52px] w-full shrink-0 items-center gap-2 rounded-xl border border-hairline pl-2.5 pr-2 text-left transition-colors duration-300 ease-out hover:bg-white-5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-10 data-[state=open]:bg-white-5"
      >
        <Avatar name={viewer.name} accent />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-prt-text">{viewer.name}</span>
          <span className="block truncate text-[12px] text-prt-muted">{viewer.role}</span>
        </span>
        <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          {menuPage && (
            <>
              <DropdownMenuPrimitive.Item asChild>
                <Link href={menuPage.href} onClick={onNavigate} className={`${ITEM} text-text-2 data-[highlighted]:text-prt-text`}>
                  <UserRound aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {menuPage.label}
                </Link>
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Separator className={SEPARATOR} />
            </>
          )}

          {viewer.session === "test-developer" && (
            <>
              <DropdownMenuPrimitive.Label className="px-2.5 pb-1.5 pt-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
                View as
              </DropdownMenuPrimitive.Label>
              {VIEWER_KINDS.map((kind) => (
                <DropdownMenuPrimitive.Item key={kind} asChild>
                  <a
                    href={testDeveloperSignInHref(kind, pathname)}
                    aria-current={kind === viewer.kind ? "true" : undefined}
                    className={`${ITEM} justify-between text-text-2 data-[highlighted]:text-prt-text`}
                  >
                    {VIEWER_KIND_LABELS[kind]}
                    {kind === viewer.kind && <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />}
                  </a>
                </DropdownMenuPrimitive.Item>
              ))}
              <DropdownMenuPrimitive.Separator className={SEPARATOR} />
            </>
          )}

          <DropdownMenuPrimitive.Item onSelect={() => void signOut()} className={`${ITEM} text-danger`}>
            <LogOut aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Sign out
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
