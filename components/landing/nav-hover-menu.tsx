"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { openBarJoin } from "./glass-bar";
import { isCurrentLink, type NavSection } from "./nav-menu";

// Board 27: from lg, hovering or focusing a navbar link that has pages under
// it (About) drops a glass panel that hangs flush from the bar, under the
// link. A 2px accent line starts beside the link inside the bar and runs down
// past the last page; the pages are 16px, left-aligned with the link, 12px
// apart, the current one in paper and the rest grey. Clicking the link, or
// Enter on it, still goes to its own page.
//
// It is the repo's Radix dropdown menu (components/ui/dropdown-menu), not
// modal, so the menu roles, arrow keys, Escape, focus return and outside
// click come with it. Its content is the primitive itself, as in
// nav-menu.tsx, because the shadcn DropdownMenuContent is a floating card.
// The panel is portaled out of the bar: the bar's backdrop-filter would
// otherwise be the panel's backdrop root, and the panel could not blur the
// page.
//
// Radix moves focus into the menu when it opens. From the keyboard that puts
// focus on the first page; Tab then closes the menu and goes on to the link
// after this one, and Shift+Tab back to this one, so the menu never traps Tab.

/** The panel's left edge sits this far left of the link's text (board 27). */
const HANG_INSET = 36;
/** Lets the pointer travel from the link into the panel. */
const CLOSE_DELAY_MS = 150;

export function NavHoverMenu({ section, className }: { section: NavSection; className: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Only a menu the pointer opened closes when the pointer leaves it.
  const openedByPointer = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  // Focus that comes back to the link as the menu closes must not reopen it.
  const focusReturning = useRef(false);
  const tabbedForward = useRef(false);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  useEffect(() => cancelClose, []);

  const openBy = (pointer: boolean) => {
    cancelClose();
    if (open) return;
    openedByPointer.current = pointer;
    setOpen(true);
  };
  const closeSoon = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || !openedByPointer.current) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const onTriggerFocus = (e: FocusEvent<HTMLAnchorElement>) => {
    if (focusReturning.current) {
      focusReturning.current = false;
      return;
    }
    if (e.currentTarget.matches(":focus-visible")) openBy(false);
  };

  // Enter follows the link, as on every other navbar link. Radix would take
  // it to toggle the menu, so it is handled here and never reaches Radix.
  const onTriggerKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.currentTarget.click();
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    tabbedForward.current = !e.shiftKey;
    setOpen(false);
  };

  // While the panel shows, the bar's bottom edge leaves a gap over it.
  const hangRef = useCallback((panel: HTMLDivElement | null) => {
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;
    let release = () => {};
    const join = () => {
      release();
      const left = trigger.getBoundingClientRect().left - HANG_INSET;
      // Inside the 1px side edges, so they meet the bar's edge.
      release = openBarJoin(left + 1, left + panel.offsetWidth - 1);
    };
    join();
    window.addEventListener("resize", join);
    return () => {
      window.removeEventListener("resize", join);
      release();
    };
  }, []);

  // No fade: the panel shows the moment the pointer reaches the link.
  const fadeIn = "";

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        cancelClose();
        if (next) openedByPointer.current = false;
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Link
          ref={triggerRef}
          href={section.href}
          aria-current={isCurrentLink(pathname, section.href) ? "page" : undefined}
          // Full bar height, so the panel hangs from the bar's bottom edge
          // and the pointer never crosses a gap on its way down.
          // Paper while its menu shows, as board 27 draws it under the pointer.
          className={`flex h-full items-center outline-none focus-visible:underline focus-visible:decoration-accent focus-visible:decoration-2 focus-visible:underline-offset-8 ${className} data-[state=open]:text-prt-text`}
          onPointerEnter={(e) => e.pointerType === "mouse" && openBy(true)}
          onPointerLeave={closeSoon}
          // A click follows the link; it does not toggle the menu.
          onPointerDown={(e) => e.pointerType === "mouse" && e.preventDefault()}
          onFocus={onTriggerFocus}
          onKeyDown={onTriggerKeyDown}
        >
          {section.label}
        </Link>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={0}
          alignOffset={-HANG_INSET}
          avoidCollisions={false}
          loop
          aria-label={section.label}
          className="relative z-50 focus:outline-none"
          onPointerEnter={cancelClose}
          onPointerLeave={closeSoon}
          onKeyDown={onMenuKeyDown}
          onCloseAutoFocus={(e) => {
            const trigger = triggerRef.current;
            if (tabbedForward.current && trigger) {
              tabbedForward.current = false;
              e.preventDefault();
              tabbableAfter(trigger)?.focus();
            } else if (openedByPointer.current) {
              // A menu the mouse opened gives focus back to nothing, so the
              // link shows no focus ring after the pointer leaves.
              e.preventDefault();
              (document.activeElement as HTMLElement | null)?.blur();
            } else if (document.activeElement !== trigger) {
              focusReturning.current = true;
            }
          }}
          onInteractOutside={(e) => {
            // The link is the trigger: pressing it keeps the panel up.
            if (triggerRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div ref={hangRef} aria-hidden className={`glass-hang absolute inset-0 ${fadeIn}`} />
          {/* From the top of the link's line in the 72px bar (y 26) to the
              foot of the last page. */}
          <span aria-hidden className={`absolute bottom-5 left-[22px] top-[-46px] w-0.5 bg-accent ${fadeIn}`} />
          <div className={`relative pb-3.5 pt-2.5 ${fadeIn}`}>
            {section.pages.map((p) => {
              const current = isCurrentLink(pathname, p.href);
              return (
                <DropdownMenuPrimitive.Item key={p.href} asChild>
                  <Link
                    href={p.href}
                    aria-current={current ? "page" : undefined}
                    className={`block whitespace-nowrap pl-9 pr-7 text-base leading-[29px] outline-none transition-colors duration-300 ease-out hover:text-accent data-[highlighted]:text-accent ${
                      current ? "font-medium text-prt-text" : "text-text-2"
                    }`}
                  >
                    {p.label}
                  </Link>
                </DropdownMenuPrimitive.Item>
              );
            })}
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

/** The next element after `from` that Tab would reach, outside any open menu. */
function tabbableAfter(from: HTMLElement): HTMLElement | undefined {
  const candidates = document.querySelectorAll<HTMLElement>(
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]",
  );
  const order = Array.from(candidates).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest("[data-radix-menu-content]"),
  );
  const at = order.indexOf(from);
  return at < 0 ? undefined : order[at + 1];
}
