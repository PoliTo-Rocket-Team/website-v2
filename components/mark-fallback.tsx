import Image from "next/image";

// What every image slot on the site shows when it has no image: the PRT mark,
// centred in its frame (issue #366). A person's circle with no photo, the
// team's own account on an outreach card, an empty photo frame: one mark, one
// component, never a person's initials. The frame sets the size, the shape
// and the fill, and must be `relative`; the mark is decorative.

/**
 * How large the mark sits in its frame: "circle" fills most of a round
 * avatar, as the org chart's leaders always drew it (board 26); "frame" is a
 * small, dimmed mark in the middle of a wider photo frame.
 */
export type MarkFit = "circle" | "frame";

const FIT: Readonly<Record<MarkFit, string>> = {
  circle: "w-[78%]",
  frame: "w-1/4 max-w-24 opacity-40",
};

export function MarkFallback({ fit = "circle" }: { fit?: MarkFit }) {
  return (
    <Image
      src="/brand/prt-mark-white.svg"
      alt=""
      aria-hidden
      width={444}
      height={220}
      className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${FIT[fit]}`}
    />
  );
}
