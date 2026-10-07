import type { ReactNode } from "react";

// A Team page section's eyebrow and title (manifest, Type: the eyebrow and
// section title patterns), left-aligned or centred with an intro under it. A
// section with no eyebrow (Departments, Advisors) starts at its title.

export function SectionHead({
  eyebrow,
  title,
  intro,
  align,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: string;
  intro?: string;
  /** "centre-to-left" is centred on phones and tablets and left from xl, as Who leads is. */
  align: "left" | "centre" | "centre-to-left";
  className?: string;
}) {
  const alignClass = { left: "", centre: "text-center", "centre-to-left": "text-center xl:text-left" }[align];
  return (
    <div className={`${alignClass} ${className}`}>
      {eyebrow !== undefined && <p className="mb-4 font-mono text-xs tracking-[0.3em] text-accent">{eyebrow}</p>}
      <h2 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">{title}</h2>
      {intro !== undefined && (
        <p className="mt-3 text-[15px] leading-relaxed text-text-2 md:mt-5 md:text-[17px]">{intro}</p>
      )}
    </div>
  );
}
