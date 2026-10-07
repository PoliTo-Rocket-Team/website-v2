import Image from "next/image";
import { Linkedin, Mail } from "lucide-react";
import { contactsOf, initials } from "@/lib/about/people";
import type { Person } from "@/lib/about/types";

// The people pieces every Team page section shares: a round colour photo,
// with the PRT mark or the initials when there is none, and the LinkedIn and
// mail icons. The name is always printed beside the circle, so the photo
// itself is decorative.

/**
 * What a circle with no photo shows. A large circle (a leader, a head) shows
 * the PRT mark, a small one the initials; "initials-to-mark" is small on
 * phones and large from lg, as the advisors are (boards 26 and 26m).
 */
export type Fallback = "mark" | "initials" | "initials-to-mark";

export function Avatar({
  person,
  sizeClass,
  sizes,
  fallback,
  initialsClass = "text-[10px]",
}: {
  person: Pick<Person, "name" | "photo">;
  /** Width and height, for example "h-[60px] w-[60px] lg:h-[120px] lg:w-[120px]". */
  sizeClass: string;
  /** The photo's rendered width for next/image, for example "120px". */
  sizes: string;
  fallback: Fallback;
  initialsClass?: string;
}) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full bg-surface-2 ${sizeClass}`}>
      {person.photo !== undefined ? (
        <Image src={person.photo} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          {fallback !== "initials" && (
            <Image
              src="/brand/prt-mark-white.svg"
              alt=""
              width={444}
              height={220}
              className={`absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 ${
                fallback === "initials-to-mark" ? "hidden lg:block" : ""
              }`}
            />
          )}
          {fallback !== "mark" && (
            <span
              aria-hidden
              className={`absolute inset-0 flex items-center justify-center font-mono tracking-[0.05em] text-text-2 ${initialsClass} ${
                fallback === "initials-to-mark" ? "lg:hidden" : ""
              }`}
            >
              {initials(person.name)}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** LinkedIn, then mail, each only when the person has one. */
export function Contacts({
  person,
  iconClass,
  className = "",
}: {
  person: Pick<Person, "name" | "linkedin" | "email">;
  /** The icon's size, for example "h-[18px] w-[18px]". */
  iconClass: string;
  className?: string;
}) {
  const { linkedin, email } = contactsOf(person);
  if (linkedin === undefined && email === undefined) return null;
  const link = "text-prt-muted transition-colors duration-300 ease-out hover:text-accent";
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {linkedin !== undefined && (
        <a href={linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on LinkedIn`} className={link}>
          <Linkedin aria-hidden className={iconClass} strokeWidth={1.5} />
        </a>
      )}
      {email !== undefined && (
        <a href={email} aria-label={`Email ${person.name}`} className={link}>
          <Mail aria-hidden className={iconClass} strokeWidth={1.5} />
        </a>
      )}
    </span>
  );
}
