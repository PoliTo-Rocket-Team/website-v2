import { initialsOf } from "@/lib/dashboard/viewer";

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-12 w-12 text-[15px] md:h-[72px] md:w-[72px] md:text-[22px]",
} as const;

// Initials in a circle (boards 40 and 40m). The accent fill marks the viewer
// in a list, or a lead; everyone else is on white-10.
export function Avatar({
  name,
  size = "md",
  accent = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  accent?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.02em] ${SIZES[size]} ${
        accent ? "bg-accent text-accent-on-accent" : "bg-white-10 text-text-2"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}
