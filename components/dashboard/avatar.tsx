import { MarkFallback } from "@/components/mark-fallback";

const SIZES = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-8 w-8",
  /** The navbar's account button (board 01b). */
  nav: "h-[38px] w-[38px]",
  ml: "h-11 w-11",
  /** The applicant at the top of the detail panel (board 41b). */
  panel: "h-12 w-12",
  lg: "h-12 w-12 md:h-[72px] md:w-[72px]",
  /** The person at the top of their own Overview (boards 52 and 52m). */
  person: "h-14 w-14 md:h-[72px] md:w-[72px]",
  xl: "h-16 w-16",
} as const;

export type AvatarSize = keyof typeof SIZES;

// A person's circle (boards 40 and 40m): their photo, else the PRT mark
// (issue #366). The accent fill marks the viewer in a list, or a lead;
// everyone else is on white-10.
export function Avatar({
  size = "md",
  accent = false,
  photoUrl = null,
}: {
  size?: AvatarSize;
  accent?: boolean;
  /** The person's photo, shown in place of the mark (board 61g). */
  photoUrl?: string | null;
}) {
  if (photoUrl !== null) {
    return (
      // A Blob store URL; next/image would need every store host configured.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" aria-hidden="true" className={`shrink-0 rounded-full object-cover ${SIZES[size]}`} />
    );
  }
  return (
    <span aria-hidden="true" className={`relative block shrink-0 rounded-full ${SIZES[size]} ${accent ? "bg-accent" : "bg-white-10"}`}>
      <MarkFallback />
    </span>
  );
}
