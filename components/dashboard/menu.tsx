"use client";

// The dropdown menu every dashboard page uses (issue #432). It comes from the
// `radix-dashboard-menu` alias, pinned to the release that shares
// @radix-ui/react-dismissable-layer (and its focus scope and guards) with
// @radix-ui/react-dialog, the drawers' primitive.
//
// Why: Radix keeps the stack of open layers, and the body's
// `pointer-events: none` lock with the value it replaces, in module state. The
// older menu the rest of the site imports carries its own copy of that module,
// so a menu and a drawer each kept a separate stack. A drawer opened from a
// menu item saved the menu's `none` as the body's "original" value, the menu
// then cleared its own lock, and closing the drawer wrote `none` back: the
// whole page stopped taking clicks until a reload. On one shared stack the
// drawer sees the menu's layer and restores the real value.
//
// Keep the pin in step with @radix-ui/react-dialog. The site's own
// @radix-ui/react-dropdown-menu stays where it is, so the pages outside the
// dashboard do not change.

export * as DropdownMenuPrimitive from "radix-dashboard-menu";
export {
  Root as DropdownMenu,
  Trigger as DropdownMenuTrigger,
  Portal as DropdownMenuPortal,
} from "radix-dashboard-menu";
