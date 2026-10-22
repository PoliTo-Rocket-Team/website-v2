import type { ReactNode } from "react";
import { partNumber, type PartList, type Prose, type TextBlock } from "@/lib/project-pages";
import { SectionHead } from "./parts";

// Text blocks (boards 23, 24, 25 and 93c). A full-width block takes the
// page's column; a half-width one takes half of it, and two in a row sit side
// by side, 64px apart, as 01 The name and 02 The design always did. A block
// may end with a parts list, drawn top to bottom and numbered bottom to top.
// The phone boards stack them with shorter copy. In the editor each column is
// its own block (`frame`, ./view.tsx).

function Body({ body, under }: { body: Prose; under: boolean }) {
  return (
    <div className={`text-[15px] leading-[24px] text-text-2 md:text-[17px] md:leading-[27px] ${under ? "mt-4 md:mt-10" : ""}`}>
      <div className="hidden space-y-6 md:block">
        {/* By place: the editor redraws the page as paragraphs are typed, and two may read alike. */}
        {body.text.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <p className="md:hidden">{body.phone}</p>
    </div>
  );
}

function Parts({ parts }: { parts: PartList }) {
  const { items } = parts;
  return (
    <>
      {/* One grid for the whole list, so a long name widens its column for
        every row alike; it never drops below board 23m's 104px. */}
      <ol
        aria-label={parts.label}
        className="mt-6 grid grid-cols-[28px_minmax(104px,max-content)_1fr] border-t border-hairline md:mt-8 md:grid-cols-[36px_200px_1fr]"
      >
        {items.map((part, i) => (
          <li key={i} className="col-span-3 grid grid-cols-subgrid items-center border-b border-hairline py-2.5 md:py-3.5">
            <span className="font-mono text-[10px] text-accent md:text-[11px]">{partNumber(i, items.length)}</span>
            <span className="pr-2 text-[15px] font-semibold md:text-[17px]">{part.name}</span>
            <span className="text-[13px] text-text-2 md:text-[15px]">
              <span className="md:hidden">{part.phone}</span>
              <span className="hidden md:inline">{part.desc}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 hidden font-mono text-[11px] tracking-[0.2em] text-dim md:block">
        {parts.caption} · 01 → {partNumber(0, items.length)}
      </p>
    </>
  );
}

/** One text block's column: its heading, numbered `num`, its paragraphs and its parts list. */
export function ProjectText({ block, num }: { block: TextBlock; num: string | null }) {
  const { heading } = block;
  return (
    <div>
      {heading && <SectionHead num={num ?? ""} label={heading.label} title={heading.title} />}
      <Body body={block.body} under={heading !== undefined} />
      {block.parts && <Parts parts={block.parts} />}
    </div>
  );
}

/**
 * A row of text: two columns from md, so a half-width block takes the left
 * one and a second sits beside it; a full-width block takes the whole column.
 */
export function TextRow({ full = false, children }: { full?: boolean; children: ReactNode }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className={`mx-auto grid max-w-[1312px] gap-14 md:gap-16 ${full ? "" : "md:grid-cols-2"}`}>{children}</div>
    </section>
  );
}
