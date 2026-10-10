"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MenuPage } from "@/lib/dashboard/access";
import { VIEWER_KINDS, VIEWER_KIND_LABELS, type DashboardViewer } from "@/lib/dashboard/viewer";
import { testDeveloperSignInHref } from "@/lib/test-developer";
import { useSignOut } from "./account-parts";
import { Avatar } from "./avatar";

const ITEM =
  "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-white-5";

const SEPARATOR = "-mx-1.5 my-1 h-px bg-hairline";

const VIEW_AS_LABEL = "font-mono text-[10px] uppercase tracking-[0.3em] text-dim";

/** Where the user menu opens: a dropdown above the card from md, a bottom sheet on phones. */
export type UserMenuForm = "dropdown" | "sheet";

// The user card at the foot of the sidebar and the menu it opens (board 51b):
// initials on the accent, name, role and an up-down chevron. The menu holds
// the viewer's own page (My account for a non-member, My profile for the
// team), then a red Sign out. A test developer also gets "View as", the four
// viewers, each a sign-in link back to this page. From md it opens above the
// card, as wide as it; on phones (inside the menu sheet) it is a bottom sheet,
// like every popup there.
export function UserCard({
  viewer,
  menuPage,
  form,
  onNavigate,
}: {
  viewer: DashboardViewer;
  menuPage: MenuPage | null;
  form: UserMenuForm;
  onNavigate?: () => void;
}) {
  const trigger = (
    <>
      <Avatar name={viewer.name} accent />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-prt-text">{viewer.name}</span>
        <span className="block truncate text-[12px] text-prt-muted">{viewer.role}</span>
      </span>
      <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
    </>
  );
  const triggerClass =
    "mt-3 flex h-[52px] w-full shrink-0 items-center gap-2 rounded-xl border border-hairline pl-2.5 pr-2 text-left transition-colors duration-300 ease-out hover:bg-white-5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-10 data-[state=open]:bg-white-5";
  const label = `${viewer.name}, ${viewer.role}. Open account menu`;

  if (form === "sheet") {
    return (
      <UserSheet viewer={viewer} menuPage={menuPage} onNavigate={onNavigate}>
        <button type="button" aria-label={label} className={triggerClass}>
          {trigger}
        </button>
      </UserSheet>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={triggerClass}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <UserDropdown viewer={viewer} menuPage={menuPage} onNavigate={onNavigate} />
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function UserDropdown({
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
          <DropdownMenuPrimitive.Label className={`${VIEW_AS_LABEL} px-2.5 pb-1.5 pt-1.5`}>View as</DropdownMenuPrimitive.Label>
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
  );
}

const SHEET_ROW =
  "flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] transition-colors duration-300 ease-out hover:bg-white-5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-10";

// The user menu as a bottom sheet on phones (the phone rule: every popup is a
// bottom sheet, like 50b-m): a grabber, who is signed in, then the same rows
// as the dropdown. `children` is the trigger: the avatar in the top bar or
// the user card in the menu sheet. It is the repo's Radix dialog, so focus,
// Escape and scroll lock come with it; it slides up only under motion-safe
// and closes at once (issues #79, #80).
export function UserSheet({
  viewer,
  menuPage,
  onNavigate,
  children,
}: {
  viewer: DashboardViewer;
  menuPage: MenuPage | null;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const signOut = useSignOut(viewer.session);
  const navigate = () => {
    setOpen(false);
    onNavigate?.();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-ground/70 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] overflow-y-auto rounded-t-[20px] border-t border-hairline bg-panel px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 text-prt-text focus:outline-none motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom"
        >
          <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-white-10" />
          <div className="mt-4 flex items-center gap-3 px-1">
            <Avatar name={viewer.name} accent size="ml" />
            <div className="min-w-0">
              <DialogTitle className="truncate text-[16px] font-semibold leading-snug">{viewer.name}</DialogTitle>
              <p className="truncate text-[13px] text-prt-muted">{viewer.role}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col border-t border-hairline pt-2">
            {menuPage && (
              <Link href={menuPage.href} onClick={navigate} className={`${SHEET_ROW} text-text-2 hover:text-prt-text`}>
                <UserRound aria-hidden className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {menuPage.label}
              </Link>
            )}

            {viewer.session === "test-developer" && (
              <div className="mt-2 border-t border-hairline pt-3">
                <p className={`${VIEW_AS_LABEL} px-3 pb-1`}>View as</p>
                {VIEWER_KINDS.map((kind) => (
                  <a
                    key={kind}
                    href={testDeveloperSignInHref(kind, pathname)}
                    aria-current={kind === viewer.kind ? "true" : undefined}
                    className={`${SHEET_ROW} justify-between text-text-2 hover:text-prt-text`}
                  >
                    {VIEWER_KIND_LABELS[kind]}
                    {kind === viewer.kind && <Check aria-hidden className="h-4 w-4 text-accent" strokeWidth={2} />}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-2 border-t border-hairline pt-2">
              <button type="button" onClick={() => void signOut()} className={`${SHEET_ROW} text-danger`}>
                <LogOut aria-hidden className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
