"use client";

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The place in the shell's phone top bar, between the page name and the
// avatar, where a page may put its main action (boards 60m "Give", 61m
// "New"). The shell owns the element; a page fills it with TopBarAction.
export const TopBarSlot = createContext<HTMLElement | null>(null);

/** Renders its children in the shell's phone top bar; nothing until the bar has mounted. */
export function TopBarAction({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlot);
  return slot ? createPortal(children, slot) : null;
}

// The phone top bar's title is the name of the page the address points at.
// A route that is not that page, the dashboard's not-found (issue #807), sets
// its own title here instead; the shell reads it before the address.
export const TopBarTitleSlot = createContext<(title: string | null) => void>(() => {});

/** Sets the shell's phone top bar title while this is mounted; renders nothing. */
export function TopBarTitle({ title }: { title: string }) {
  const setTitle = useContext(TopBarTitleSlot);
  // A layout effect, so a client navigation never paints the address's title first.
  useLayoutEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [setTitle, title]);
  return null;
}
