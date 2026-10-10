"use client";

import { createContext, useContext, type ReactNode } from "react";
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
