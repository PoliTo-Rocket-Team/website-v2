import { createElement, Fragment, type ReactNode } from "react";

// The home card sets a formula's digits lowered ("N<sub>2</sub>O"). The
// stored text keeps them as Unicode subscript digits ("N₂O"), which an editor
// can type, and the card draws each run of them as a <sub> of plain digits.

const SUBSCRIPT_RUN = /([₀-₉]+)/u;

const plainDigits = (run: string) => [...run].map((ch) => String(ch.codePointAt(0)! - 0x2080)).join("");

export function withSubscriptDigits(text: string): ReactNode {
  const parts = text.split(SUBSCRIPT_RUN);
  if (parts.length === 1) return text;
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => (i % 2 === 1 ? createElement("sub", null, plainDigits(part)) : part)).filter((part) => part !== ""),
  );
}
