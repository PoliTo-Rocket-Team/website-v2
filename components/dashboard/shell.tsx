"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { pageTitleFor, type MenuPage, type NavSection } from "@/lib/dashboard/access";
import type { DashboardViewer } from "@/lib/dashboard/viewer";
import { Avatar } from "./avatar";
import { Sidebar } from "./sidebar";
import { UserSheet } from "./user-card";

/** A round icon button in the phone top bar: the menu, or a full page's back arrow. */
export const ICON_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white-10";

// The dashboard frame (boards 51b, 52, 56): a 248px sidebar fixed on the left
// and the page to its right, 40px in. Below md (boards 50m-b, 52m, 56m) a 56px
// top bar holds a menu button, the page's title and the viewer's avatar. The
// menu button opens the sidebar as a 300px sheet from the left; the avatar
// opens the user menu as a bottom sheet. Both are the repo's Radix dialog,
// built on the primitive as nav-menu.tsx is: they slide in only under
// motion-safe and close at once (issues #79, #80). A page may put its main action
// in the top bar beside the avatar (board 57m "+ New") with TopBarAction.
export function DashboardShell({
  viewer,
  sections,
  menuPage,
  children,
}: {
  viewer: DashboardViewer;
  sections: readonly NavSection[];
  menuPage: MenuPage | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const pathname = usePathname();
  const title = pageTitleFor(pathname ?? "/dashboard") ?? "Dashboard";
  return (
    <div className="min-h-svh bg-ground text-prt-text">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-hairline bg-panel/50 md:block">
        <Sidebar viewer={viewer} sections={sections} menuPage={menuPage} userMenu="dropdown" />
      </aside>

      <PhoneTopBar
        title={title}
        leading={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger aria-label="Open menu" className={ICON_BUTTON}>
              <Menu aria-hidden className="h-[22px] w-[22px]" strokeWidth={2} />
            </DialogTrigger>
            <DialogPortal>
              <DialogOverlay className="bg-ground/55 backdrop-blur-[3px]" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] border-r border-hairline bg-ground focus:outline-none motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-left"
              >
                <DialogTitle className="sr-only">Dashboard menu</DialogTitle>
                <Sidebar
                  viewer={viewer}
                  sections={sections}
                  menuPage={menuPage}
                  userMenu="sheet"
                  onNavigate={() => setOpen(false)}
                  close={
                    <DialogClose aria-label="Close menu" className={`${ICON_BUTTON} -mr-1.5 text-prt-muted hover:text-prt-text`}>
                      <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                    </DialogClose>
                  }
                />
              </DialogPrimitive.Content>
            </DialogPortal>
          </Dialog>
        }
      >
        <div ref={setActionSlot} className="mr-1.5 flex shrink-0 items-center empty:hidden" />
        <UserSheet viewer={viewer} menuPage={menuPage}>
          <button
            type="button"
            aria-label={`${viewer.name}, ${viewer.role}. Open account menu`}
            className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Avatar name={viewer.name} accent />
          </button>
        </UserSheet>
      </PhoneTopBar>

      <main className="px-4 pb-12 pt-4 md:ml-[248px] md:px-10 md:pb-16 md:pt-8">
        <TopBarSlot.Provider value={actionSlot}>{children}</TopBarSlot.Provider>
      </main>
    </div>
  );
}

/**
 * The phone top bar (boards 50m-b, 52m, 56m): a round button on the left, the
 * title, then what follows it. The shell's bar holds the menu and the avatar;
 * a panel that opens as a full page on phones (58d-m) uses the same bar with
 * a back arrow in place of the menu.
 */
export function PhoneTopBar({ leading, title, children }: { leading: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b border-hairline bg-ground/90 pl-2 pr-4 backdrop-blur md:hidden">
      {leading}
      <p className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</p>
      {children}
    </header>
  );
}

const TopBarSlot = createContext<HTMLElement | null>(null);

/** A page's main action, shown in the phone top bar beside the avatar (board 57m). */
export function TopBarAction({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlot);
  return slot ? createPortal(children, slot) : null;
}
