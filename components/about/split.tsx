import type { ReactNode } from "react";

// A heading block on the left and paragraphs on the right from md, stacked on
// phones: Mission & Vision's "Our vision" (board 29) and Our University's
// "Politecnico" (board 30).

/** The heading size these About sections share: 26px on phones, 40px from md. */
export const subTitle = "text-[26px] font-bold leading-[1.15] tracking-[-0.025em] md:text-[40px]";

export const eyebrow = "font-mono text-xs tracking-[0.3em] text-accent";

export function Split({ left, paragraphs }: { left: ReactNode; paragraphs: readonly string[] }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto grid max-w-[1312px] gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] md:gap-16">
        <div>{left}</div>
        <div className="space-y-4 text-[15px] leading-[1.6] text-text-2 md:space-y-5 md:text-[17px]">
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
