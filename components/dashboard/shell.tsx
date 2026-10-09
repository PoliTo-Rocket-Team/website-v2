"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { NavSection } from "@/lib/dashboard/access";
import type { DashboardViewer } from "@/lib/dashboard/viewer";
import { Sidebar } from "./sidebar";

// The dashboard frame (boards 40 to 46): a 248px sidebar fixed on the left
// and the page to its right, 40px in. Below md the sidebar becomes a drawer
// from the left under a 56px bar with the mark and a menu button. The drawer
// is the repo's Radix dialog, built on the primitive as nav-menu.tsx is: it
// slides in only under motion-safe and closes at once (issues #79, #80).
export function DashboardShell({
  viewer,
  sections,
  children,
}: {
  viewer: DashboardViewer;
  sections: readonly NavSection[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-svh bg-ground text-prt-text">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-hairline bg-panel/50 md:block">
        <Sidebar viewer={viewer} sections={sections} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-ground/90 px-5 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-[15px] font-semibold">
          <Image src="/brand/prt-mark-white.svg" alt="" width={444} height={220} className="h-7 w-auto" />
          Dashboard
        </Link>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            aria-label="Open menu"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white-10"
          >
            <Menu aria-hidden className="h-5 w-5" strokeWidth={2} />
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay className="bg-ground/55 backdrop-blur-[3px]" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-hairline bg-ground focus:outline-none motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-left"
            >
              <DialogTitle className="sr-only">Dashboard menu</DialogTitle>
              <Sidebar viewer={viewer} sections={sections} onNavigate={() => setOpen(false)} />
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </header>

      <main className="px-5 pb-12 pt-6 md:ml-[248px] md:px-10 md:pb-16 md:pt-8">{children}</main>
    </div>
  );
}
