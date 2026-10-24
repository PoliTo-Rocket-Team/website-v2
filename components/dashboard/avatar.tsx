import { MarkFallback } from "@/components/mark-fallback";
import { storedPhotoOf, type Pictured } from "@/lib/dashboard/stored-photo";

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

// A person's circle (boards 40 and 40m): their stored photo, else the PRT
// mark (issues #366 and #656). It takes the person and reads the photo off
// them (`storedPhotoOf`), so a circle that shows someone always shows their
// photo when they stored one. The accent fill marks the viewer in a list, or
// a lead; everyone else is on white-10.
export function Avatar({
  person,
  size = "md",
  accent = false,
}: {
  /** Who the circle shows; null for a circle that shows nobody, such as one drawn while the viewer loads. */
  person: Pictured | null;
  size?: AvatarSize;
  accent?: boolean;
}) {
  const photo = person === null ? null : storedPhotoOf(person);
  if (photo !== null) {
    return (
      // A Blob store URL; next/image would need every store host configured.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" aria-hidden="true" className={`shrink-0 rounded-full object-cover ${SIZES[size]}`} />
    );
  }
  return (
    <span aria-hidden="true" className={`relative block shrink-0 rounded-full ${SIZES[size]} ${accent ? "bg-accent" : "bg-white-10"}`}>
      <MarkFallback />
    </span>
  );
}
