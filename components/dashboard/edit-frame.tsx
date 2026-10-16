"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The page under the edit bar (boards 74b, 74e) is drawn in a same-origin
// iframe, and React renders the page into it through a portal, so the page
// stays live React (later slices update it as the editor types) while its
// own window is the frame. That is what lets Phone mode work: the page's
// breakpoints and its `svh` and `vw` read the 390px frame, not the
// dashboard's window. It also keeps the page's fixed navbar under the edit
// bar instead of over it, in Desktop mode too.

const FRAME_DOCUMENT = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>';

/** The head nodes that style the page: the app's stylesheets and fonts. */
function isStyle(node: Node): node is HTMLLinkElement | HTMLStyleElement {
  return (
    node instanceof HTMLStyleElement ||
    (node instanceof HTMLLinkElement && node.rel === "stylesheet")
  );
}

/**
 * Gives the frame's document the app's styles: the root's paint and the
 * body's font classes, and a copy of every stylesheet in the head, kept in
 * step as the app adds or drops one. Returns the undo.
 */
function mirrorStyles(from: Document, to: Document): () => void {
  for (const name of ["style", "class"]) {
    const value = from.documentElement.getAttribute(name);
    if (value !== null) to.documentElement.setAttribute(name, value);
  }
  to.body.className = from.body.className;
  const copies = new Map<Node, Node>();
  const add = (node: Node) => {
    if (!isStyle(node) || copies.has(node)) return;
    const copy = to.importNode(node, true);
    copies.set(node, copy);
    to.head.appendChild(copy);
  };
  from.head.childNodes.forEach(add);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach(add);
      record.removedNodes.forEach((node) => {
        const copy = copies.get(node);
        copy?.parentNode?.removeChild(copy);
        copies.delete(node);
      });
    }
  });
  observer.observe(from.head, { childList: true });
  return () => observer.disconnect();
}

/**
 * A link clicked in the preview would take the editor off the page they are
 * editing, so it goes nowhere. Buttons, such as the Edit chips, still work.
 */
function stayOnPage(event: MouseEvent<HTMLDivElement>) {
  // The target lives in the frame's window, whose Element is not this
  // window's, so `instanceof` cannot tell; any node in the page has closest.
  const target = event.target as Partial<Element>;
  if (typeof target.closest !== "function" || target.closest("a") === null) return;
  event.preventDefault();
  event.stopPropagation();
}

export function EditFrame({
  title,
  className,
  style,
  children,
}: {
  title: string;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    let undo = () => {};
    const ready = () => {
      const doc = frame.contentDocument;
      if (doc === null || doc.body === null) return;
      undo();
      undo = mirrorStyles(document, doc);
      setBody(doc.body);
    };
    // The frame may have loaded before this effect ran (it is in the server's
    // HTML); its first, blank document is not the one srcDoc gives it.
    if (frame.contentDocument?.URL === "about:srcdoc" && frame.contentDocument.readyState === "complete") ready();
    frame.addEventListener("load", ready);
    return () => {
      frame.removeEventListener("load", ready);
      undo();
    };
  }, []);

  return (
    <>
      <iframe ref={frameRef} title={title} srcDoc={FRAME_DOCUMENT} className={className} style={style} />
      {body !== null &&
        createPortal(
          <div onClickCapture={stayOnPage} className="min-h-svh">
            {children}
          </div>,
          body,
        )}
    </>
  );
}
